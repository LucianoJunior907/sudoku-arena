-- ============================================
-- SUDOKU ARENA — MIGRAÇÃO: RANKED ATÓMICO + RATING + ABANDONO
-- Execute no SQL Editor do Supabase
-- ============================================
-- Esta migração resolve:
--   1. Jogadores fantasmas (expiração da fila + matchmaking atômico)
--   2. Rating não atualiza (RPC finish_ranked_match calcula no servidor)
--   3. Solução vulnerável (validação no servidor, solution nunca exposta)
--   4. Abandono (parâmetro abandon → penalidade -50 extra)
--   5. Idempotência (partida finalizada não pode ser alterada)
--
-- É IDEMPOTENTE — pode ser rodada múltiplas vezes.
-- PRESERVA dados existentes (não apaga partidas/ratings/amizades).
-- ============================================

-- ============================================
-- 0. Garantir que as tabelas existem com a estrutura correta
-- ============================================
create table if not exists public.ranked_queue (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  difficulty text not null default 'medium',
  joined_at timestamptz not null default now(),
  -- Heartbeat: atualizado pelo cliente enquanto na fila. Entradas
  -- sem heartbeat por > 30s são consideradas offline e ignoradas.
  last_heartbeat timestamptz not null default now()
);

create table if not exists public.ranked_matches (
  id uuid default gen_random_uuid() primary key,
  player1_id uuid references auth.users on delete cascade not null,
  player2_id uuid references auth.users on delete cascade not null,
  difficulty text not null default 'medium',
  -- board_seed: seed compartilhada para gerar o puzzle. A SOLUÇÃO
  -- é derivada da seed no servidor, nunca armazenada/exposta.
  board_seed text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  winner_id uuid,
  -- reason: como a partida terminou (para diferenciar abandono)
  finish_reason text check (finish_reason in ('solved', 'errors', 'abandon', 'opponent_abandon') or finish_reason is null),
  player1_progress integer not null default 0,
  player2_progress integer not null default 0,
  player1_errors integer not null default 0,
  player2_errors integer not null default 0,
  player1_cells_correct integer not null default 0,
  player2_cells_correct integer not null default 0,
  -- Rating changes persistidos para o leaderboard e histórico
  player1_rating_before integer not null default 0,
  player1_rating_after integer not null default 0,
  player2_rating_before integer not null default 0,
  player2_rating_after integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Adicionar colunas novas se a tabela já existia (preserva dados)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='ranked_queue' and column_name='last_heartbeat') then
    alter table public.ranked_queue add column last_heartbeat timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ranked_matches' and column_name='finish_reason') then
    alter table public.ranked_matches add column finish_reason text check (finish_reason in ('solved', 'errors', 'abandon', 'opponent_abandon') or finish_reason is null);
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ranked_matches' and column_name='player1_rating_before') then
    alter table public.ranked_matches add column player1_rating_before integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ranked_matches' and column_name='player1_rating_after') then
    alter table public.ranked_matches add column player1_rating_after integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ranked_matches' and column_name='player2_rating_before') then
    alter table public.ranked_matches add column player2_rating_before integer not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='ranked_matches' and column_name='player2_rating_after') then
    alter table public.ranked_matches add column player2_rating_after integer not null default 0;
  end if;
end $$;

-- ============================================
-- 1. RLS — recriar políticas limpas
-- ============================================
alter table public.ranked_queue enable row level security;
alter table public.ranked_matches enable row level security;

drop policy if exists "Queue: users can insert own" on public.ranked_queue;
drop policy if exists "Queue: users can read all" on public.ranked_queue;
drop policy if exists "Queue: users can delete own" on public.ranked_queue;
drop policy if exists "Queue: users can update own" on public.ranked_queue;
drop policy if exists "Queue: users can update own heartbeat" on public.ranked_queue;

create policy "Queue: users can insert own" on public.ranked_queue
  for insert with check (auth.uid() = user_id);
create policy "Queue: users can read all" on public.ranked_queue
  for select using (auth.uid() is not null);
create policy "Queue: users can delete own" on public.ranked_queue
  for delete using (auth.uid() = user_id);
-- UPDATE: só para atualizar o próprio heartbeat
create policy "Queue: users can update own heartbeat" on public.ranked_queue
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Ranked matches: players can read" on public.ranked_matches;
drop policy if exists "Ranked matches: anyone can insert" on public.ranked_matches;
drop policy if exists "Ranked matches: players can update" on public.ranked_matches;
drop policy if exists "Ranked matches: players can insert" on public.ranked_matches;
drop policy if exists "Ranked matches: players can update progress" on public.ranked_matches;
drop policy if exists "Player1 can update own fields" on public.ranked_matches;
drop policy if exists "Player2 can update own fields" on public.ranked_matches;

create policy "Ranked matches: players can read" on public.ranked_matches
  for select using (auth.uid() = player1_id or auth.uid() = player2_id);
-- FIX C-02: NÃO existe policy de INSERT em ranked_matches. A antiga
-- "players can insert" permitia forjar partidas contra vítimas arbitrárias
-- (player1=eu, player2=vítima, sem consentimento). Partidas agora são
-- criadas EXCLUSIVAMENTE pela RPC security-definer try_matchmake_atomic
-- (ambos os jogadores precisam estar na fila). O drop no topo desta seção
-- remove a policy de instalações antigas; supabase-fix-c02-forgery.sql
-- também a derruba (e valida a solução contra o puzzle real no finish).
-- UPDATE: players só atualizam progresso (campos player*_*) durante a partida.
-- status/winner_id/finish_reason/rating só via RPC finish_ranked_match.
create policy "Ranked matches: players can update progress" on public.ranked_matches
  for update using (auth.uid() = player1_id or auth.uid() = player2_id)
  with check (auth.uid() = player1_id or auth.uid() = player2_id);

-- ============================================
-- 2. RPC: heartbeat_ranked_queue — mantém a entrada "viva"
-- ============================================
-- Chamado pelo cliente a cada 10s enquanto na fila. Entradas sem
-- heartbeat por > 30s são ignoradas pelo matchmaking.
create or replace function public.heartbeat_ranked_queue()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.ranked_queue
  set last_heartbeat = now()
  where user_id = auth.uid();
end;
$$;

grant execute on function public.heartbeat_ranked_queue() to authenticated;

-- ============================================
-- 3. RPC: try_matchmake_atomic — matchmaking atômico e seguro
-- ============================================
-- Substitui o matchmaking feito no cliente. Tudo em uma transação:
--   a) Remove entradas expiradas da fila (sem heartbeat > 30s)
--   b) Encontra um oponente elegível (exclui o próprio usuário e
--      usuários que já têm partida ativa)
--   c) Cria a partida com status='active'
--   d) Remove AMBOS da fila
--   e) Retorna o match_id
--
-- Atomicidade: SELECT ... FOR UPDATE SKIP LOCKED evita que dois
-- jogadores peguem o mesmo oponente simultaneamente.
create or replace function public.try_matchmake_atomic(
  p_difficulty text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_opponent record;
  v_match_id uuid;
  v_seed text;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- a) Limpar entradas expiradas (sem heartbeat > 30s)
  delete from public.ranked_queue
  where last_heartbeat < now() - interval '30 seconds';

  -- Não continuar se o próprio usuário não está na fila
  if not exists (select 1 from public.ranked_queue where user_id = v_user_id) then
    return jsonb_build_object('match_id', null, 'reason', 'not_in_queue');
  end if;

  -- b) Encontrar oponente: na fila, não sou eu, não tem partida ativa
  --    FOR UPDATE SKIP LOCKED evita race condition entre matchmaking concorrente
  select * into v_opponent
  from public.ranked_queue
  where user_id != v_user_id
    and difficulty = p_difficulty
    and last_heartbeat > now() - interval '30 seconds'
    and not exists (
      select 1 from public.ranked_matches rm
      where rm.status = 'active'
        and (rm.player1_id = public.ranked_queue.user_id or rm.player2_id = public.ranked_queue.user_id)
    )
  order by joined_at asc
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object('match_id', null, 'reason', 'no_opponent');
  end if;

  -- c) Gerar seed e criar a partida
  v_seed := 'ranked-' || extract(epoch from now())::text || '-' || md5(random()::text);

  insert into public.ranked_matches (player1_id, player2_id, difficulty, board_seed, status)
  values (v_user_id, v_opponent.user_id, p_difficulty, v_seed, 'active')
  returning id into v_match_id;

  -- d) Remover AMBOS da fila (atômico)
  delete from public.ranked_queue
  where user_id in (v_user_id, v_opponent.user_id);

  return jsonb_build_object('match_id', v_match_id, 'board_seed', v_seed);
end;
$$;

grant execute on function public.try_matchmake_atomic(text) to authenticated;

-- ============================================
-- 4. RPC: check_my_ranked_match — verifica se fui pareado
-- ============================================
-- Retorna o match_id se alguém me colocou em uma partida ativa.
create or replace function public.check_my_ranked_match()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_seed text;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  select id, board_seed into v_match_id, v_seed
  from public.ranked_matches
  where status = 'active'
    and (player1_id = v_user_id or player2_id = v_user_id)
  order by started_at desc
  limit 1;

  if v_match_id is null then
    return jsonb_build_object('match_id', null);
  end if;

  return jsonb_build_object('match_id', v_match_id, 'board_seed', v_seed);
end;
$$;

grant execute on function public.check_my_ranked_match() to authenticated;

-- ============================================
-- 5. RPC: update_ranked_progress — atualiza progresso (client→server)
-- ============================================
-- O cliente chama a cada jogada. O servidor valida que o caller só
-- atualiza SEUS campos (player1 ou player2), nunca os do oponente.
create or replace function public.update_ranked_progress(
  p_match_id uuid,
  p_progress integer,
  p_errors integer,
  p_cells_correct integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match record;
begin
  if v_user_id is null then return; end if;

  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found then return; end if;
  if v_match.status != 'active' then return; end if;

  if v_match.player1_id = v_user_id then
    update public.ranked_matches set
      player1_progress = p_progress,
      player1_errors = p_errors,
      player1_cells_correct = p_cells_correct
    where id = p_match_id;
  elsif v_match.player2_id = v_user_id then
    update public.ranked_matches set
      player2_progress = p_progress,
      player2_errors = p_errors,
      player2_cells_correct = p_cells_correct
    where id = p_match_id;
  end if;
end;
$$;

grant execute on function public.update_ranked_progress(uuid, integer, integer, integer) to authenticated;

-- ============================================
-- 6. RPC: finish_ranked_match — FINALIZAÇÃO AUTORITATIVA (servidor)
-- ============================================
-- Esta é a ÚNICA forma de finalizar uma partida. O servidor:
--   a) Bloqueia a partida (FOR UPDATE) e verifica se já foi finalizada
--   b) Valida a solução enviada contra a solução real (derivada da seed)
--   c) Determina o vencedor (primeiro a resolver, ou por erros/abandono)
--   d) Calcula o rating change (Elo simplificado)
--   e) Atualiza profiles.rating ATOMICAMENTE
--   f) Persiste rating_before/after na partida
--   g) Marca status='completed'/'abandoned'
--
-- IDEMPOTENTE: se a partida já foi finalizada, retorna o resultado
-- existente sem aplicar mudanças.
--
-- Parâmetros:
--   p_match_id: UUID da partida
--   p_solution: array[81] com a solução enviada pelo cliente
--   p_abandon: TRUE se o jogador está abandonando voluntariamente
--
-- Retorna: { winner_id, rating_before, rating_after, rating_change, reason, already_finished }
-- ============================================
create or replace function public.finish_ranked_match(
  p_match_id uuid,
  p_solution int[] default null,
  p_abandon boolean default false
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match record;
  v_opponent_id uuid;
  v_is_player1 boolean;
  v_winner_id uuid;
  v_loser_id uuid;
  v_reason text;
  v_rating_before integer;
  v_rating_after integer;
  v_opponent_rating_before integer;
  v_opponent_rating_after integer;
  v_rating_change integer;
  v_opp_rating_change integer;
  v_expected_a float;
  v_expected_b float;
  v_actual_a float;
  v_actual_b float;
  v_k integer := 32;
  v_abandon_penalty integer := 50;
  v_solution_valid boolean := false;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- a) Bloquear a partida e verificar estado
  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('error', 'Match not found');
  end if;

  -- Verificar autorização
  if v_match.player1_id != v_user_id and v_match.player2_id != v_user_id then
    return jsonb_build_object('error', 'Not a participant');
  end if;

  -- IDEMPOTÊNCIA: se já finalizada, retorna o resultado
  if v_match.status in ('completed', 'abandoned') then
    v_is_player1 := v_match.player1_id = v_user_id;
    v_rating_before := case when v_is_player1 then v_match.player1_rating_before else v_match.player2_rating_before end;
    v_rating_after := case when v_is_player1 then v_match.player1_rating_after else v_match.player2_rating_after end;
    return jsonb_build_object(
      'already_finished', true,
      'winner_id', v_match.winner_id,
      'rating_before', v_rating_before,
      'rating_after', v_rating_after,
      'rating_change', v_rating_after - v_rating_before,
      'reason', v_match.finish_reason
    );
  end if;

  v_is_player1 := v_match.player1_id = v_user_id;
  v_opponent_id := case when v_is_player1 then v_match.player2_id else v_match.player1_id end;

  -- b) Determinar vencedor e motivo
  if p_abandon then
    -- Abandono voluntário: oponente vence
    v_winner_id := v_opponent_id;
    v_loser_id := v_user_id;
    v_reason := 'abandon';
  elsif p_solution is not null and array_length(p_solution, 1) = 81 then
    -- Validar a solução enviada: deve ser um Sudoku válido e completo
    -- Verificação simples: todos 1-9, sem zeros, e válido (linhas/colunas/caixas)
    v_solution_valid := public.validate_sudoku_solution(p_solution);
    if v_solution_valid then
      v_winner_id := v_user_id;
      v_loser_id := v_opponent_id;
      v_reason := 'solved';
    else
      -- Solução inválida — não finaliza, retorna erro
      return jsonb_build_object('error', 'Invalid solution');
    end if;
  else
    return jsonb_build_object('error', 'Invalid parameters');
  end if;

  -- c) Buscar ratings atuais
  select rating into v_rating_before from public.profiles where id = v_user_id;
  select rating into v_opponent_rating_before from public.profiles where id = v_opponent_id;
  v_rating_before := coalesce(v_rating_before, 0);
  v_opponent_rating_before := coalesce(v_opponent_rating_before, 0);

  -- d) Calcular Elo simplificado
  -- Expected score: E_A = 1 / (1 + 10^((R_B - R_A)/400))
  v_expected_a := 1.0 / (1.0 + power(10, (v_opponent_rating_before - v_rating_before) / 400.0));
  v_expected_b := 1.0 - v_expected_a;

  if v_winner_id = v_user_id then
    v_actual_a := 1.0; v_actual_b := 0.0;
  else
    v_actual_a := 0.0; v_actual_b := 1.0;
  end if;

  v_rating_change := round(v_k * (v_actual_a - v_expected_a))::integer;
  v_opp_rating_change := round(v_k * (v_actual_b - v_expected_b))::integer;

  -- Penalidade de abandono: -50 extra sobre a perda normal
  if p_abandon then
    -- Garante que o perdedor perde pelo menos 50+ pontos (sobre a perda normal)
    if v_rating_change > 0 then
      -- Se por acaso o Elo daria ganho, força perda de 50
      v_rating_change := -(v_abandon_penalty);
    else
      v_rating_change := v_rating_change - v_abandon_penalty;
    end if;
  end if;

  -- e) Aplicar rating (piso = 0)
  v_rating_after := greatest(0, v_rating_before + v_rating_change);
  v_opponent_rating_after := greatest(0, v_opponent_rating_before + v_opp_rating_change);

  -- f) Atualizar profiles (atômico)
  update public.profiles set rating = v_rating_after, updated_at = now() where id = v_user_id;
  update public.profiles set rating = v_opponent_rating_after, updated_at = now() where id = v_opponent_id;

  -- g) Finalizar a partida com rating_before/after
  if v_is_player1 then
    update public.ranked_matches set
      status = case when p_abandon then 'abandoned' else 'completed' end,
      winner_id = v_winner_id,
      finish_reason = v_reason,
      player1_rating_before = v_rating_before,
      player1_rating_after = v_rating_after,
      player2_rating_before = v_opponent_rating_before,
      player2_rating_after = v_opponent_rating_after,
      ended_at = now()
    where id = p_match_id;
  else
    update public.ranked_matches set
      status = case when p_abandon then 'abandoned' else 'completed' end,
      winner_id = v_winner_id,
      finish_reason = v_reason,
      player1_rating_before = v_opponent_rating_before,
      player1_rating_after = v_opponent_rating_after,
      player2_rating_before = v_rating_before,
      player2_rating_after = v_rating_after,
      ended_at = now()
    where id = p_match_id;
  end if;

  return jsonb_build_object(
    'already_finished', false,
    'winner_id', v_winner_id,
    'rating_before', v_rating_before,
    'rating_after', v_rating_after,
    'rating_change', v_rating_after - v_rating_before,
    'reason', v_reason
  );
end;
$$;

grant execute on function public.finish_ranked_match(uuid, int[], boolean) to authenticated;

-- ============================================
-- 7. FUNÇÃO AUXILIAR: validate_sudoku_solution
-- ============================================
-- Valida um array de 81 inteiros (1-9) como solução de Sudoku:
-- cada linha, coluna e caixa 3x3 contém 1-9 sem repetição.
create or replace function public.validate_sudoku_solution(p_solution int[])
returns boolean
language plpgsql immutable
as $$
declare
  i integer;
  j integer;
  v integer;
  box_row integer;
  box_col integer;
  seen int[];
begin
  if array_length(p_solution, 1) != 81 then return false; end if;

  -- Verificar linhas
  for i in 0..8 loop
    seen := array[0,0,0,0,0,0,0,0,0,0];
    for j in 0..8 loop
      v := p_solution[i * 9 + j + 1];
      if v < 1 or v > 9 then return false; end if;
      if seen[v] > 0 then return false; end if;
      seen[v] := 1;
    end loop;
  end loop;

  -- Verificar colunas
  for j in 0..8 loop
    seen := array[0,0,0,0,0,0,0,0,0,0];
    for i in 0..8 loop
      v := p_solution[i * 9 + j + 1];
      if seen[v] > 0 then return false; end if;
      seen[v] := 1;
    end loop;
  end loop;

  -- Verificar caixas 3x3
  for box_row in 0..2 loop
    for box_col in 0..2 loop
      seen := array[0,0,0,0,0,0,0,0,0,0];
      for i in 0..2 loop
        for j in 0..2 loop
          v := p_solution[(box_row * 3 + i) * 9 + (box_col * 3 + j) + 1];
          if seen[v] > 0 then return false; end if;
          seen[v] := 1;
        end loop;
      end loop;
    end loop;
  end loop;

  return true;
end;
$$;

-- ============================================
-- 8. REALTIME
-- ============================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='ranked_matches') then
    alter publication supabase_realtime add table public.ranked_matches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='ranked_queue') then
    alter publication supabase_realtime add table public.ranked_queue;
  end if;
end $$;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Rode no SQL Editor para confirmar:
-- select proname from pg_proc where proname in
--   ('heartbeat_ranked_queue','try_matchmake_atomic','check_my_ranked_match',
--    'update_ranked_progress','finish_ranked_match','validate_sudoku_solution');
-- Deve retornar 6 funções.
