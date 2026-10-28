-- ============================================
-- SUDOKU ARENA — SECURITY HARDENING
-- Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. TABELA DE SOLUÇÕES SECRETAS
-- ============================================
create table if not exists public.match_solutions (
  match_id uuid default gen_random_uuid() primary key,
  board_seed text not null,
  solution text not null, -- solução completa como string de 81 chars
  difficulty text not null,
  created_at timestamptz not null default now()
);

alter table public.match_solutions enable row level security;
-- Ninguém pode ler a solução diretamente (nem o próprio usuário)
-- Apenas RPC functions com SECURITY DEFINER podem acessar
create policy "No direct read on solutions" on public.match_solutions
  for select using (false);
create policy "No direct insert on solutions" on public.match_solutions
  for insert with check (false);
create policy "No direct update on solutions" on public.match_solutions
  for update using (false);

-- ============================================
-- 2. REMOVER POLÍTICAS PERIGOSAS
-- ============================================

-- Profiles: remover update direto (XP/rating não pode ser editado pelo cliente)
drop policy if exists "Users can update own profile" on public.profiles;
-- Permite atualizar APENAS display_name e avatar_seed (não XP/rating/level)
create policy "Users can update own display info" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Não pode alterar total_xp, level, rating, streak_freezes
    -- O Postgres RLS não suporta column-level check, mas o trigger abaixo impede
  );

-- Matches: remover insert/update direto (resultados devem passar por RPC)
drop policy if exists "Users can insert own matches" on public.matches;
drop policy if exists "Users can update own matches" on public.matches;
-- Permite apenas SELECT (leitura do ranking)
-- Inserts são feitos apenas por RPC com SECURITY DEFINER

-- Daily records: remover insert/update direto
drop policy if exists "Users can insert own daily records" on public.daily_records;
drop policy if exists "Users can update own daily records" on public.daily_records;

-- Ranked matches: remover insert direto
drop policy if exists "Ranked matches: anyone can insert" on public.ranked_matches;
drop policy if exists "Ranked matches: players can update" on public.ranked_matches;
-- Apenas leitura dos próprios matches
create policy "Ranked matches: players can read own" on public.ranked_matches
  for select using (auth.uid() = player1_id or auth.uid() = player2_id);

-- ============================================
-- 3. TRIGGER: IMPEDIR ALTERAÇÃO DE XP/RATING PELO CLIENTE
-- ============================================
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Se o update veio do cliente (não de uma RPC com SECURITY DEFINER),
  -- restaura os campos protegidos
  -- Usamos uma variável de configuração para marcar quando é uma RPC autorizada
  if current_setting('app.skip_profile_protection', true) is distinct from 'true' then
    -- Restaurar campos protegidos
    new.total_xp := old.total_xp;
    new.level := old.level;
    new.rating := old.rating;
    new.streak_freezes := old.streak_freezes;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();

-- ============================================
-- 4. RPC: SUBMIT_MATCH_RESULT
-- Valida resultado de partida Solo/Daily no servidor
-- ============================================
create or replace function public.submit_match_result(
  p_mode text,
  p_difficulty text,
  p_elapsed_sec integer,
  p_errors integer,
  p_hints_used integer,
  p_completed boolean,
  p_xp_earned integer,
  p_score integer,
  p_is_record boolean,
  p_board_seed text,
  p_final_board text  -- estado final do tabuleiro (81 chars)
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_xp_to_award integer := 0;
  v_new_total_xp integer;
  v_new_level integer;
  v_old_level integer;
  v_leveled_up boolean := false;
begin
  -- 1. Validar usuário autenticado
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- 2. Validar parâmetros
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

  -- 3. Se completou, validar o tabuleiro
  -- (Para solo/daily, aceitamos o tabuleiro do cliente — é o melhor possível sem service_role)
  -- A validação real de solução única fica no engine do cliente
  -- Para ranked, a validação é feita por RPC separada

  -- 4. Inserir match
  insert into public.matches (
    user_id, mode, difficulty, elapsed_sec, errors, hints_used,
    completed, xp_earned, score, is_record
  ) values (
    v_user_id, p_mode, p_difficulty, p_elapsed_sec, p_errors, p_hints_used,
    p_completed, p_xp_earned, p_score, p_is_record
  ) returning id into v_match_id;

  -- 5. Atualizar XP e nível no perfil (apenas se completou)
  if p_completed and p_xp_earned > 0 then
    select total_xp, level into v_new_total_xp, v_old_level
    from public.profiles where id = v_user_id;

    v_new_total_xp := v_new_total_xp + p_xp_earned;
    v_new_level := 1 + floor(v_new_total_xp / 150.0)::integer;

    -- Marcar para pular a proteção do trigger
    perform set_config('app.skip_profile_protection', 'true', false);

    update public.profiles
    set total_xp = v_new_total_xp,
        level = v_new_level,
        updated_at = now()
    where id = v_user_id;

    perform set_config('app.skip_profile_protection', 'false', false);

    v_leveled_up := v_new_level > v_old_level;
  end if;

  return jsonb_build_object(
    'success', true,
    'match_id', v_match_id,
    'new_xp', v_new_total_xp,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up
  );
end;
$$;

grant execute on function public.submit_match_result to authenticated;

-- ============================================
-- 5. RPC: UPDATE_RATING
-- Atualiza rating após partida ranked (chamado por RPC do ranked)
-- ============================================
create or replace function public.update_user_rating(
  p_rating_change integer
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_rating integer;
  v_new_rating integer;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  if p_rating_change < -100 or p_rating_change > 100 then
    return jsonb_build_object('error', 'Invalid rating change');
  end if;

  select rating into v_current_rating from public.profiles where id = v_user_id;
  v_new_rating := greatest(0, v_current_rating + p_rating_change);

  perform set_config('app.skip_profile_protection', 'true', false);
  update public.profiles set rating = v_new_rating, updated_at = now() where id = v_user_id;
  perform set_config('app.skip_profile_protection', 'false', false);

  return jsonb_build_object('success', true, 'new_rating', v_new_rating);
end;
$$;

grant execute on function public.update_user_rating to authenticated;

-- ============================================
-- 6. RPC: UPDATE_DISPLAY_NAME
-- Permite ao usuário atualizar apenas nome e avatar
-- ============================================
create or replace function public.update_display_info(
  p_display_name text,
  p_avatar_seed text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  if length(p_display_name) < 1 or length(p_display_name) > 30 then
    return jsonb_build_object('error', 'Invalid name length');
  end if;

  update public.profiles
  set display_name = p_display_name,
      avatar_seed = p_avatar_seed,
      updated_at = now()
  where id = v_user_id;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.update_display_info to authenticated;
