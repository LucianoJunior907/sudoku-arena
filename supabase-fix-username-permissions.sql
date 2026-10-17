-- ============================================
-- SUDOKU ARENA — FIX: USERNAME CHECK PERMISSIONS
-- Execute no SQL Editor do Supabase
-- ============================================
--
-- PROBLEMA: O check de username disponível sempre diz "em uso"
-- durante o signup, porque as funções RPC só estavam acessíveis
-- para usuários autenticados (role "authenticated"). Mas durante
-- o signup, o usuário AINDA NÃO está autenticado!
--
-- SOLUÇÃO: Conceder permissão de execução para "anon" nas funções
-- que precisam ser chamadas antes do login:
--   - check_username_available (verificar disponibilidade)
--   - get_email_by_username (login por username)
--
-- A função set_username NÃO precisa de anon porque só é chamada
-- DEPOIS do signup (quando o usuário já está autenticado).
-- ============================================

-- 1. Permitir que visitantes (anon) verifiquem disponibilidade de username
--    (não vaza dados sensíveis — só retorna available: true/false)
revoke execute on function public.check_username_available(text) from authenticated;
grant execute on function public.check_username_available(text) to anon, authenticated;

-- 2. Permitir que visitantes (anon) façam login por username
--    (não vaza dados sensíveis — só retorna email para login)
revoke execute on function public.get_email_by_username(text) from authenticated;
grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- 3. set_username continua só para authenticated (correto — só funciona após login)
grant execute on function public.set_username(text) to authenticated;

-- 4. search_user_by_username continua só para authenticated (precisa de auth.uid())
grant execute on function public.search_user_by_username(text) to authenticated;

-- ============================================
-- VERIFICAR SE DEU CERTO:
-- Rode no SQL Editor: select check_username_available('test_user123');
-- Deve retornar: {"available": true}
-- ============================================
