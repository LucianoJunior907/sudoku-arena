-- ============================================
-- SUDOKU ARENA — FIX C-03: RPC update_user_rating dá Elo self-service
-- ============================================
-- PROBLEMA (bug C-03 da auditoria):
--   A RPC public.update_user_rating(p_rating_change integer) é
--   SECURITY DEFINER e estava concedida (grant execute) a `anon` e
--   `authenticated` (supabase-security.sql:219), além do grant
--   implícito a PUBLIC. Aceita p_rating_change em [-100, +100] e
--   aplica direto sobre profiles.rating do chamador, setando o GUC
--   `app.skip_profile_protection` para passar pelo trigger de guarda.
--
--   Resultado: qualquer usuário autenticado podia disparar
--     POST /rest/v1/rpc/update_user_rating  {"p_rating_change": 100}
--   em loop e inflar o próprio rating indefinidamente (= #1 no
--   leaderboard assim que C-05 for corrigido e o rating voltar a
--   persistir). A auditoria (AUDITORIA-BUGS-PLANO.md:52-56) confirma:
--   não existe NENHUM caller dessa RPC no frontend (grep em src/ =>
--   zero ocorrências) e nenhum caller entre as demais RPCs (grep em
--   supabase-*.sql => a única menção é a própria definição/grant).
--   `finish_ranked_match` faz o UPDATE em profiles direto, com GUC
--   próprio (supabase-ranked-xp-matches.sql:221-239), sem chamar
--   update_user_rating.
--
-- CORREÇÃO:
--   Revogar EXECUTE de PUBLIC/anon/authenticated. Mantemos a função
--   instalada (não damos DROP) para (a) preservar o schema e (b) deixar
--   o caminho aberto para um back-office futuro via service_role, sem
--   jamais expor ao cliente. O owner (postgres) mantém EXECUTE por
--   padrão; SECURITY DEFINER executa como owner, então `finish_ranked_match`
--   ou qualquer outra RPC server-side continuaria podendo chamá-la
--   internamente — embora hoje nenhuma o faça.
--
-- ACEITE (auditoria): "POST /rest/v1/rpc/update_user_rating retorna
--   403 p/ authenticated".
--
-- IDEMPOTENTE — REVOKE não erroa em re-execução; seguro rodar N vezes.
-- ============================================

-- 1) Revoga todo e qualquer grant de EXECUTE para roles de cliente.
--    Ordem: PUBLIC primeiro (grant base), depois as roles nomeadas.
revoke execute on function public.update_user_rating(integer) from public;
revoke execute on function public.update_user_rating(integer) from anon;
revoke execute on function public.update_user_rating(integer) from authenticated;

-- 2) Garante que o service_role (back-office interno/server-side) mantém
--    acesso — nunca exposto ao cliente. É o único grant legítimo para
--    esta RPC. (service_role já tinha EXECUTE na ACL viva; re-grant é
--    idempotente e documenta a intenção.)
grant execute on function public.update_user_rating(integer) to service_role;

-- ============================================
-- VERIFICAÇÃO (SQL Editor ou Management API)
-- ============================================
-- 1) ACL viva NÃO deve conter `anon=` nem `authenticated=` nem `=` (PUBLIC):
--    select p.proname, p.proacl
--    from pg_proc p
--    join pg_namespace n on n.oid = p.pronamespace
--    where p.proname = 'update_user_rating' and n.nspname = 'public';
--    -- Esperado: {postgres=X/postgres,service_role=X/postgres}
--
-- 2) Chamada como authenticated via PostgREST deve falhar (404/PGRST202
--    "Could not find the function" — PostgREST esconde RPCs sem grant
--    para a role do chamador):
--    curl -X POST "$URL/rest/v1/rpc/update_user_rating" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $USER_JWT" \
--      -H "Content-Type: application/json" \
--      -d '{"p_rating_change": 100}'
--    -- Esperado: HTTP 404, body {"code":"PGRST202","message":"Could not find the function ..."}
