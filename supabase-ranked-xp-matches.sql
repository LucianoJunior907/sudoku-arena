-- ============================================
-- SUDOKU ARENA — FIX: ranked conta como partida + XP + leaderboard
-- Execute no SQL Editor do Supabase
-- ============================================
-- Este script atualiza finish_ranked_match para:
--   1. Salvar a partida na tabela `matches` (conta como "partida jogada")
--   2. Calcular e persistir XP no profile (total_xp, level)
--   3. Atualizar rating (já fazia, mantido)
--   4. Tudo atômico e idempotente
--   5. FIX C-05: liberar os campos protegidos via GUC transação-scoped
--      (sem isso, o trigger protect_profile reverte rating/XP/level —
--      a partida gravava rating_after mas o profile ficava zerado)
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
    v_solution_valid := public.validate_sudoku_solution(p_solution);
    if v_solution_valid then
      v_winner_id := v_user_id;
      v_loser_id := v_opponent_id;
      v_reason := 'solved';
      v_completed := true;
      v_errors := case when v_is_player1 then v_match.player1_errors else v_match.player2_errors end;
    else
      return jsonb_build_object('error', 'Invalid solution');
    end if;
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
  -- quando o GUC 'app.skip_profile_protection' não é 'true'. Sem esta liberação,
  -- os updates abaixo eram silenciosamente revertidos e o progresso do ranked
  -- nunca persistia (leaderboard sempre 0).
  -- A liberação usa escopo de TRANSAÇÃO (3º argumento = true): expira sozinha
  -- no COMMIT/ROLLBACK, sem nunca deixar a sessão desprotegida.
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
  -- NOTA: variáveis calculadas inline (sem sub-bloco DECLARE, que só
  -- pode aparecer no início de um BEGIN...END em PL/pgSQL).
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
-- VERIFICAÇÃO
-- ============================================
-- Rode no SQL Editor:
-- select proname, proargnames from pg_proc where proname = 'finish_ranked_match';
