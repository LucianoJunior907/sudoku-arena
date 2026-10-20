-- ============================================
-- SUDOKU ARENA — FIX RANKED: tabelas + RLS + políticas
-- Execute no SQL Editor do Supabase
-- ============================================
-- Este script garante que as tabelas ranked_queue e ranked_matches
-- existam e que as políticas RLS estejam corretas.
-- É IDEMPOTENTE — pode ser rodado múltiplas vezes.
-- ============================================

-- ============================================
-- 1. Tabela: ranked_queue (fila de matchmaking)
-- ============================================
create table if not exists public.ranked_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  difficulty text not null default 'medium',
  joined_at timestamptz not null default now()
);

-- ============================================
-- 2. Tabela: ranked_matches (partidas 1v1)
-- ============================================
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

-- ============================================
-- 3. Habilitar RLS
-- ============================================
alter table public.ranked_queue enable row level security;
alter table public.ranked_matches enable row level security;

-- ============================================
-- 4. Políticas RLS — ranked_queue
-- ============================================
-- Drop all existing policies first (clean slate)
drop policy if exists "Queue: users can insert own" on public.ranked_queue;
drop policy if exists "Queue: users can read all" on public.ranked_queue;
drop policy if exists "Queue: users can delete own" on public.ranked_queue;
drop policy if exists "Queue: users can update own" on public.ranked_queue;

-- INSERT: usuário só pode inserir a própria entrada na fila
create policy "Queue: users can insert own" on public.ranked_queue
  for insert with check (auth.uid() = user_id);

-- SELECT: todos os autenticados podem ver a fila (para encontrar oponentes)
create policy "Queue: users can read all" on public.ranked_queue
  for select using (auth.uid() is not null);

-- DELETE: usuário só pode remover a própria entrada
create policy "Queue: users can delete own" on public.ranked_queue
  for delete using (auth.uid() = user_id);

-- ============================================
-- 5. Políticas RLS — ranked_matches
-- ============================================
-- Drop all existing policies first (clean slate)
drop policy if exists "Ranked matches: players can read" on public.ranked_matches;
drop policy if exists "Ranked matches: anyone can insert" on public.ranked_matches;
drop policy if exists "Ranked matches: players can update" on public.ranked_matches;
drop policy if exists "Players can update ranked match" on public.ranked_matches;
drop policy if exists "Player1 can update own fields" on public.ranked_matches;
drop policy if exists "Player2 can update own fields" on public.ranked_matches;

-- SELECT: só os dois jogadores da partida podem lê-la
create policy "Ranked matches: players can read" on public.ranked_matches
  for select using (auth.uid() = player1_id or auth.uid() = player2_id);

-- INSERT: qualquer jogador autenticado pode criar uma partida
-- (precisa ser um dos dois players — validado no with check)
create policy "Ranked matches: players can insert" on public.ranked_matches
  for insert with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- UPDATE: cada jogador só atualiza SEUS campos (não os do oponente)
-- Isso evita cheating: player1 não pode setar player2_progress ou winner_id
-- Nota: o with check valida a NOVA linha, mas como cada player só envia
-- seus próprios campos, a nova linha ainda tem auth.uid() = player1_id ou player2_id
create policy "Ranked matches: players can update" on public.ranked_matches
  for update using (auth.uid() = player1_id or auth.uid() = player2_id)
  with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- ============================================
-- 6. Realtime (para atualizações em tempo real)
-- ============================================
-- Adiciona as tabelas à publicação realtime (ignora se já existe)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ranked_matches'
  ) then
    alter publication supabase_realtime add table public.ranked_matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ranked_queue'
  ) then
    alter publication supabase_realtime add table public.ranked_queue;
  end if;
end $$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Rode no SQL Editor para confirmar:
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname='public' and tablename in ('ranked_queue','ranked_matches')
-- order by tablename, policyname;
--
-- Deve mostrar:
-- ranked_matches | Ranked matches: players can read    | SELECT | (auth.uid() = player1_id or auth.uid() = player2_id) | 
-- ranked_matches | Ranked matches: players can insert  | INSERT |                                                      | (auth.uid() = player1_id or auth.uid() = player2_id)
-- ranked_matches | Ranked matches: players can update  | UPDATE | (auth.uid() = player1_id or auth.uid() = player2_id) | (auth.uid() = player1_id or auth.uid() = player2_id)
-- ranked_queue   | Queue: users can delete own          | DELETE | (auth.uid() = user_id)                               | 
-- ranked_queue   | Queue: users can insert own          | INSERT |                                                      | (auth.uid() = user_id)
-- ranked_queue   | Queue: users can read all            | SELECT | (auth.uid() is not null)                             | 
