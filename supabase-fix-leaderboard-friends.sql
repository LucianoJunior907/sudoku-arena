-- ============================================
-- SUDOKU ARENA — FIX LEADERBOARD + USERNAME + FRIENDS
-- Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. FIX LEADERBOARD: Add FK from matches → profiles
-- ============================================

-- Add FK from matches.user_id → profiles.id (if not exists)
-- This allows the !inner join in the leaderboard query to work
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'matches_user_id_profiles_fk'
  ) then
    alter table public.matches
    add constraint matches_user_id_profiles_fk
    foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- ============================================
-- 2. USERNAME: Add unique username column to profiles
-- ============================================

-- Add username column (nullable for existing users)
alter table public.profiles
add column if not exists username text;

-- Create unique index on username (case-insensitive)
-- Allows NULL (existing users without username won't conflict)
create unique index if not exists profiles_username_unique_idx
on public.profiles (lower(username))
where username is not null;

-- Update RLS to allow users to search by username (public read)
-- Already have "Profiles are viewable by everyone" policy

-- ============================================
-- 3. FRIENDS: Add username-based search + better RLS
-- ============================================

-- The friends table already exists with:
-- user_id, friend_id, status (pending/accepted/blocked)
-- We just need to ensure the RLS allows searching profiles by username

-- Update the friends RLS to be more precise
drop policy if exists "Friends viewable by owner" on public.friends;
drop policy if exists "Users can insert own friendships" on public.friends;
drop policy if exists "Users can update own friendships" on public.friends;
drop policy if exists "Users can delete own friendships" on public.friends;

-- Users can see friendships where they are either the user or the friend
create policy "Friends visible to participants" on public.friends
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

-- Only the user can create friend requests (as user_id)
create policy "Users can send friend requests" on public.friends
  for insert with check (auth.uid() = user_id);

-- Both parties can update status (accept/reject)
create policy "Users can update own friendships" on public.friends
  for update using (auth.uid() = user_id or auth.uid() = friend_id);

-- Both parties can delete (remove friend)
create policy "Users can delete own friendships" on public.friends
  for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- ============================================
-- 4. RPC: Search user by username (for friend requests)
-- ============================================
create or replace function public.search_user_by_username(p_username text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- Search by case-insensitive username, exclude self
  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_seed', p.avatar_seed,
    'rating', p.rating
  )
  into v_result
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
    and p.id != v_user_id;

  if v_result is null then
    return jsonb_build_object('found', false);
  end if;

  return jsonb_build_object('found', true, 'user', v_result);
end;
$$;

grant execute on function public.search_user_by_username to authenticated;

-- ============================================
-- 5. RPC: Check if username is available
-- ============================================
create or replace function public.check_username_available(p_username text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_username is null or length(trim(p_username)) < 3 or length(trim(p_username)) > 20 then
    return jsonb_build_object('available', false, 'error', 'Username must be 3-20 characters');
  end if;

  -- Check format: alphanumeric + underscores only
  if trim(p_username) !~ '^[a-zA-Z0-9_]+$' then
    return jsonb_build_object('available', false, 'error', 'Only letters, numbers and underscores');
  end if;

  select exists(
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
  ) into v_exists;

  return jsonb_build_object('available', not v_exists);
end;
$$;

grant execute on function public.check_username_available to authenticated;

-- ============================================
-- 6. RPC: Set username (for signup)
-- ============================================
create or replace function public.set_username(p_username text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean;
  v_clean text;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  v_clean := trim(p_username);

  if length(v_clean) < 3 or length(v_clean) > 20 then
    return jsonb_build_object('error', 'Username must be 3-20 characters');
  end if;

  if v_clean !~ '^[a-zA-Z0-9_]+$' then
    return jsonb_build_object('error', 'Only letters, numbers and underscores');
  end if;

  -- Check if already taken
  select exists(
    select 1 from public.profiles
    where lower(username) = lower(v_clean)
      and id != v_user_id
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('error', 'Username already taken');
  end if;

  -- Set the username
  update public.profiles
  set username = v_clean,
      display_name = coalesce(display_name, v_clean),
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('success', true, 'username', v_clean);
end;
$$;

grant execute on function public.set_username to authenticated;
