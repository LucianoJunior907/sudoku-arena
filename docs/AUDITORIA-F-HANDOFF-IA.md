# Sudoku Arena — Documento F: Contexto para Continuar o Desenvolvimento (Handoff para outra IA)

> LEIA ESTE ARQUIVO INTEIRO antes de tocar em qualquer funcionalidade. Escrito em 28/10/2026 com base em auditoria completa de código + banco de produção. Se algo aqui divergir do código, CONFIE NO CÓDIGO e atualize este doc.

## 1. Objetivo do produto

Sudoku competitivo web (pt-BR primary). Solo com aprendizado (guia de 13 técnicas), desafios diários com streak, e 1v1 ranqueado com Elo/divisões. Monetização futura (cosméticos) ainda não implementada. Público-alvo: jogadores casuais→competitivos BR.

## 2. Stack (confirme antes de adicionar dependências)

- Next.js 16.1.1 App Router, React 19, TS 5 (`strict`, mas `noImplicitAny:false`, `ignoreBuildErrors:true` — erros TS NÃO quebram build).
- Tailwind CSS 4 (via postcss `@tailwindcss/postcss` + `@theme inline` em `globals.css` — `tailwind.config.ts` é LEGADO inerte).
- shadcn/ui new-york em `src/components/ui/` (47 arquivos; SÓ use: button card badge dialog input label progress switch slider dropdown-menu sheet sonner tooltip).
- Zustand 5 (`src/lib/store/app-store.ts`), framer-motion (só ViewTransition), recharts (Overview/ProfileCharts), sonner (toasts), lucide-react (ícones).
- Supabase JS (`@supabase/supabase-js`): client.ts Proxy singleton; auth.tsx Context; matches.ts; ranked.ts.
- Sem ORM (Prisma presente = DEAD CODE). Sem next-intl (i18n é custom store-backed). Sem TanStack/next-auth/zod — deps existem no package.json mas são lixo.
- Vercel deploy por GitHub push (`vercel.json`); bun runtime.

## 3. Arquitetura em 1 parágrafo

SPA de rota única (`page.tsx` troca 16 views por `store.route`). Estado local offline-first (Zustand + localStorage `sudoku-arena:*`) para solo/daily/XP; Supabase para auth (email/senha/username/Google) e competitivo (RPCs SECURITY DEFINER escrevem rating/XP/partidas; realtime para oponente terminar). UMA API route real: `/api/submit-match` (valida sessão e chama RPC `submit_match_result`). Migrations SQL ficam na RAIZ (`supabase-*.sql`) e são rodadas via `bun run supabase:migrate` (Management API, token no `.env` NÃO commitado).

## 4. Mapa de arquivos críticos (TOQUE COM CUIDADO)

| Arquivo | Por quê |
|---|---|
| `src/lib/supabase/auth.tsx` | ÚNICO auth vivo. Cuidado: `src/lib/supabase/auth.ts` (extensão .ts) é MORTO — imports sem extensão resolvem .tsx. Se criar auth nova, apague o .ts. |
| `src/lib/store/app-store.ts` | Todo estado local. `recordGame`/`recordDaily`/`checkAchievements` têm efeitos cruzados (XP→level→freezes→cosméticos). `hydrate()` é chamado 1x em Providers. |
| `src/hooks/use-sudoku-game.ts` | Reducer do jogo. Win flow (linha ~505-593) encadeia: som→recordGame→(daily)→achievements→cloud save. `persist()` (debounce 400ms) e resume no mount. |
| `src/lib/sudoku/engine.ts` | `generatePuzzle(diff, seed)` determinístico, solução única. Daily/Ranked/Archive dependem do SEED (não mude o formato dos seeds!). |
| `src/components/views/RankedView.tsx` (972 ln) | Estados: lobby→queue→match→result. `handleFinish(abandon, boardToSubmit?)` — o boardToSubmit EXISTE para evitar stale state (bug histórico: partidas viravam "abandoned"). Realtime handler (~310-347) registra a derrota do outro player. Refs `elapsedRef/errorsRef` evitam closure stale. |
| `src/components/layout/AppShell.tsx` | Gate de auth; bloqueio Google-incompleto; interceptação de navegação ranked (events `ranked-abandon-attempt`/`ranked-forfeit-confirm`); TODOS os hooks antes dos early returns (regra dos hooks). |
| `src/components/layout/Providers.tsx` | Ordem: ThemeProvider→AuthProvider→children+OnboardingDialog+AuthedOverlays. `AuthedOverlays` só renderiza tour/toasts autenticado (fix de clique travado no login). |
| `supabase-ranked-overhaul.sql` + `supabase-ranked-xp-matches.sql` | A RPC `finish_ranked_match` VIVA em produção (Elo K=32, abandão −50, idempotente, grava `matches` p/ ambos, atualiza `profiles.total_xp/level`). Sintaxe PL/pgSQL: NÃO use `declare` no meio do corpo (causou bug histórico silencioso). |
| `.zscripts/run-migrations.sh` | Ordem canônica dos SQLs. `supabase-security.sql` NÃO está incluído (bug conhecido D-08) — se for mexer, adicione. |

## 5. Banco de dados (confirmado em produção 28/10/2026)

11 tabelas com RLS: profiles, matches, daily_records, ranked_queue, ranked_matches, friends, rooms, room_participants, chat_messages, seasons, match_solutions.

RPCs vivas: `finish_ranked_match, try_matchmake_atomic, check_my_ranked_match, heartbeat_ranked_queue, update_ranked_progress, get_email_by_username, check_username_available, set_username, search_user_by_username, submit_match_result, update_user_rating (PERIGOSA, sem caller — revogar), update_display_info, handle_new_user (trigger), protect_profile_fields (trigger), validate_sudoku_solution`.

**Invariante de username:** username = identidade única; `display_name` espelha username (trigger `handle_new_user` sincroniza). NÃO reintroduza campo "nome".

**Invariante de progressão:** `profiles.rating/total_xp/level` só podem mudar via RPC (trigger `protect_profile_fields` bloqueia UPDATE direto a menos que GUC `app.skip_profile_protection='true'`). Se criar RPC nova que escreva esses campos, sete o GUC e RESTAURE no fim (use `set_config(..., true)` transação-scoped, NÃO session-scoped como o código atual — é um bug latente).

**Idempotência ranked:** `finish_ranked_match` faz `SELECT ... FOR UPDATE` + status check — chamada duplicada retorna o resultado sem aplicar de novo. NÃO quebre isso.

## 6. Regras de negócio principais

1. **Vitória ranked:** primeiro `isComplete(board)` → `finish_ranked_match(matchId, board, false)`. **Derrota:** 3 erros → atualmente `finish_ranked_match(matchId, [], true)` (tratada como ABANDONO com −50 — conhecido e aceito até implementar reason 'errors' server-side).
2. **Elo:** K=32; E=1/(1+10^(ΔR/400)); abandão: Δ −= 50 se perdedor; floor rating 0.
3. **XP:** vitória ranked 60-120 por dificuldade + bônus tempo − 5·erro (server); solo client-side `computeXp` = 60·multDif·multModo·fatorTempo − 8·erros − 10·dicas, min 15.
4. **Level:** while xp ≥ 100+50·level.
5. **Divisões:** 0/800/1600/2400/3200/4000/5000 (bronze..grandmaster). `localDivision` (app-store.ts:637) e `DIVISIONS` (progression.ts:128) DEVEM ficar em sync.
6. **Streak diário:** ontem→hoje +1; gap: consome freeze senão reseta 1. Freeze ganho nos níveis 3/7/14.
7. **Fila ranked:** heartbeat 10s; expira >30s; matchmaking exclui quem tem match ativo (só do OPONENTE hoje — bug).
8. **Guest:** `sudoku-arena-guest` no localStorage; bloqueado de duo/ranked/leaderboard/friends por `GuestLoginRequired`.
9. **Google sem username:** `AppShell` renderiza `GoogleSignupCompletion` bloqueando TUDO até `setUsername`.

## 7. Bugs conhecidos NÃO corrigidos (resumo — detalhes em AUDITORIA-D)

- C-01 vazamento email · C-02 forjar partidas/Elo · C-03 update_user_rating · C-04 XP sem teto (TODOS CRÍTICOS, bloqueiam lançamento).
- Duo = shell sem jogo (botão sem onClick; leave não limpa; join race).
- Streak quebra com replay de dia passado; limite diário em UTC.
- Solução ranked derivável no cliente; matchmaking race (2 partidas); UPDATE permissivo em ranked_matches.
- `supabase-security.sql` fora do runner.
- OAuth implicit (sem PKCE); senha forte só frontend; zero rate limiting; zero testes.

## 8. Decisões tomadas (não reverta sem motivo forte)

- Revert do redesign mobile-first geométrico (raio 0.375) → identidade atual raio 0.7rem/XL.
- Modo visitante como cidadão de 1ª classe (localStorage + gates).
- auth como Context (`AuthProvider`) porque cada componente tinha estado próprio e guest mode não propagava (bug histórico).
- Sonner com zIndex 9999 (login overlay é z-200 e escondia toasts).
- Tour/toasts só renderizam autenticado (overlay do tour travava cliques no login).
- `finish_ranked_match` PL/pgSQL puro (sem declare inline!). Runner de migrations via Management API (token em .env).
- História do git foi reescrita com filter-branch para expurgar token — NÃO force-push sem checar secrets.
- `handleFinish(abandon, boardToSubmit?)`: o board é passado como PARÂMETRO (state stale travou TUDO antigamente — partidas viravam "abandoned").
- `elapsedRef/errorsRef` em RankedView: closures stale davam tempo 0.

## 9. Comandos essenciais

```bash
bun run dev                 # dev :3000 (logs dev.log)
bun run lint                # ÚNICO gate de qualidade
npx next build              # build (ignoreBuildErrors:true — TS não quebra)
bun run supabase:migrate    # roda supabase-*.sql via Management API (token .env)
git push origin main        # dispara deploy Vercel automático
```
QA é manual via `agent-browser` (open/eval/screenshot). Produção: `https://sudoku-arena-br.vercel.app`.

## 10. Cuidados para não quebrar

1. NÃO remova `boardToSubmit` do handleFinish, nem os refs elapsed/errors, nem o `already_finished` check.
2. NÃO mova hooks para depois de early returns no AppShell/RankedView (violou rules-of-hooks 2× no passado).
3. NÃO use `declare` inline em PL/pgSQL; suba variáveis pro bloco DECLARE do topo.
4. Ao trocar policies RLS: `drop policy if exists` ANTES de `create` (o mesmo nome exato — o bug 42710 já aconteceu por "heartbeat" faltando no drop).
5. Z-index: login z-200 < Sonner 9999; modais de logout/promo z-300; promoção full-screen z-400.
6. Se tocar `check_username_available`/`get_email_by_username`, teste login-por-username E signup no Vercel após deploy (esses fluxos já quebraram 2×).
7. Toda escrita nova em `profiles.rating/total_xp/level` precisa do GUC do trigger (ver §5) OU deve virar RPC.
8. `.env` tem token admin (SUPABASE_ACCESS_TOKEN) — JAMAIS commitar; GitHub já bloqueou push uma vez por secret scanning.

## 11. Limitações atuais / próximos passos acordados

- Não há backend próprio; toda lógica crítica que precisar de confiança deve virar RPC SECURITY DEFINER (padrão já estabelecido).
- Duo decidir escopo é o próximo grande produto-decision.
- Antes de lançar público: executar Fase 1 do backlog (AUDITORIA-E) — 4 fixes críticos de segurança.
- Não existe recuperação pós-link de reset de senha (só o pedido do email).

## 12. Onde verificar estado vivo

- Banco: Management API (`select` direto) com token do .env — 15 RPCs, RLS 100%, row counts pequenos (8 users).
- Produção Vercel: https://sudoku-arena-br.vercel.app (env vars NEXT_PUBLIC_SUPABASE_* configuradas lá).
- Git: `github.com/LucianoJunior907/sudoku-arena` (deploy auto por push).

---
*Fim do Documento F. Documentos A-E acompanham na pasta `docs/`.*
