-- ============================================
-- SUDOKU ARENA — FIX C-04: XP infinito via submit_match_result
-- ============================================
-- PROBLEMA (bug C-04 da auditoria):
--   A RPC public.submit_match_result(...) é SECURITY DEFINER e está
--   concedida a `authenticated` (supabase-security.sql:182). Aceitava
--   p_xp_earned informado pelo cliente SEM teto e somava direto em
--   profiles.total_xp / level. Únicos bounds validados: elapsed ≤3600s,
--   errors ≤100 (supabase-security.sql:129-134). O próprio comentário
--   do SQL admitia a confiança (linhas 136-139 do arquivo original).
--
--   Vetor (qualquer usuário autenticado):
--     POST /rest/v1/rpc/submit_match_result
--     {"p_mode":"solo","p_difficulty":"expert","p_elapsed_sec":60,
--      "p_errors":0,"p_hints_used":0,"p_completed":true,
--      "p_xp_earned":999999, ...}
--   em loop = XP/level infinitos (afeta perfil, cosméticos,
--   conquistas — não o Elo, que é separado e só muda via ranked).
--
-- CORREÇÃO:
--   Portar a fórmula legítima `computeXp` do frontend
--   (src/lib/progression/progression.ts:56-68) para PL/pgSQL.
--   A RPC agora RECALCULA o XP server-side a partir de
--   (mode, difficulty, elapsed_sec, errors, hints_used, completed) e
--   DESCARTA p_xp_earned — o parâmetro é mantido na assinatura para
--   não quebrar chamadores legados (api/submit-match/route.ts ainda
--   envia o campo), mas é ignorado na computação.
--
--   Para uma partida legítima, o XP concedido é IDÊNTICO ao que o
--   cliente já calculava (mesma fórmula, mesmas constantes — port
--   exato) — então recompensas válidas são preservadas. Para uma
--   chamada abusiva com p_xp_earned=999999, o servidor concede apenas
--   o XP que a fórmula produz para os demais parâmetros (teto natural
--   ≈ 60*2.8*2.2*2 = 739 XP no melhor caso teórico; tipicamente 15-200).
--
-- CONSTANTES DA FÓRMULA (espelham progression.ts EXATAMENTE):
--   base = 60
--   diffMult: easy=1, medium=1.5, hard=2, expert=2.8
--   modeMult: solo=1, daily=1.2, duo=1.8, ranked=2.2, guide=0.3
--   referenceSec: easy=360, medium=720, hard=1200, expert=1800
--     (6/12/20/30 min — progression.ts:62)
--   timeFactor = max(0.5, min(2, referenceSec / max(elapsedSec, 30)))
--   errorPenalty = errors * 8
--   hintPenalty  = hintsUsed * 10
--   raw = base * diffMult * modeMult * timeFactor - errorPenalty - hintPenalty
--   xp  = max(15, round(raw))   — se completed
--   xp  = 5                      — se não completed (participation)
--
-- NOTAS DE ESCOPO (fora de C-04, NÃO tocados):
--   * Fórmula de level: mantida `1 + floor(total_xp / 150.0)` (igual à
--     versão anterior). A divergência vs frontend (M-10) é bug
--     separado, fora do escopo C-04.
--   * GUC scope: mantido `is_local=false` (session-scoped) — sub-risco
--     de C-05, tratado à parte.
--   * p_score, p_is_record, p_final_board: comportamento inalterado.
--   * ACL: `create or replace function` PRESERVA grants existentes;
--     não re-emitimos o grant (authenticated já tem EXECUTE).
--
-- ACEITE (auditoria): "Submit com xp_earned=999999 resulta no XP
--   calculado pelo server".
--
-- IDEMPOTENTE — `create or replace function` é idempotente; seguro
--   re-executar.
-- ============================================

create or replace function public.submit_match_result(
  p_mode text,
  p_difficulty text,
  p_elapsed_sec integer,
  p_errors integer,
  p_hints_used integer,
  p_completed boolean,
  p_xp_earned integer,   -- DEPRECATED: ignorado. Server recalcula (C-04).
  p_score integer,
  p_is_record boolean,
  p_board_seed text,
  p_final_board text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_base constant integer := 60;
  v_diff_mult float;
  v_mode_mult float;
  v_reference_sec integer;
  v_time_factor float;
  v_error_penalty integer;
  v_hint_penalty integer;
  v_raw float;
  v_xp integer := 0;
  v_new_total_xp integer;
  v_new_level integer;
  v_old_level integer;
  v_leveled_up boolean := false;
begin
  -- 1. Validar usuário autenticado
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- 2. Validar parâmetros (bounds inalterados vs versão anterior)
  if p_mode not in ('solo', 'daily', 'duo', 'ranked') then
    return jsonb_build_object('error', 'Invalid mode');
  end if;
  if p_difficulty not in ('easy', 'medium', 'hard', 'expert') then
    return jsonb_build_object('error', 'Invalid difficulty');
  end if;
  if p_elapsed_sec < 0 or p_elapsed_sec > 3600 then
    return jsonb_build_object('error', 'Invalid time');
  end if;
  if p_errors < 0 or p_errors > 100 then
    return jsonb_build_object('error', 'Invalid error count');
  end if;
  if p_hints_used is null or p_hints_used < 0 or p_hints_used > 100 then
    return jsonb_build_object('error', 'Invalid hint count');
  end if;

  -- 3. Calcular XP server-side — PORT de computeXp (progression.ts:56-68).
  --    p_xp_earned é INTENCIONALMENTE IGNORADO (bug C-04).
  if not coalesce(p_completed, false) then
    v_xp := 5;  -- participation XP
  else
    v_diff_mult := case p_difficulty
      when 'easy'   then 1.0
      when 'medium' then 1.5
      when 'hard'   then 2.0
      when 'expert' then 2.8
      else 1.0
    end;

    v_mode_mult := case p_mode
      when 'solo'   then 1.0
      when 'daily'  then 1.2
      when 'duo'    then 1.8
      when 'ranked' then 2.2
      else 1.0
    end;

    v_reference_sec := case p_difficulty
      when 'easy'   then 360   -- 6 min
      when 'medium' then 720   -- 12 min
      when 'hard'   then 1200  -- 20 min
      when 'expert' then 1800  -- 30 min
      else 360
    end;

    -- timeFactor = max(0.5, min(2, referenceSec / max(elapsedSec, 30)))
    v_time_factor := greatest(
      0.5,
      least(2.0, v_reference_sec::float / greatest(p_elapsed_sec, 30))
    );

    v_error_penalty := p_errors * 8;
    v_hint_penalty  := p_hints_used * 10;

    v_raw := v_base * v_diff_mult * v_mode_mult * v_time_factor
             - v_error_penalty - v_hint_penalty;

    -- JS Math.round = round-half-up para positivos; PL/pgSQL
    -- round(numeric) usa round-half-away-from-zero (idêntico para
    -- positivos). Cast final para integer.
    v_xp := greatest(15, round(v_raw::numeric)::integer);
  end if;

  -- 4. Inserir match (xp_earned armazenado = XP calculado pelo server)
  insert into public.matches (
    user_id, mode, difficulty, elapsed_sec, errors, hints_used,
    completed, xp_earned, score, is_record
  ) values (
    v_user_id, p_mode, p_difficulty, p_elapsed_sec, p_errors, p_hints_used,
    coalesce(p_completed, false), v_xp, coalesce(p_score, 0),
    coalesce(p_is_record, false)
  ) returning id into v_match_id;

  -- 5. Atualizar XP e nível no perfil (apenas se completou — preserva
  --    comportamento legítimo atual). v_xp é sempre >= 15 quando
  --    completed, então a condição v_xp > 0 é equivalente à original
  --    p_xp_earned > 0 para partidas legítimas.
  if coalesce(p_completed, false) and v_xp > 0 then
    select total_xp, level into v_new_total_xp, v_old_level
    from public.profiles where id = v_user_id;

    v_new_total_xp := coalesce(v_new_total_xp, 0) + v_xp;
    -- Fórmula de level mantida igual à versão anterior
    -- (divergência vs frontend = M-10, bug separado, fora do escopo C-04).
    v_new_level := 1 + floor(v_new_total_xp / 150.0)::integer;

    -- GUC session-scoped mantido (sub-risco de C-05, tratado à parte).
    perform set_config('app.skip_profile_protection', 'true', false);
    update public.profiles
    set total_xp = v_new_total_xp,
        level = v_new_level,
        updated_at = now()
    where id = v_user_id;
    perform set_config('app.skip_profile_protection', 'false', false);

    v_leveled_up := v_new_level > coalesce(v_old_level, 1);
  end if;

  return jsonb_build_object(
    'success', true,
    'match_id', v_match_id,
    'xp_earned', v_xp,
    'new_xp', coalesce(v_new_total_xp, 0),
    'new_level', coalesce(v_new_level, 1),
    'leveled_up', v_leveled_up
  );
end;
$$;

-- ACL: `create or replace function` PRESERVA os grants existentes
-- (authenticated tem EXECUTE desde supabase-security.sql:182). Não
-- emitimos novo grant nem revoke — bug C-04 é de lógica, não de ACL.

-- ============================================
-- VERIFICAÇÃO (SQL Editor ou Management API)
-- ============================================
-- 1) Definição viva deve conter a PORT da fórmula (case p_difficulty,
--    v_time_factor, greatest(15, round(...))):
--    select pg_get_functiondef('public.submit_match_result(text, text, integer, integer, integer, boolean, integer, integer, boolean, text, text)'::regprocedure);
--
-- 2) Chamada legítima (xp esperado = 120 para solo/easy/120s/0err/0hint):
--    select public.submit_match_result(
--      'solo','easy',120,0,0,true, 80, 0, false, '', '');
--    -- Esperado: {"success":true,"xp_earned":120,...}
--    (p_xp_earned=80 é ignorado; server computa 120)
--
-- 3) Chamada abusiva (xp_earned=999999 deve ser IGNORADO):
--    select public.submit_match_result(
--      'solo','easy',120,0,0,true, 999999, 0, false, '', '');
--    -- Esperado: {"success":true,"xp_earned":120,...}  (mesmo 120, não 999999)
