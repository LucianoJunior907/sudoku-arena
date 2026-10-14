-- ============================================
-- Ranked Queue + Match Tables
-- Execute no SQL Editor do Supabase
-- ============================================

-- Ranked queue (matchmaking)
create table if not exists public.ranked_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  difficulty text not null default 'medium',
  joined_at timestamptz not null default now()
);

-- Ranked matches (1v1)
create table if not exists public.ranked_matches (
  id uuid default gen_random_uuid() primary key,
  player1_id uuid references auth.users on delete cascade not null,
  player2_id uuid references auth.users on delete cascade not null,
  difficulty text not null default 'medium',
  board_seed text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  winner_id uuid,
  player1_progress integer not null default 0,
  player2_progress integer not null default 0,
  player1_errors integer not null default 0,
  player2_errors integer not null default 0,
  player1_cells_correct integer not null default 0,
  player2_cells_correct integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- RLS
alter table public.ranked_queue enable row level security;
alter table public.ranked_matches enable row level security;

create policy "Queue: users can insert own" on public.ranked_queue for insert with check (auth.uid() = user_id);
create policy "Queue: users can read all" on public.ranked_queue for select using (true);
create policy "Queue: users can delete own" on public.ranked_queue for delete using (auth.uid() = user_id);

create policy "Ranked matches: players can read" on public.ranked_matches for select using (auth.uid() = player1_id or auth.uid() = player2_id);
create policy "Ranked matches: anyone can insert" on public.ranked_matches for insert with check (auth.uid() = player1_id or auth.uid() = player2_id);
create policy "Ranked matches: players can update" on public.ranked_matches for update using (auth.uid() = player1_id or auth.uid() = player2_id);

-- Enable realtime for ranked_matches
alter publication supabase_realtime add table public.ranked_matches;
alter publication supabase_realtime add table public.ranked_queue;
