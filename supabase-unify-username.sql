-- ============================================
-- SUDOKU ARENA — FIX: unificar username e display_name
-- Execute no SQL Editor do Supabase
-- ============================================
-- Problema: o sistema tinha dois nomes (username e display_name).
-- display_name era frequentemente "Player" (default do trigger).
-- Solução: o username É a identidade única. display_name espelha username.
-- ============================================

-- 1. Atualizar o trigger handle_new_user para usar username do user_metadata
--    (enviado pelo signUpWithEmail). Se não houver username, usa o email antes do @.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
  v_email text;
begin
  v_username := new.raw_user_meta_data->>'username';
  v_email := new.email;

  -- Se não houver username nos metadados, derivar do email (antes do @)
  if v_username is null or length(trim(v_username)) < 3 then
    v_username := split_part(v_email, '@', 1);
  end if;

  -- Sanitizar: apenas alphanumericos e underscore
  v_username := regexp_replace(v_username, '[^a-zA-Z0-9_]', '', 'g');

  insert into public.profiles (id, display_name, username)
  values (new.id, v_username, v_username);

  return new;
end;
$$;

-- 2. Para usuários EXISTENTES que têm display_name='Player' mas têm username:
--    atualizar display_name = username
update public.profiles
set display_name = username, updated_at = now()
where username is not null
  and length(trim(username)) > 0
  and (display_name = 'Player' or display_name is null or display_name = '');

-- 3. Para usuários EXISTENTES que têm display_name mas NÃO têm username:
--    copiar display_name → username (preservando o nome que já usam)
update public.profiles
set username = display_name, updated_at = now()
where (username is null or length(trim(username)) = 0)
  and display_name is not null
  and length(trim(display_name)) > 0
  and display_name != 'Player';

-- 4. Para usuários com display_name='Player' e sem username: deixar como está
--    (serão tratados pelo app que mostra string vazia em vez de "Player")

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Rode no SQL Editor:
-- select id, username, display_name from profiles order by created_at desc limit 20;
--
-- Deve mostrar username = display_name para todos os usuários com username.
