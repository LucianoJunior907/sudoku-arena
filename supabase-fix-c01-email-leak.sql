-- ============================================
-- SUDOKU ARENA — FIX C-01: email enumeration via get_email_by_username
-- ============================================
-- PROBLEMA (bug C-01 da auditoria):
--   A RPC get_email_by_username(text) retornava o email de QUALQUER
--   usuário para QUALQUER chamador — o grant incluía a role `anon`
--   (supabase-fix-username-permissions.sql:28). Uma única chamada
--   anônima com a anon key (pública, embutida no bundle) bastava:
--     {"p_username":"<qualquer_username>"} → {"found":true,"email":"..."}
--   Confirmado em produção em 29/10/2026: a chamada anônima retornou
--   o email real de um usuário.
--
-- CORREÇÃO:
--   1. A função agora exige a SENHA e a verifica server-side com
--      bcrypt (pgcrypto crypt) contra auth.users.encrypted_password
--      (hashes do projeto estão no formato $2a$ — suportado por crypt).
--      O email só é devolvido após prova de senha: um chamador anônimo
--      sem a senha correta NUNCA obtém email de ninguém.
--   2. Throttle na própria RPC: após 5 falhas seguidas em janela de
--      15 min, o username fica bloqueado por 15 min. Necessário
--      porque esta RPC NÃO passa pelo rate limit do Supabase Auth
--      (GoTrue) — sem isso ela viraria um oráculo de brute-force.
--   3. Resposta uniforme: username inexistente, senha errada, senha
--      ausente e bloqueio retornam o MESMO {"found": false} (não
--      vaza nem a existência do username por esta via).
--
-- TRANSIÇÃO (frontend antigo ainda em produção na Vercel):
--   p_password tem default null, então a chamada 1-arg do frontend
--   antigo continua resolvendo e recebe {"found": false} (degradação
--   graciosa em vez de PGRST202). O login por username só volta a
--   funcionar quando o novo frontend (que envia p_password) estiver
--   em produção. Login por EMAIL não é afetado em nenhum momento.
--
-- IDEMPOTENTE — seguro re-executar (padrão dos demais arquivos do runner).
-- ============================================

-- bcrypt é pré-requisito. No Supabase, pgcrypto mora no schema `extensions`.
create extension if not exists pgcrypto with schema extensions;

-- Tabela de throttle do login por username.
-- Sem acesso de cliente: RLS ligado SEM nenhuma policy + revoke explícito.
-- Apenas a RPC security-definer (owner postgres) lê/escreve aqui.
create table if not exists public.login_throttle (
  username text primary key,
  failed_attempts integer not null default 0,
  last_attempt_at timestamptz not null default now()
);

alter table public.login_throttle enable row level security;
revoke all on public.login_throttle from anon, authenticated;

-- Remove a versão 1-arg (a que vazava email para anon).
-- O drop apaga a ACL antiga (incluindo o grant indevido de anon da v1).
drop function if exists public.get_email_by_username(text);

create or replace function public.get_email_by_username(
  p_username text,
  p_password text default null
)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_username text := lower(btrim(coalesce(p_username, '')));
  -- Hash bcrypt fixo (cost 10, mesmo algoritmo/custo dos hashes reais)
  -- usado para "queimar" tempo uniforme nos caminhos de falha, evitando
  -- distinguir por timing username existente de inexistente.
  v_dummy_hash constant text := '$2a$10$cSyD7iUfMrPp8MH444MSKuxsWK.qzsFzD84wWCWTMBcpWA37rg4GO';
  v_email text;
  v_hash text;
  v_failed integer;
  v_last timestamptz;
begin
  -- Chamada sem senha (payload 1-arg legado / probing) ou sem username:
  -- falha genérica com mesmo custo de CPU.
  if coalesce(p_password, '') = '' or v_username = '' then
    perform extensions.crypt('x', v_dummy_hash);
    return jsonb_build_object('found', false);
  end if;

  -- Mesmo critério case-insensitive da versão anterior.
  -- deleted_at is null: contas soft-deleted do GoTrue não logam.
  select au.email, au.encrypted_password
    into v_email, v_hash
  from auth.users au
  join public.profiles p on p.id = au.id
  where lower(p.username) = v_username
    and au.deleted_at is null;

  if v_hash is null then
    -- Username não existe (ou conta OAuth sem senha): mesma resposta,
    -- mesmo tempo de CPU. NADA é gravado (probing não infla a tabela).
    perform extensions.crypt(p_password, v_dummy_hash);
    return jsonb_build_object('found', false);
  end if;

  -- Throttle: 5+ falhas nos últimos 15 min ⇒ bloqueado até 15 min
  -- após a ÚLTIMA falha registrada (tentativas durante o bloqueio não
  -- renovam a janela). Após expirar, o contador reinicia sozinho.
  select failed_attempts, last_attempt_at
    into v_failed, v_last
  from public.login_throttle
  where username = v_username;

  if v_failed is not null and v_failed >= 5 and v_last > now() - interval '15 minutes' then
    perform extensions.crypt(p_password, v_hash);
    return jsonb_build_object('found', false);
  end if;

  -- Verificação server-side da senha (bcrypt $2a$, mesmo formato do
  -- Supabase Auth / GoTrue). Só agora o email pode ser devolvido.
  if extensions.crypt(p_password, v_hash) = v_hash and v_email is not null then
    -- Sucesso: limpa o histórico de falhas do username.
    delete from public.login_throttle where username = v_username;
    return jsonb_build_object('found', true, 'email', v_email);
  end if;

  -- Falha (senha errada): registra tentativa APENAS para usernames
  -- reais — crescimento limitado ao número de usuários reais.
  insert into public.login_throttle (username, failed_attempts, last_attempt_at)
  values (v_username, 1, now())
  on conflict (username) do update set
    failed_attempts = case
      when public.login_throttle.last_attempt_at < now() - interval '15 minutes' then 1
      else public.login_throttle.failed_attempts + 1
    end,
    last_attempt_at = now();

  return jsonb_build_object('found', false);
end;
$$;

-- Grants: `anon` PRECISA de EXECUTE (login por username é pré-autenticação).
-- A segurança agora é o gate INTERNO por senha — não a ACL. service_role
-- mantido por paridade com a ACL da versão anterior.
revoke execute on function public.get_email_by_username(text, text) from public;
grant execute on function public.get_email_by_username(text, text) to anon, authenticated, service_role;

-- ============================================
-- VERIFICAÇÃO (SQL Editor)
-- ============================================
-- 1) Definição viva deve conter crypt(...) e login_throttle:
--    select pg_get_functiondef('public.get_email_by_username(text, text)'::regprocedure);
-- 2) A assinatura antiga 1-arg NÃO deve mais existir:
--    select to_regprocedure('public.get_email_by_username(text)') as old_signature;  -- NULL
-- 3) Chamadas anônimas NÃO devem mais expor email (todas: {"found":false}):
--    select public.get_email_by_username('algum_usuario');
--    select public.get_email_by_username('algum_usuario', 'senha-errada');
