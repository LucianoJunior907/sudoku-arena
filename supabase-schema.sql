-- ============================================
-- Sudoku Arena — Supabase Schema
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default 'Player',
  avatar_seed text not null default 'arena-default',
  title_id text,
  frame_id text not null default 'frame-default',
  effect_id text not null default 'effect-none',
  total_xp integer not null default 0,
  level integer not null default 1,
  rating integer not null default 0,
  streak_freezes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Matches (solo, daily, duo, ranked)
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  mode text not null check (mode in ('solo', 'daily', 'duo', 'ranked')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  elapsed_sec integer not null,
  errors integer not null default 0,
  hints_used integer not null default 0,
  completed boolean not null default false,
  xp_earned integer not null default 0,
  score integer not null default 0,
  is_record boolean not null default false,
  created_at timestamptz not null default now()
);

-- Daily records
create table if not exists public.daily_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  completed boolean not null default false,
  elapsed_sec integer not null default 0,
  errors integer not null default 0,
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, date, difficulty)
);

-- Friends
create table if not exists public.friends (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  friend_id uuid references auth.users on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

-- Chat messages
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id text not null,
  author_id uuid references auth.users on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Rooms (Duo)
create table if not exists public.rooms (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  is_private boolean not null default false,
  difficulty text not null default 'medium',
  host_id uuid references auth.users on delete cascade not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'abandoned')),
  created_at timestamptz not null default now()
);

-- Room participants
create table if not exists public.room_participants (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references public.rooms on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  team integer not null default 1 check (team in (1, 2)),
  seat integer not null default 1 check (seat in (1, 2)),
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- Seasons
create table if not exists public.seasons (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reset_policy text not null default 'partial',
  is_active boolean not null default false
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.daily_records enable row level security;
alter table public.friends enable row level security;
alter table public.chat_messages enable row level security;
alter table public.rooms enable row level security;
alter table public.room_participants enable row level security;
alter table public.seasons enable row level security;

-- Profiles: users can see all profiles, edit only their own
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Matches: users can see all matches, insert/update only their own
create policy "Matches are viewable by everyone" on public.matches for select using (true);
create policy "Users can insert own matches" on public.matches for insert with check (auth.uid() = user_id);
create policy "Users can update own matches" on public.matches for update using (auth.uid() = user_id);

-- Daily records: same pattern
create policy "Daily records viewable by owner" on public.daily_records for select using (auth.uid() = user_id);
create policy "Users can insert own daily records" on public.daily_records for insert with check (auth.uid() = user_id);
create policy "Users can update own daily records" on public.daily_records for update using (auth.uid() = user_id);

-- Friends: users can see their own friendships
create policy "Friends viewable by owner" on public.friends for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users can insert own friendships" on public.friends for insert with check (auth.uid() = user_id);
create policy "Users can update own friendships" on public.friends for update using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "Users can delete own friendships" on public.friends for delete using (auth.uid() = user_id or auth.uid() = friend_id);

-- Chat: users in the thread can see/send messages
create policy "Chat viewable by thread participants" on public.chat_messages for select using (true);
create policy "Users can send messages" on public.chat_messages for insert with check (auth.uid() = author_id);

-- Rooms: public rooms are viewable by everyone, private by participants
create policy "Rooms viewable by everyone" on public.rooms for select using (true);
create policy "Users can create rooms" on public.rooms for insert with check (auth.uid() = host_id);
create policy "Host can update rooms" on public.rooms for update using (auth.uid() = host_id);

-- Room participants
create policy "Room participants viewable by everyone" on public.room_participants for select using (true);
create policy "Users can join rooms" on public.room_participants for insert with check (auth.uid() = user_id);
create policy "Users can leave rooms" on public.room_participants for delete using (auth.uid() = user_id);

-- Seasons: viewable by everyone
create policy "Seasons viewable by everyone" on public.seasons for select using (true);

-- ============================================
-- Auto-create profile on signup
-- ============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
