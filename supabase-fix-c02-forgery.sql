-- ============================================
-- SUDOKU ARENA — FIX C-02: partidas ranked forjadas + vitória com grid qualquer
-- ============================================
-- PROBLEMA (bug C-02 da auditoria, CONFIRMADO no banco em 29/10/2026):
--   (a) A policy "Ranked matches: players can insert" permitia que QUALQUER
--       usuário autenticado inserisse uma partida ranked com
--       player1=eu, player2=VÍTIMA_ARBITRÁRIA, status='active' — vítimas
--       colhíveis do leaderboard público, sem consentimento nenhum.
--   (b) A RPC finish_ranked_match validava apenas que o array de 81 era um
--       sudoku CONSISTENTE (validate_sudoku_solution) — nunca comparava com
--       a solução REAL derivada da board_seed da partida. Qualquer grid
--       completo válido (um sudoku clássico conhecido, ou um gerado por
--       script) vencia a partida e manipulava o rating de ambos.
--   Combinando (a)+(b): +32 Elo por chamada contra qualquer uuid,
--   ilimitado; a vítima perdia rating sem nunca ter jogado.
--   A tabela match_solutions (supabase-security.sql, RLS deny-all) existia
--   vazia — nunca era usada (bug D-02 registrado).
--
-- CORREÇÃO:
--   1. DROP das policies de INSERT em ranked_matches — partidas passam a ser
--      criadas EXCLUSIVAMENTE pela RPC security-definer try_matchmake_atomic
--      (matchmaking real: ambos os jogadores estão na fila por consentimento).
--   2. Porte fiel do gerador determinístico do cliente (mulberry32 + FNV-1a
--      + Fisher-Yates + backtracking de src/lib/sudoku/engine.ts) para
--      PL/pgSQL: generate_solved_board(seed) reproduz BIT A BIT a solução
--      que o cliente deriva da board_seed pública.
--   3. try_matchmake_atomic agora PRÉ-COMPUTA a solução no servidor e grava
--      em match_solutions (blindada: RLS sem nenhuma policy + revoke).
--      Falha na pré-computação NUNCA quebra o matchmaking (exception
--      handler) — finish re-deriva da seed como fallback.
--   4. finish_ranked_match agora exige que o grid enviado SEJA a solução
--      real da partida: validação estrutural (validate_sudoku_solution,
--      mantida) + comparação cell a cell com a solução armazenada (ou
--      derivada da seed). Um sudoku válido qualquer não vence mais.
--   5. Este arquivo SUPERSEDE o finish_ranked_match de
--      supabase-ranked-xp-matches.sql (mantém o FIX C-05 — GUC
--      app.skip_profile_protection transaction-scoped — e todo o cálculo de
--      XP/level/matches) e o try_matchmake_atomic de
--      supabase-ranked-overhaul.sql. Deve rodar DEPOIS deles no runner.
--
-- TRANSIÇÃO:
--   - Nenhuma mudança de frontend é necessária: o cliente continua enviando
--     o tabuleiro completo em p_solution; partidas legítimas passam
--     inalteradas (mesmo algoritmo nos dois lados). O fluxo de matchmaking
--     (fila → try_matchmake_atomic / check_my_ranked_match) e o fluxo de
--     abandono são preservados. Como o fix é server-side only, entra em
--     vigor imediatamente após esta migration — sem deploy no Vercel.
--   - Partidas ativas criadas antes desta migration: verificadas 0 em
--     29/10/2026. Se existissem, o fallback cobre (match_solutions vazio →
--     deriva da board_seed atual da partida).
--
-- IDEMPOTENTE — seguro re-executar (padrão dos demais arquivos do runner).
-- ============================================

-- ============================================
-- 1. match_solutions — infraestrutura blindada (bug D-02)
-- ============================================
-- Mesma estrutura do supabase-security.sql. RLS ligado SEM nenhuma policy:
-- cliente não lê nem escreve (deny-all). Apenas RPCs security-definer
-- (owner postgres, que não sofre RLS) acessam.
create table if not exists public.match_solutions (
  match_id uuid default gen_random_uuid() primary key,
  board_seed text not null,
  solution text not null, -- solução completa como string de 81 chars
  difficulty text not null,
  created_at timestamptz not null default now()
);

alter table public.match_solutions enable row level security;
revoke all on public.match_solutions from anon, authenticated;

-- ============================================
-- 2. Remover policies de INSERT em ranked_matches (FIX C-02 vetor "a")
-- ============================================
-- Inserção direta permitia forjar partidas contra vítimas arbitrárias.
-- Agora apenas a RPC security-definer try_matchmake_atomic cria partidas
-- (exigindo que AMBOS os jogadores estejam na fila = consentimento).
drop policy if exists "Ranked matches: anyone can insert" on public.ranked_matches;
drop policy if exists "Ranked matches: players can insert" on public.ranked_matches;

-- ============================================
-- 3. HELPERS INTERNOS — porte bit-a-bit do engine do cliente
-- ============================================
-- Reproduzem src/lib/sudoku/engine.ts (mulberry32 / hashStringToSeed).
-- IMPORTANTE: arithmetic de 32 bits em UNSIGNED (0..2^32-1) — todos os
-- steps do mulberry32 são congruentes mod 2^32, então rastrear unsigned dá
-- bit patterns idênticos aos do JS (que trabalha com int32 signed).
-- NÃO expostos: revoke execute de public no final do arquivo.

-- Multiplicação 32-bit com wraparound (Math.imul do JS).
-- Via numeric para evitar overflow de bigint ((2^32-1)^2 > max bigint).
create or replace function public.imul32(p_a bigint, p_b bigint)
returns bigint
language sql
immutable
as $$
  select ((p_a::numeric * p_b::numeric) % 4294967296::numeric)::bigint;
$$;

-- mulberry32: avanço do estado. JS: a = (a + 0x6d2b79f5) | 0.
create or replace function public.mb_next_state(p_state bigint)
returns bigint
language sql
immutable
as $$
  select (p_state + 1831565813) % 4294967296;
$$;

-- mulberry32: draw ∈ [0,1) a partir do estado JÁ AVANÇADO.
-- JS: t = a;
--     t = Math.imul(t ^ (t >>> 15), t | 1);
--     t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
--     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
-- >>> n (logical shift) = divisão inteira por 2^n no valor unsigned.
create or replace function public.mb_rand(p_state bigint)
returns double precision
language plpgsql
immutable
as $$
declare
  v_t bigint;
  v_x bigint;
  v_m bigint;
begin
  v_t := p_state;
  v_x := v_t # (v_t / 32768);            -- t ^ (t >>> 15)
  v_t := public.imul32(v_x, v_t | 1);    -- Math.imul(x, t | 1)
  v_x := v_t # (v_t / 128);             -- t ^ (t >>> 7)
  v_m := public.imul32(v_x, v_t | 61);   -- Math.imul(x, t | 61)
  v_t := v_t # ((v_t + v_m) % 4294967296); -- t ^= t + m (mod 2^32)
  return (v_t # (v_t / 16384))::double precision
         / 4294967296::double precision; -- ((t ^ (t >>> 14)) >>> 0) / 2^32
end;
$$;

-- FNV-1a 32-bit do cliente (hashStringToSeed do engine.ts).
-- JS percorre UTF-16 code units; as board_seeds são sempre ASCII puro
-- (geradas pelo servidor: 'ranked-' || epoch || '-' || md5), onde
-- ascii(substr(...)) é idêntico a charCodeAt(i).
create or replace function public.hash_string_to_seed(p_str text)
returns bigint
language plpgsql
immutable
as $$
declare
  v_h bigint := 2166136261; -- 0x811c9dc5
  v_i integer;
begin
  if p_str is null then
    return 0;
  end if;
  for v_i in 1..length(p_str) loop
    v_h := v_h # ascii(substr(p_str, v_i, 1));
    v_h := public.imul32(v_h, 16777619); -- 0x01000193
  end loop;
  return v_h;
end;
$$;

-- ============================================
-- 4. generate_solved_board — o gerador determinístico (porta do engine.ts)
-- ============================================
-- Reproduz EXATAMENTE generateSolvedBoard(seed) do cliente:
--   1. rng = mulberry32(hashStringToSeed(seed))
--   2. Preenche as caixas diagonais 0, 4, 8 com [1..9] embaralhado
--      (Fisher-Yates descendente: j = floor(rng() * (i+1)))
--   3. Completa o resto com backtracking que tenta os dígitos na ordem de
--      UMA shuffle por invocação de fillBoard (consumo de rng idêntico ao JS)
-- Retorno: int[81] 1-based — índice i guarda a célula 0-based (i-1), mesma
-- convenção do array que o cliente envia em p_solution.
create or replace function public.generate_solved_board(p_seed text)
returns int[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_state  bigint;
  v_r      double precision;
  v_board  int[];
  v_digits int[];
  v_i      integer;
  v_j      integer;
  v_d      integer;
  v_row    integer;
  v_col    integer;
  v_k      integer;
  v_box    integer;
  v_br     integer;
  v_bc     integer;
  -- Pilha iterativa do backtracking (o JS usa recursão; aqui é explícita):
  --   frame f: célula (0-based) em v_st_idx[f], posição em v_st_pos[f],
  --   9 dígitos do frame em v_st_dig[(f-1)*9 + 1 .. (f-1)*9 + 9]
  v_st_idx  int[] := array_fill(0, array[60]);
  v_st_pos  int[] := array_fill(0, array[60]);
  v_st_dig  int[] := array_fill(0, array[540]);
  v_depth   integer := 0;
  v_next    integer;
  v_advanced boolean;
  v_can      boolean;
begin
  if p_seed is null then
    return null;
  end if;

  v_board := array_fill(0, array[81]);
  v_state := public.hash_string_to_seed(p_seed);

  -- Passo 1: caixas diagonais 0, 4, 8 (mesma ordem row-major do BOX_INDEX)
  for v_box in 0..8 by 4 loop
    -- shuffle([1..9], rng) — Fisher-Yates descendente do cliente
    v_digits := array[1,2,3,4,5,6,7,8,9];
    for v_i in reverse 8..1 loop
      v_state := public.mb_next_state(v_state);
      v_r := public.mb_rand(v_state);
      v_j := floor(v_r * (v_i + 1))::integer; -- índice 0-based ∈ [0..i]
      v_d := v_digits[v_i + 1];
      v_digits[v_i + 1] := v_digits[v_j + 1];
      v_digits[v_j + 1] := v_d;
    end loop;
    -- cells.forEach((cell, i) => board[cell] = digits[i])
    v_k := 1;
    for v_row in 3 * (v_box / 3) .. 3 * (v_box / 3) + 2 loop
      for v_col in 3 * (v_box % 3) .. 3 * (v_box % 3) + 2 loop
        v_board[v_row * 9 + v_col + 1] := v_digits[v_k];
        v_k := v_k + 1;
      end loop;
    end loop;
  end loop;

  -- Passo 2: fillBoard — achar a primeira célula vazia
  v_next := -1;
  for v_i in 1..81 loop
    if v_board[v_i] = 0 then
      v_next := v_i - 1;
      exit;
    end if;
  end loop;
  if v_next = -1 then
    return v_board;
  end if;

  -- Push do primeiro frame (UMA shuffle na entrada, como no JS)
  v_digits := array[1,2,3,4,5,6,7,8,9];
  for v_i in reverse 8..1 loop
    v_state := public.mb_next_state(v_state);
    v_r := public.mb_rand(v_state);
    v_j := floor(v_r * (v_i + 1))::integer;
    v_d := v_digits[v_i + 1];
    v_digits[v_i + 1] := v_digits[v_j + 1];
    v_digits[v_j + 1] := v_d;
  end loop;
  v_depth := 1;
  v_st_idx[v_depth] := v_next;
  v_st_pos[v_depth] := 1;
  for v_i in 1..9 loop
    v_st_dig[(v_depth - 1) * 9 + v_i] := v_digits[v_i];
  end loop;

  -- Loop principal do backtracking iterativo
  loop
    if v_depth = 0 then
      return null; -- insolúvel (não deve ocorrer com caixa diagonal cheia)
    end if;

    v_advanced := false;
    while v_st_pos[v_depth] <= 9 loop
      v_d := v_st_dig[(v_depth - 1) * 9 + v_st_pos[v_depth]];
      v_st_pos[v_depth] := v_st_pos[v_depth] + 1;

      -- canPlace(board, idx, d): linha, coluna e caixa 3x3
      v_row := v_st_idx[v_depth] / 9;
      v_col := v_st_idx[v_depth] % 9;
      v_can := true;
      for v_i in 0..8 loop
        if v_board[v_row * 9 + v_i + 1] = v_d
           or v_board[v_i * 9 + v_col + 1] = v_d then
          v_can := false;
          exit;
        end if;
      end loop;
      if v_can then
        v_br := v_row - (v_row % 3);
        v_bc := v_col - (v_col % 3);
        for v_i in 0..2 loop
          exit when not v_can;
          for v_j in 0..2 loop
            if v_board[(v_br + v_i) * 9 + (v_bc + v_j) + 1] = v_d then
              v_can := false;
              exit;
            end if;
          end loop;
        end loop;
      end if;

      if v_can then
        -- board[idx] = d e "recursa": achar a próxima célula vazia
        v_board[v_st_idx[v_depth] + 1] := v_d;
        v_next := -1;
        for v_i in 1..81 loop
          if v_board[v_i] = 0 then
            v_next := v_i - 1;
            exit;
          end if;
        end loop;
        if v_next = -1 then
          return v_board; -- completo (o JS retorna true sem consumir rng)
        end if;

        -- Push do próximo frame (UMA shuffle na entrada)
        v_digits := array[1,2,3,4,5,6,7,8,9];
        for v_i in reverse 8..1 loop
          v_state := public.mb_next_state(v_state);
          v_r := public.mb_rand(v_state);
          v_j := floor(v_r * (v_i + 1))::integer;
          v_d := v_digits[v_i + 1];
          v_digits[v_i + 1] := v_digits[v_j + 1];
          v_digits[v_j + 1] := v_d;
        end loop;
        v_depth := v_depth + 1;
        v_st_idx[v_depth] := v_next;
        v_st_pos[v_depth] := 1;
        for v_i in 1..9 loop
          v_st_dig[(v_depth - 1) * 9 + v_i] := v_digits[v_i];
        end loop;
        v_advanced := true;
        exit; -- processa o novo frame
      end if;
    end loop;

    if not v_advanced then
      -- Frame esgotou: pop e desfaz a tentativa do pai (board[idx] = 0)
      v_depth := v_depth - 1;
      if v_depth = 0 then
        return null;
      end if;
      v_board[v_st_idx[v_depth] + 1] := 0;
      -- o pai continua seu for-loop de onde parou (posição já avançada)
    end if;
  end loop;
end;
$$;

-- ============================================
-- 5. solution_matches_match — compara o grid enviado com a solução REAL
-- ============================================
-- Aceita se o grid for igual à solução armazenada no matchmake OU à
-- derivada da board_seed atual (fallback; também cobre o caso D-03 de a
-- seed ter sido reescrita por UPDATE direto — o oponente legítimo ainda
-- termina com o tabuleiro que ele gerou ao entrar na partida).
-- Em ambos os casos o grid TEM que ser a solução real de um Sudoku desta
-- partida — um sudoku válido qualquer nunca passa.
create or replace function public.solution_matches_match(
  p_match_id uuid,
  p_board_seed text,
  p_solution int[]
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_stored  text;
  v_expected int[];
  v_matched boolean;
  v_i       integer;
begin
  if p_solution is null or coalesce(array_length(p_solution, 1), 0) <> 81 then
    return false;
  end if;

  -- 1) Solução pré-computada no matchmake (tabela blindada)
  select ms.solution into v_stored
  from public.match_solutions ms
  where ms.match_id = p_match_id;

  if v_stored is not null and length(v_stored) = 81 then
    v_matched := true;
    for v_i in 1..81 loop
      if coalesce(p_solution[v_i], -1)
         <> ascii(substr(v_stored, v_i, 1)) - 48 then
        v_matched := false;
        exit;
      end if;
    end loop;
    if v_matched then
      return true;
    end if;
  end if;

  -- 2) Fallback: deriva da board_seed atual no servidor
  v_expected := public.generate_solved_board(p_board_seed);
  if v_expected is null then
    return false;
  end if;
  for v_i in 1..81 loop
    if coalesce(p_solution[v_i], -1) <> coalesce(v_expected[v_i], -1) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- ============================================
-- 6. try_matchmake_atomic v2 — pré-computa e guarda a solução (FIX C-02)
-- ============================================
-- Mesmo corpo da versão do supabase-ranked-overhaul.sql, com UMA adição:
-- grava a solução real em match_solutions. O resto (limpeza da fila,
-- SKIP LOCKED, remoção atômica de AMBOS da fila) é preservado.
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

  -- FIX C-02: pré-computa a solução REAL no servidor e grava em
  -- match_solutions (RLS deny-all + revoke: nenhum cliente lê/escreve).
  -- Exception handler: o matchmaking NUNCA quebra por falha na
  -- pré-computação — finish_ranked_match re-deriva da seed como fallback.
  begin
    insert into public.match_solutions (match_id, board_seed, solution, difficulty)
    values (
      v_match_id,
      v_seed,
      array_to_string(public.generate_solved_board(v_seed), ''),
      p_difficulty
    );
  exception when others then
    raise warning 'C-02: falha ao pré-computar solução do match %', v_match_id;
  end;

  -- d) Remover AMBOS da fila (atômico)
  delete from public.ranked_queue
  where user_id in (v_user_id, v_opponent.user_id);

  return jsonb_build_object('match_id', v_match_id, 'board_seed', v_seed);
end;
$$;

grant execute on function public.try_matchmake_atomic(text) to authenticated;

-- ============================================
-- 7. finish_ranked_match v3 — FIX C-02 (validação contra o puzzle real)
-- ============================================
-- Base: versão do supabase-ranked-xp-matches.sql (inclui o FIX C-05 — GUC
-- app.skip_profile_protection transaction-scoped — e todo o cálculo de
-- XP/level/inserts em matches). Adição C-02: a solução enviada precisa ser
-- a solução REAL da partida (armazenada no matchmake ou derivada da seed).
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
  v_xp integer := 0;
  v_opp_xp integer := 0;
  v_old_total_xp integer;
  v_new_total_xp integer;
  v_opp_old_total_xp integer;
  v_opp_new_total_xp integer;
  v_level integer;
  v_opp_level integer;
  v_elapsed_sec integer;
  v_errors integer;
  v_completed boolean;
  v_difficulty text;
  v_rem integer;       -- temporário para cálculo de level
  v_opp_rem integer;   -- temporário para cálculo de level do oponente
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- a) Bloquear a partida e verificar estado
  select * into v_match from public.ranked_matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('error', 'Match not found');
  end if;

  -- Verificar autorização (jogador participa da partida)
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
  v_difficulty := v_match.difficulty;
  v_elapsed_sec := extract(epoch from (now() - v_match.started_at))::integer;

  -- b) Determinar vencedor e motivo
  if p_abandon then
    v_winner_id := v_opponent_id;
    v_loser_id := v_user_id;
    v_reason := 'abandon';
    v_completed := false;
    v_errors := 3;
  elsif p_solution is not null and array_length(p_solution, 1) = 81 then
    -- FIX C-02 (etapa 1): validação estrutural — grid é um sudoku consistente
    v_solution_valid := public.validate_sudoku_solution(p_solution);
    if not v_solution_valid then
      return jsonb_build_object('error', 'Invalid solution');
    end if;

    -- FIX C-02 (etapa 2 — NOVO): o grid precisa ser a solução REAL desta
    -- partida — a mesma que o servidor derivou da board_seed no matchmake
    -- (ou deriva agora, como fallback). Antes, QUALQUER sudoku válido
    -- vencia a partida e manipulava o rating do oponente (bug C-02).
    if not public.solution_matches_match(p_match_id, v_match.board_seed, p_solution) then
      return jsonb_build_object('error', 'Invalid solution');
    end if;

    v_winner_id := v_user_id;
    v_loser_id := v_opponent_id;
    v_reason := 'solved';
    v_completed := true;
    v_errors := case when v_is_player1 then v_match.player1_errors else v_match.player2_errors end;
  else
    return jsonb_build_object('error', 'Invalid parameters');
  end if;

  -- c) Buscar ratings e XP atuais
  select rating, total_xp, level into v_rating_before, v_old_total_xp, v_level
  from public.profiles where id = v_user_id;
  select rating, total_xp, level into v_opponent_rating_before, v_opp_old_total_xp, v_opp_level
  from public.profiles where id = v_opponent_id;
  v_rating_before := coalesce(v_rating_before, 0);
  v_opponent_rating_before := coalesce(v_opponent_rating_before, 0);
  v_old_total_xp := coalesce(v_old_total_xp, 0);
  v_opp_old_total_xp := coalesce(v_opp_old_total_xp, 0);
  v_level := coalesce(v_level, 1);
  v_opp_level := coalesce(v_opp_level, 1);

  -- d) Calcular Elo simplificado
  v_expected_a := 1.0 / (1.0 + power(10, (v_opponent_rating_before - v_rating_before) / 400.0));
  v_expected_b := 1.0 - v_expected_a;

  if v_winner_id = v_user_id then
    v_actual_a := 1.0; v_actual_b := 0.0;
  else
    v_actual_a := 0.0; v_actual_b := 1.0;
  end if;

  v_rating_change := round(v_k * (v_actual_a - v_expected_a))::integer;
  v_opp_rating_change := round(v_k * (v_actual_b - v_expected_b))::integer;

  -- Penalidade de abandono: -50 extra
  if p_abandon then
    if v_rating_change > 0 then
      v_rating_change := -(v_abandon_penalty);
    else
      v_rating_change := v_rating_change - v_abandon_penalty;
    end if;
  end if;

  -- e) Aplicar rating (piso = 0)
  v_rating_after := greatest(0, v_rating_before + v_rating_change);
  v_opponent_rating_after := greatest(0, v_opponent_rating_before + v_opp_rating_change);

  -- f) Calcular XP (baseado no resultado + difficulty)
  -- Vitória: 60-120 XP dependendo da difficulty. Derrota: 10-20 XP (participação).
  -- Abandono: 5 XP (participação mínima).
  if v_reason = 'solved' then
    v_xp := case v_difficulty
      when 'easy' then 60
      when 'medium' then 80
      when 'hard' then 100
      when 'expert' then 120
      else 80
    end;
    -- Bônus por velocidade (até +50% se resolver rápido)
    if v_elapsed_sec < 300 then
      v_xp := v_xp + round(v_xp * 0.5)::integer;
    elsif v_elapsed_sec < 600 then
      v_xp := v_xp + round(v_xp * 0.25)::integer;
    end if;
    -- Penalidade por erros
    v_xp := v_xp - (v_errors * 5);
    v_xp := greatest(30, v_xp);
  elsif v_reason = 'abandon' then
    v_xp := 5;
  else
    v_xp := 15; -- derrota por erros
  end if;

  -- Oponente: vitória ganha XP, derrota ganha menos
  if v_winner_id = v_opponent_id then
    v_opp_xp := case v_difficulty
      when 'easy' then 60
      when 'medium' then 80
      when 'hard' then 100
      when 'expert' then 120
      else 80
    end;
    v_opp_xp := greatest(30, v_opp_xp);
  else
    v_opp_xp := 15;
  end if;

  v_new_total_xp := v_old_total_xp + v_xp;
  v_opp_new_total_xp := v_opp_old_total_xp + v_opp_xp;

  -- Recalcular level (100 + level*50 XP por nível)
  v_level := 1;
  v_rem := v_new_total_xp;
  while v_rem >= (100 + v_level * 50) loop
    v_rem := v_rem - (100 + v_level * 50);
    v_level := v_level + 1;
  end loop;

  v_opp_level := 1;
  v_opp_rem := v_opp_new_total_xp;
  while v_opp_rem >= (100 + v_opp_level * 50) loop
    v_opp_rem := v_opp_rem - (100 + v_opp_level * 50);
    v_opp_level := v_opp_level + 1;
  end loop;

  -- g) Atualizar profiles (rating + XP + level) ATOMICAMENTE
  -- FIX C-05: o trigger protect_profile (instalado por supabase-security.sql)
  -- reverte rating/total_xp/level/streak_freezes em QUALQUER update de profiles
  -- quando o GUC 'app.skip_profile_protection' não é 'true'. A liberação usa
  -- escopo de TRANSAÇÃO (3º argumento = true): expira sozinha no COMMIT/
  -- ROLLBACK, sem nunca deixar a sessão desprotegida.
  perform set_config('app.skip_profile_protection', 'true', true);

  update public.profiles set
    rating = v_rating_after,
    total_xp = v_new_total_xp,
    level = v_level,
    updated_at = now()
  where id = v_user_id;

  update public.profiles set
    rating = v_opponent_rating_after,
    total_xp = v_opp_new_total_xp,
    level = v_opp_level,
    updated_at = now()
  where id = v_opponent_id;

  -- Fecha a janela de autorização dentro desta transação (defesa em
  -- profundidade; com is_local=true o valor expiraria no COMMIT de todo modo)
  perform set_config('app.skip_profile_protection', 'false', true);

  -- h) Salvar na tabela `matches` (conta como partida jogada + XP)
  -- Para o usuário atual
  insert into public.matches (user_id, mode, difficulty, elapsed_sec, errors, hints_used, completed, xp_earned, score, is_record)
  values (v_user_id, 'ranked', v_difficulty, v_elapsed_sec, v_errors, 0, v_completed, v_xp, v_rating_after, false);

  -- Para o oponente (também conta como partida)
  insert into public.matches (user_id, mode, difficulty, elapsed_sec, errors, hints_used, completed, xp_earned, score, is_record)
  values (
    v_opponent_id, 'ranked', v_difficulty, v_elapsed_sec,
    case when v_is_player1 then v_match.player2_errors else v_match.player1_errors end,
    0,
    (v_winner_id = v_opponent_id),
    v_opp_xp, v_opponent_rating_after, false
  );

  -- i) Finalizar a partida com rating_before/after
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
    'xp_earned', v_xp,
    'total_xp', v_new_total_xp,
    'level', v_level,
    'reason', v_reason
  );
end;
$$;

grant execute on function public.finish_ranked_match(uuid, int[], boolean) to authenticated;

-- ============================================
-- 8. ACL — helpers internos NÃO são API pública
-- ============================================
-- O PostgreSQL concede EXECUTE para PUBLIC por default em funções, E o
-- Supabase aplica ALTER DEFAULT PRIVILEGES concedendo explicitamente para
-- anon/authenticated/service_role (constatado no proacl após aplicar só o
-- revoke de public). Revogamos TODAS as roles externas: só o owner
-- (postgres) — e, portanto, as RPCs security-definer — pode usá-los.
-- generate_solved_board/solution_matches_match ficam INACESSÍVEIS via
-- PostgREST (nem como oráculo de solução).
revoke execute on function public.imul32(bigint, bigint) from public, anon, authenticated, service_role;
revoke execute on function public.mb_next_state(bigint) from public, anon, authenticated, service_role;
revoke execute on function public.mb_rand(bigint) from public, anon, authenticated, service_role;
revoke execute on function public.hash_string_to_seed(text) from public, anon, authenticated, service_role;
revoke execute on function public.generate_solved_board(text) from public, anon, authenticated, service_role;
revoke execute on function public.solution_matches_match(uuid, text, int[]) from public, anon, authenticated, service_role;

-- ============================================
-- VERIFICAÇÃO (SQL Editor)
-- ============================================
-- 1) Nenhuma policy de INSERT em ranked_matches:
--    select polname, polcmd from pg_policy
--    where polrelid = 'public.ranked_matches'::regclass order by polname;
--    → apenas SELECT ('r') e UPDATE ('w'); nenhum 'a'.
-- 2) Puzzle-check ativo no finish:
--    select pg_get_functiondef('public.finish_ranked_match(uuid, int[], boolean)'::regprocedure)
--    like '%solution_matches_match%';   → true
-- 3) Solução guardada no matchmake:
--    select pg_get_functiondef('public.try_matchmake_atomic(text)'::regprocedure)
--    like '%match_solutions%';          → true
-- 4) Helpers não expostos:
--    select has_function_privilege('authenticated', 'public.generate_solved_board(text)', 'execute');  → false
-- 5) Paridade com o cliente (rode o engine.ts com a MESMA seed e compare):
--    select public.generate_solved_board('teste-paridade') = ARRAY[...81 ints...];
