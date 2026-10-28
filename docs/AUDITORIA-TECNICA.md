# Sudoku Arena — Auditoria Técnica Completa (Arquivo 1 de 2)

> **Consolidação em 2 arquivos** (28/10/2026 22:52 BRT). Este arquivo reúne, sem perda de conteúdo, os antigos Documentos **A (Resumo Executivo)**, **B (Documentação Técnica)** e **C (Inventário de Funcionalidades)**.
> O **Arquivo 2** — `docs/AUDITORIA-BUGS-PLANO.md` — reúne **D (Bugs e Riscos)**, **E (Backlog)** e **F (Handoff para outra IA)**.
>
> **Base:** código-fonte real (`github.com/LucianoJunior907/sudoku-arena`, produção `https://sudoku-arena-br.vercel.app`) + banco de produção verificado via Supabase Management API (project ref `gwcorgidbkqethhowsod`) em 28/10/2026.
> **Regras desta auditoria:** nenhum arquivo do projeto foi modificado; nada foi inventado — o que não pôde ser verificado está marcado ❔; status diferenciado ✅/🟡/📋/❌/❔; evidências citadas como `arquivo:linha`.
>
> ⚠️ **Importante — reverificado na consolidação:** a verificação empírica do banco nesta data revelou **2 novos problemas críticos/altos que os relatórios originais não capturaram** (conflito trigger×RPC que zera rating/XP do ranked em `profiles` — novo **C-05**; publication realtime que deixa salas/chat duo mudos — novo **D-17**). Detalhes e evidência no Arquivo 2, Parte I. O inventário abaixo já refleta esses status corrigidos.

---

## Índice deste arquivo

- **PARTE I — Resumo Executivo** (era Documento A)
- **PARTE II — Documentação Técnica** (era Documento B) — arquitetura, banco, auth, fluxos de jogo, realtime, deploy, estado, validação, testes
- **PARTE III — Inventário de Funcionalidades** (era Documento C) — tabelas de status com evidências

---

# PARTE I — RESUMO EXECUTIVO

## 1. O que é o Sudoku Arena

Um jogo de Sudoku competitivo web com foco no mercado brasileiro (pt-BR default, en secundário). O jogador treina sozinho, aprende técnicas, completa desafios diários, sobe de nível com XP, e compete em partidas ranqueadas 1v1 com rating estilo Elo e divisões (Bronze → Grandmaster). É um produto único-rota (SPA) — toda a navegação é client-side via Zustand.

## 2. Tecnologias (confirmadas no código)

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16.1.1 (App Router, `output: standalone`, `force-dynamic`) |
| Linguagem | TypeScript 5 (strict com `noImplicitAny: false`, `ignoreBuildErrors: true`) |
| UI | React 19, Tailwind CSS 4 (CSS-first `@theme inline`; `tailwind.config.ts` legado inerte), shadcn/ui (new-york, 48 componentes), lucide-react |
| Animação | Framer Motion (só transições de view), CSS keyframes próprios (`sa-*` em globals.css) |
| Estado | Zustand 5 (`src/lib/store/app-store.ts`) + localStorage (persistência offline-first) |
| Backend | Supabase (Postgres 17 + Auth + Realtime + PostgREST RPCs) — **não há backend Node separado**; 1 única API route real (`/api/submit-match`) |
| Deploy | Vercel (auto-deploy por push GitHub, `bun install`) |
| Banco | Supabase Postgres com RLS em 100% das 11 tabelas, 15 RPCs (14 SECURITY DEFINER + `validate_sudoku_solution` INVOKER) |
| Sons | WebAudio sintetizado (12 padrões, zero assets) |
| Gráficos | Recharts (radar win-rate no Overview, barras/área no Profile) |
| i18n | Sistema custom store-backed (~390 chaves por idioma; pt-BR + en) |

## 3. Funcionalidades e modos (status pós-reverificação)

| Modo | Status | Resumo |
|------|--------|--------|
| **Solo** | ✅ Completo | 4 dificuldades, anotações, desfazer/refazer, dicas, pausar, timer, autosave/resume, teclado completo, XP, recordes, exportar imagem, códigos de compartilhamento, estimador de dificuldade, solver didático |
| **Guia** | ✅ Completo | 13 técnicas em 3 níveis com mini-tabuleiros ilustrados e prática jogável que rende XP (0.3×) |
| **Diário** | ✅ Completo* | Tabuleiro determinístico por data+dificuldade, streak com freezes, calendário 13 semanas, replay de dias passados. *Ver bug D-06 (streak corrompe ao replayar dia passado) e D-16 (dia em UTC) |
| **Archive** | ✅ Completo | Puzzles semanais determinísticos (seed ISO-week), jogáveis como prática |
| **Ranked 1v1** | 🟡 Funcional c/ ressalvas | Fila com heartbeat, matchmaking atômico, mesmo tabuleiro por seed, primeiro-que-resolve-vence, 3 erros = derrota (tratada como abandono, −50), Elo K=32 server-side, idempotência, animação de promoção, interceptação de navegação. **⚠️ Novo C-05: rating/XP do ranked NÃO persiste em `profiles`** (trigger reverte) — funciona visualmente (RPC retorna valores) mas leaderboard global mostra 0 para todos |
| **Duo (2v2)** | ⚠️ Incompleto | Salas com código criam/entram no banco, mas **não há jogo** (botão "Iniciar partida" sem handler), **presença realtime é muda** (publication não cobre as tabelas — novo D-17), sair não remove do banco, join tem race |
| **Amigos** | ✅ Funcional | Busca por username, pedidos, aceitar/recusar, bloquear (não aplicado server-side) |
| **Leaderboard** | ✅ Funcional* | Top 50 por rating, divisões, auto-refresh (focus + 30s). *Enquanto C-05 persistir, ratings globais ficam em 0 |
| **Perfil** | ✅ Completo | Cosméticos por nível, gráficos, avatar identicon |
| **Conquistas** | ✅ Completo | 15 conquistas com XP bônus |
| **Auth** | ✅ Funcional | Email+senha, username OU email, Google OAuth, reset de senha (pedido), visitante, conclusão Google, sessão validada contra servidor |

## 4. Navegação e UX

- Primeiro acesso: modal de idioma → login full-screen (com visitante) → lobby + tour guiado (7 passos, só autenticado).
- Header sticky: menu mobile, logo, badge de nível/XP, idioma, som, tema, avatar/logout.
- Sidebar desktop + Sheet mobile com 14 itens em 4 grupos (play/learn/community/account). `Alt+←/→` circula views.
- Durante partida ranked, navegação interna é interceptada com modal de abandono.
- Tema claro/escuro completo (oklch). Responsivo mobile-first (board `max-w-[min(92vw,30rem)]`, fontes `clamp()`).
- Footer sticky no bottom (`AppShell.tsx:343-347`).

## 5. Como o jogo funciona (visão de produto)

- **Progressão:** XP → nível (`100+50·n`) → cosméticos e streak-freezes nos níveis 3/7/14.
- **Competição:** Elo (K=32, floor 0) por ranked; 7 divisões (0/800/1600/2400/3200/4000/5000); animação de promoção full-screen (4 estágios, respeita `prefers-reduced-motion`).
- **Motivação diária:** streak com freezes + calendário GitHub-style de 13 semanas.
- **Retenção:** 15 conquistas, recordes, histórico (cap 200), gráficos, cosméticos equipáveis.

## 6. Estado de produção verificado (28/10/2026 22:52 BRT, via Management API)

- **Vercel:** build passa, deploy automático por GitHub ativo (`vercel.json`: framework nextjs, `bun install`, github.enabled).
- **Banco:** 11 tabelas, **RLS ativa em 100%** ✅; **15 RPCs instaladas** (14 SECURITY DEFINER + validate INVOKER) ✅; trigger `handle_new_user` ✅; trigger `protect_profile` (BEFORE UPDATE em profiles) **instalado** ✅; publication `supabase_realtime` = **apenas `ranked_queue` + `ranked_matches`** (rooms/chat NÃO incluídas).
- **Dados:** 8 usuários · 8 profiles (todos rating=0, total_xp=0, level=1) · 1 ranked_match (`abandoned`, `player2_rating_after=16`) · 2 rows em `matches` (ambas `mode='ranked'`) · friends=0 · daily_records=0 · fila vazia · `match_solutions` vazia (nunca populada).
- **Evidência do novo C-05:** a única partida ranqueada gravou vitória com rating_after=16 e XP 80, mas `profiles.rating/total_xp` seguiram 0 — o trigger `protect_profile_fields` reverteu os UPDATEs da RPC `finish_ranked_match`, que não seta o GUC de bypass.
- **Dev server sandbox:** erro Turbopack pré-existente (`GET / 500` em dev.log; causa é ambiente/permissionamento, não afeta a produção Vercel).

## 7. Principais problemas (detalhes no Arquivo 2, Parte I)

1. **CRÍTICO (novo, confirmado empiricamente)** — C-05: `finish_ranked_match` atualiza `profiles` sem setar `app.skip_profile_protection` → trigger `protect_profile` reverte rating/XP/level → **progressão ranked não persiste**; leaderboard global mostra 0 para todos.
2. **CRÍTICO** — C-01: `get_email_by_username` exposto a `anon` vaza email de qualquer usuário.
3. **CRÍTICO** — C-02: partidas ranked podem ser forjadas contra vítimas arbitrárias; validação da solução nunca compara com o puzzle real → roubo de Elo em escala.
4. **CRÍTICO** — C-03: RPC `update_user_rating` (sem caller no app) dá ±100 rating por chamada a qualquer autenticado.
5. **CRÍTICO** — C-04: `submit_match_result` aceita `xp_earned` do cliente sem teto → XP infinito.
6. **ALTO (novo, confirmado no banco)** — D-17: publication realtime não inclui `rooms`/`room_participants`/`chat_messages` → canais duo/chat nunca recebem eventos.
7. **ALTO** — D-01: solução do ranked é computada no cliente a partir da seed pública. D-07: race do matchmaking (jogador em 2 partidas). D-03: UPDATE de `ranked_matches` sem restrição de coluna. D-08: `supabase-security.sql` fora do runner de migrations.
8. **MÉDIO/BAIXO** — Duo sem gameplay; streak bug no replay diário (D-06); UTC (D-16); sem rate limiting; OAuth implicit sem PKCE (M-03); senha forte só no frontend (M-04); GUC session-scoped nas RPCs (sub-risco de C-05); fórmulas de level divergentes entre RPCs (M-10); chave guest fora do namespace de dados (L-11).

## 8. Prioridades para lançamento (detalhes no Arquivo 2, Parte II)

1. **Fix C-05 (1 SQL, rápido)** — o ranked é o coração do produto e hoje não persiste progressão.
2. Bloquear os 4 vetores críticos C-01..C-04 — sem isso, não pode ir ao público.
3. Adicionar `supabase-security.sql` ao runner (D-08) e as tabelas duo à publication (D-17).
4. Estabilizar Duo (ou esconder).
5. Corrigir bug do streak diário (D-06) e UTC (D-16).
6. PKCE + senha server-side.

## 9. Métricas do código

- `src/`: ~21.000 linhas em 129 arquivos TS/TSX (96 .tsx + 33 .ts) — app 643 ln + lib ~5.400 ln + components/hooks ~15.300 ln.
- 11 migrations SQL na raiz (~1.900 ln) + runner automatizado (`bun run supabase:migrate` → `.zscripts/run-migrations.sh`).
- **~17 dependências npm não utilizadas** (next-auth, next-intl, uuid, zod, TanStack query/table, dnd-kit ×3, date-fns, sharp, @reactuses/core, react-markdown, react-syntax-highlighter, @mdxeditor, prisma/@prisma/client — zero imports); **34 componentes shadcn/ui mortos** (13 dos 48 usados); `src/lib/db.ts` (Prisma) sem importadores; `src/lib/supabase/auth.ts` (dead) ao lado do `auth.tsx` (vivo); `use-toast.ts`/`use-mobile.ts` mortos; `tailwind.config.ts` legado inerte; `getSavedGame/setSavedGame` do store sem chamadas.
- **Zero testes automatizados** de aplicação (lint é a única verificação; QA via agent-browser manual no Vercel).

---

# PARTE II — DOCUMENTAÇÃO TÉCNICA

## 1. Arquitetura geral

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (produção)                     │
│  Next.js 16 standalone · React 19 · single route "/"    │
│                                                          │
│  ┌── Client (browser) ──────────────────────────────┐   │
│  │ Zustand store + localStorage (offline-first)     │   │
│  │ 16 views client-side (page.tsx:22-41)            │   │
│  │ AuthProvider Context (auth.tsx)                  │   │
│  └──────────┬──────────────────────────────────────┘   │
│             │ supabase-js (anon key, pública)           │
│  ┌──────────▼──────────────────────────────────────┐   │
│  │ 6 API Routes (/api/*) — só 1 real:               │   │
│  │   POST /api/submit-match (valida + chama RPC)    │   │
│  │   GET /api/daily (stub implemented:false)        │   │
│  │   POST /api/match, /api/rooms (501)               │   │
│  │   GET /api/contracts (documentação futura)       │   │
│  └──────────┬──────────────────────────────────────┘   │
└─────────────┼────────────────────────────────────────────┘
              │ PostgREST + Realtime WebSocket
┌─────────────▼────────────────────────────────────────────┐
│                  SUPABASE (us-east-1)                     │
│  Postgres 17 · 11 tabelas (RLS em todas)                 │
│  Auth (email/senha + Google OAuth)                        │
│  15 RPCs (14 SECURITY DEFINER)                            │
│  Realtime publication: ranked_matches + ranked_queue      │
│    ⚠️ rooms/room_participants/chat_messages FORA (D-17)  │
│  Trigger handle_new_user (profile no signup)             │
│  Trigger protect_profile_fields (blindar rating/XP)      │
│    ⚠️ conflita com finish_ranked_match (C-05)            │
└───────────────────────────────────────────────────────────┘
```

**Não existe ORM em uso.** `prisma/schema.prisma` (template User/Post SQLite) e `src/lib/db.ts` estão presentes mas **nunca importados** — código morto. Toda comunicação com o banco é via `@supabase/supabase-js` (PostgREST) + RPCs SQL. O banco real do jogo é exclusivamente o Supabase Postgres.

## 2. Estrutura de pastas (linhas por arquivo-chave)

```
src/
├── app/
│   ├── layout.tsx (55)      # Root: fontes Geist, metadata, Providers + SonnerToaster(z 9999)
│   ├── page.tsx (53)        # ÚNICA rota: switch de 16 views por store.route
│   ├── globals.css (290)    # Tailwind 4 @theme oklch, keyframes sa-*, utilities
│   └── api/
│       ├── route.ts (10)            # GET /api → info
│       ├── contracts/route.ts (40)  # documentação de contratos futuros
│       ├── daily/route.ts (34)      # stub: implemented=false
│       ├── match/route.ts (24)      # 501
│       ├── rooms/route.ts (25)      # 501
│       └── submit-match/route.ts (112)  # ÚNICO backend real
├── lib/
│   ├── store/app-store.ts (647)          # Zustand: TODO o estado local
│   ├── persistence/local-storage.ts (94) # namespacing "sudoku-arena:*"
│   ├── sudoku/
│   │   ├── engine.ts (296)      # geração seeded c/ solução única
│   │   ├── types.ts (75)        # Board=number[81], PEERS, BOX_INDEX
│   │   ├── saved-game.ts (83)   # autosave c/ undo stacks
│   │   ├── solver-hint.ts (183) # dicas humanas (naked/hidden single...)
│   │   ├── difficulty-estimator.ts (176)
│   │   ├── share.ts (78)        # códigos SA1x... + URL #s=
│   │   └── board-image.ts (213) # export PNG canvas
│   ├── progression/
│   │   ├── progression.ts (146) # XP, níveis, cosméticos, DIVISIONS
│   │   ├── achievements.ts (221)# 15 conquistas
│   │   └── board-themes.ts      # 5 temas de tabuleiro (CSS vars)
│   ├── supabase/
│   │   ├── client.ts (44)   # singleton Proxy + isSupabaseConfigured
│   │   ├── auth.tsx (341)   # AuthProvider Context (VIVO)
│   │   ├── auth.ts (234)   # MORTO — duplicata antiga (resolução .tsx vence)
│   │   ├── matches.ts (602)# 23 funções (leaderboard, amigos, salas, chat...)
│   │   └── ranked.ts (266) # fila, heartbeat, finish, realtime
│   ├── i18n/ translations.ts (859) + context.tsx (41)  # ~390 chaves/idioma
│   ├── guide/content.ts (307)   # 13 técnicas bilíngues
│   ├── audio/sounds.ts (125)    # WebAudio sintetizado (12 padrões)
│   └── contracts/persistence.ts (268) # interfaces FUTURAS (não implementadas)
├── hooks/
│   ├── use-sudoku-game.ts (798) # reducer de jogo: coração do gameplay
│   ├── use-focus-trap.ts (89)
│   ├── use-toast.ts (193)   # MORTO
│   └── use-mobile.ts (19)   # MORTO (só ui/sidebar usa)
└── components/
    ├── layout/  # AppShell(376), AuthDialog(775), GoogleSignupCompletion(174),
    │            # GuidedTour(134), OnboardingDialog(54), Providers(57), toasts...
    ├── views/   # 16 views (Ranked 972, Overview 398, Duo 359, Profile 358...)
    ├── sudoku/  # SudokuBoard(245), SudokuGamePlay(291), NumberPad(144),
    │            # WinScreen(175), SolverDialog(153), ShareDialogs(174),
    │            # DivisionPromotionAnimation(199), DifficultyDialog(131)...
    ├── ui/      # 48 shadcn defaults (13 usados, 34+ mortos)
    ├── common/  # Avatar identicon(105), GuestLoginRequired(52), ComingSoon(58)
    ├── guide/   # GuideMiniBoard
    ├── daily/   # StreakCalendar (159)
    ├── settings/# BoardThemePreview, ResetProgressDialog
    └── profile/ # ProfileCharts (recharts)
```

## 3. Banco de dados (11 tabelas, RLS 100%, confirmado em produção)

### 3.1 Tabelas e relacionamentos

| Tabela | Colunas-chave | FK | RLS | Papel |
|--------|---------------|----|----|-------|
| `profiles` | id(uuid PK), username, display_name, avatar_seed, title_id, frame_id, effect_id, total_xp, level, rating, streak_freezes | id → auth.users ON DELETE CASCADE | ✅ | identidade pública única (username = display_name) |
| `matches` | user_id, mode(solo/daily/duo/ranked/guide), difficulty, elapsed_sec, errors, hints_used, completed, xp_earned, score, is_record | user_id → auth.users | ✅ | histórico de partidas |
| `daily_records` | user_id, date, difficulty, completed, elapsed_sec, score — UNIQUE(user_id,date,difficulty) | user_id | ✅ | recordes diários |
| `ranked_matches` | player1_id, player2_id, difficulty, board_seed, status(active/completed/abandoned), winner_id, finish_reason, player{1,2}_{progress,errors,cells_correct,rating_before,rating_after}, started_at, ended_at | players → auth.users | ✅ | partidas ranqueadas |
| `ranked_queue` | user_id UNIQUE, difficulty, joined_at, last_heartbeat | user_id | ✅ | fila de matchmaking |
| `friends` | user_id, friend_id, status(pending/accepted/blocked) — UNIQUE(user_id,friend_id), check user_id<>friend_id | ambos | ✅ | amizades |
| `rooms` | code UNIQUE(6 chars), is_private, difficulty, host_id, status(waiting/active/...) | host | ✅ | salas duo |
| `room_participants` | room_id, user_id, team(1/2), seat(1/2) — UNIQUE(room_id,user_id) | ambos | ✅ | assentos |
| `chat_messages` | thread_id(text), author_id, body | author | ✅ | chat (dormante; SELECT só autor — L-07) |
| `seasons` | name, starts_at, ends_at, reset_policy default 'partial', is_active | — | ✅ | temporadas (nenhuma UI/lógica usa) |
| `match_solutions` | **RLS nega todo acesso direto** | — | ✅ | soluções (JAMAIS populada — ver D-02) |

### 3.2 RPCs (15, todas SECURITY DEFINER exceto validate_sudoku_solution — confirmado via information_schema)

| RPC | Grant | O que faz | Validação |
|-----|-------|-----------|-----------|
| `finish_ranked_match(p_match_id uuid, p_solution int[], p_abandon bool)` | authenticated | **Autoritativa**: bloqueia a partida (FOR UPDATE), valida solução (grade válida — NÃO contra o puzzle real), calcula Elo K=32 (abandono −50 extra, floor 0), atualiza `profiles.{rating,total_xp,level}` dos DOIS jogadores atomicamente, insere 2 rows em `matches`, marca `completed/abandoned`, idempotente (retorna resultado existente). **⚠️ NÃO seta o GUC do trigger protect_profile → updates de profiles são REVERTIDOS (C-05, confirmado no banco: profiles zerados apesar de partidas com rating_after>0)** | Parcial + C-05 |
| `try_matchmake_atomic(p_difficulty)` | authenticated | Limpa fila stale (>30s), SELECT...FOR UPDATE **SKIP LOCKED**, exclui oponentes com partida ativa, cria match com seed `'ranked-'||epoch||'-'||md5(random())`, remove ambos da fila | Race do chamador não checa (D-07) |
| `check_my_ranked_match()` | authenticated | Retorna match_id ativo do chamador (mais recente) | — |
| `heartbeat_ranked_queue()` | authenticated | `UPDATE last_heartbeat = now()` do chamador | — |
| `update_ranked_progress(match_id, progress, errors, cells_correct)` | authenticated | Lock + escreve SÓ as colunas do chamador (player1_* ou player2_* conforme auth.uid()); ignora se status≠active | ✅ autoria; valores client-authoritative (cosméticos) |
| `validate_sudoku_solution(int[])` | PUBLIC (default, sem grant explícito) | Valida linhas/colunas/caixas de um grid 81 (INVOKER) | estrutura apenas |
| `get_email_by_username(username)` | **anon + authenticated** | Retorna email do usuário por username | ⚠️ vazamento C-01 |
| `check_username_available(username)` | anon + authenticated | Disponibilidade (3-20 chars, `[a-zA-Z0-9_]`, case-insensitive) | ✅ |
| `set_username(username)` | authenticated | Define username do chamador (case-insensitive unique) | ✅ |
| `search_user_by_username(username)` | authenticated | Busca amigo por username (exclui self) | ✅ |
| `submit_match_result(mode, difficulty, elapsed_sec, errors, hints, completed, xp_earned, score, final_board, is_record)` | authenticated | Insere match + soma XP/level do chamador. Setam GUC de bypass (session-scoped ⚠️). Level usa fórmula `1+floor(xp/150)` divergente do resto (M-10) | ⚠️ XP sem teto (C-04) |
| `update_user_rating(rating_change ±100)` | authenticated | Soma rating ao próprio perfil (seta GUC). **Sem caller no app — revogar (C-03)** | ⚠️ C-03 |
| `update_display_info(display_name, avatar_seed)` | authenticated | Atualiza cosmetics do próprio perfil (coalesce preserva vazios) | ✅ |
| `handle_new_user()` | trigger | Cria profile no signup: username = user_metadata.username ‖ prefixo do email; sanitiza `[^a-zA-Z0-9_]` | ✅ |
| `protect_profile_fields()` | trigger | Reverte write direto em `total_xp/level/rating/streak_freezes` a menos que `app.skip_profile_protection='true'` | ⚠️ fora do runner (D-08) + conflito C-05 |

### 3.3 Triggers (confirmados instalados via information_schema.triggers)

1. `on_auth_user_created` → `handle_new_user()`: INSERT em `profiles` no signup.
2. `protect_profile` (BEFORE UPDATE em profiles) → `protect_profile_fields()`: blindar progressão contra write direto do cliente; RPCs setam GUC `app.skip_profile_protection` para passar. **C-05: `finish_ranked_match` não o faz.**

### 3.4 Quem escreve o quê

| Operação | Caminho | Confiança |
|----------|---------|-----------|
| Rating, XP, level | Apenas RPCs `finish_ranked_match` / `submit_match_result` (+ trigger guard) | Server-side (com lacunas C-02/C-03/C-04/C-05) |
| Progresso ranked por jogada | RPC `update_ranked_progress` (após cada placement, RankedView:514-521) | Server restringe às colunas próprias; valores client-authoritative |
| matches INSERT | Direto pelo cliente (`saveMatchToCloud`, matches.ts:69) **e** via RPC `submit_match_result` — duplicação (M-08) | Misto |
| daily_records UPSERT | Direto (`saveDailyToCloud`, matches.ts:166) | Cliente |
| friends/rooms/participants | Direto com RLS de participação | Cliente |
| Fila | INSERT/DELETE direto + RPC heartbeat | Cliente |

## 4. Autenticação (auth.tsx — o VIVO)

- **Provider:** `AuthProvider` (Context) em `Providers.tsx:50`. `useAuth()` lança fora do provider. `user, loading, isGuest` compartilhados.
- **Init:** lazy `initialGuest` do localStorage → se guest, user=Visitante sem rede; senão `getSession()` → `getUser()` (validação de rede; usuário deletado → signOut) → profile lookup (profile ausente → signOut).
- **Login:** `signInWithUsernameOrEmail` — se contém `@`, email direto; senão RPC `get_email_by_username` → `signInWithPassword` (trade-off C-01 documentado no código).
- **Signup:** `signUpWithEmail` — user_metadata `{username, display_name: username}`; trigger cria profile. Confirmação de email: se Supabase exigir (sem sessão no retorno), app mostra "verifique seu email" (AuthDialog:113-116). Senha forte 8+/A/a/n/especial validada **só no frontend** (M-04).
- **Username:** verificação live com debounce (AuthDialog:33-59) + re-check no submit; índice unique `lower(username)` no DB.
- **Google:** `signInWithOAuth` com `redirectTo: origin`, `prompt: select_account`. Fluxo **implicit** (sem PKCE — M-03). Usuário Google sem username → `GoogleSignupCompletion` bloqueia o app até escolher username (AppShell:265-267).
- **Reset:** `resetPasswordForEmail` → email → link `origin/#reset` (tela de DEFINIR nova senha pós-link não implementada — fluxo para no envio).
- **Visitante:** flag `sudoku-arena-guest` no localStorage (**fora do namespace `sudoku-arena:` — L-11: clearAll/exportAll não cobrem**); `GuestLoginRequired` bloqueia Duo/Ranked/Leaderboard/Friends.
- **Logout:** `signOut({scope:"local"})` + limpeza manual de `sb-*` do localStorage (auth.tsx:299-311).

## 5. Fluxo de jogo — máquina de estados

### 5.1 Solo/Diário/Prática (`use-sudoku-game.ts`, 798 ln)

`useReducer` com 20 actions (NEW/LOAD/SELECT/SET_VALUE/TOGGLE_NOTE/ERASE/UNDO/REDO/HINT/TOGGLE_NOTES_MODE/AUTO_NOTES/CLEAR_NOTES/CHECK/SET_HIGHLIGHT_DIGIT/SET_NOTES/PAUSE/RESUME/TICK/RESTART/CLEAR). Estado: puzzle/solution/board/notes/given, seed, elapsedSec, mistakes, hintsUsed, undo/redo stacks, highlightDigit, status(playing/paused/won).

- **Geração:** `generatePuzzle(difficulty, seed)` (engine.ts:237-296): PRNG `mulberry32` (seed via FNV-1a) → tabuleiro resolvido (backtracking) → escavação **simétrica** (idx e 80−idx) mantendo **solução única** (`countSolutions(limit 2)`, MRV solver). Alvos de givens: easy 36-45 / medium 30-35 / hard 26-30 / expert 22-26.
- **Diário:** seed = `daily-${date}-${difficulty}-v1` (UTC — D-16) — determinístico, sem servidor.
- **Autosave:** debounce 400ms em toda mudança; resume no mount; undo stacks sobrevivem reload (chaves `sudoku-arena:saved-game` / `saved-game-daily`).
- **Erros:** conta apenas placement NOVO errado; `maxErrors` (default 5, 0=∞) — **só mostra banner, não encerra** (D-11).
- **Dicas:** revelam `solution[cel]` (target errado/selecionado, senão random candidate — usa `Math.random()`, não determinístico — D-12); `maxHints` default 3.
- **Vitória:** `isComplete(board)` → WinScreen (confetti CSS, XP, conquistas, recordes, focus-trap) + `recordGame` (XP local) + `recordDaily` (se diário) + `checkAchievements` + save na nuvem fire-and-forget.
- **XP:** `computeXp` = 60 × multDif(1/1.5/2/2.8) × multModo(solo 1, daily 1.2, guide 0.3, duo 1.8, ranked 2.2) × fatorTempo(clamp 0.5-2; refs 360/720/1200/1800s) − 8·erros − 10·dicas, floor 15; não completado = 5 XP.
- **Teclado físico:** 1-9 valor; 0/Backspace/Delete apaga; N notas; H dica; P/Esc pausa; A auto-notas; C check; `?` ajuda; Ctrl+Z/Ctrl+Shift+Z undo/redo; setas movem seleção (SudokuGamePlay:52-91).

### 5.2 Ranked (RankedView 972 ln + ranked.ts 266 ln)

Fluxo: `lobby → queue → match → result`. Exige login (guest vê GuestLoginRequired). Dificuldade **hardcoded "medium"** (sem seletor).

- **Fila** (`ranked_queue`): INSERT + heartbeat a cada 10s (RPC `heartbeat_ranked_queue`); expira >30s; poll de 2s alternando `tryMatchmake` (RPC `try_matchmake_atomic`) e `checkForMatch` (RPC `check_my_ranked_match`).
- **Board:** `generatePuzzle(difficulty, board_seed)` **no cliente** — ambos jogadores derivam o MESMO tabuleiro do seed compartilhado (solução fica no cliente — D-01/C-02). RankedView usa board/notes/keyboard próprios (não `useSudokuGame`/`SudokuGamePlay`).
- **Vitória:** primeiro `isComplete(newBoard)` → `handleFinish(false, newBoard)` (o board é passado EXPLICITAMENTE como parâmetro para evitar stale state — bug histórico documentado no código).
- **Derrota:** 3 erros → `handleFinish(true)` (tratado como abandono, −50 extra — atalho documentado D-08b); oponente termina → realtime UPDATE em `ranked_matches` → perdedor registra `recordGame` local + atualiza rating + tela de resultado (RankedView:310-347).
- **Finalização server-side:** RPC `finish_ranked_match` (idempotente, FOR UPDATE, Elo K=32, XP, matches INSERT para ambos, profiles UPDATE para ambos — **que o trigger reverte — C-05**).
- **XP duplicado mitigado:** `recordGame` local soma XP, depois `updateProfile({ totalXp: result.totalXp })` sobrescreve com o valor do servidor (RankedView:433-435).
- **Abandono:** botão Desistir + modal; navegação interceptada (`ranked-abandon-attempt` event → AppShell modal → `ranked-forfeit-confirm` → handleFinish(true)).
- **Timer:** conta para cima, sem limite (comentário "no 10 min limit" — RankedView:146); ⚠️ a regra exibida (`ranked.rules.1`) ainda diz "dez minutos" — inconsistência texto×código.
- **Resultado:** 3-5s animado (rating antes→ganhos→final, tempo, erros, liga); promoção de divisão → `DivisionPromotionAnimation` full-screen 4 estágios (respeita `prefers-reduced-motion`); rebaixamento sem animação.
- **Teclado (match):** 1-9, 0/Backspace, N, setas — sem undo/dica (subconjunto competitivo). Botões hint/undo do NumberPad são stubs `() => {}`.

### 5.3 Duo — SHELL APENAS

`createRoom`/`joinRoom` (código 6-char `Math.random`) funcionam no banco, mas: botão "Iniciar partida" **sem onClick** (DuoView:226-230), sem tabuleiro compartilhado, chat wired no data-layer mas sem caller, leave sem DELETE server (DuoView:105-110), join read-then-insert (race de assentos D-09), fetch seleciona `display_name` mas view lê `username` (sempre null — D-04) e **presença realtime é muda** (tabelas fora da publication — D-17): a lista de participantes só atualiza por re-fetch manual.

## 6. Ranking e rating

- **Elo:** `finish_ranked_match` — E_a = 1/(1+10^((R_b−R_a)/400)); Δ = round(32·(S_a−E_a)); abandono: −50 extra (ou força −50 se Elo daria ganho); floor rating 0; ambos profiles atualizados atomicamente; idempotente por match (FOR UPDATE + status check). Rating inicial **0** (não 1200) — `profiles.rating default 0`.
- **Divisões** (progression.ts:128-136): bronze 0, silver 800, gold 1600, platinum 2400, diamond 3200, master 4000, grandmaster 5000. `localDivision(rating)` (app-store.ts:637) espelha no cliente — devem ficar em sync.
- **Leaderboard:** `fetchGlobalLeaderboard` — SELECT top 50 por rating DESC de profiles (RLS: using(true)). Auto-refresh no focus da aba + interval 30s (LeaderboardView:96-102) + refresh do próprio rating no mount. Sem filtro por período/divisão/amigos.
- **XP/level:** server: `finish_ranked_match` recalcula level com laço `while rem >= 100+50·level`; ⚠️ `submit_match_result` usa `1+floor(xp/150)` — fórmulas divergentes (M-10). Cliente: `levelFromXp` idêntico ao ranked.
- **XP ranked (server):** vitória 60/80/100/120 (easy..expert) +50% se <300s ou +25% se <600s, −5·erro, floor 30; derrota 15; abandono 5.

## 7. Realtime (Supabase channels) — estado REAL da publication

| Canal | Tabela(s) | Na publication? | Uso |
|-------|-----------|-----------------|-----|
| `ranked:{matchId}` | ranked_matches UPDATE | ✅ SIM | oponente terminou → resultado para o perdedor (funciona) |
| `room:{roomId}` | room_participants, rooms | ❌ **NÃO** | presença duo — **canal mudo, nunca recebe eventos (D-17)** |
| `chat:{threadId}` | chat_messages | ❌ **NÃO** | chat dormante — funcionaria se ativado? Não, sem publication (D-17) |
| (fila) | ranked_queue | ✅ SIM | (sem subscriber atual; heartbeat é polling) |

## 8. Deploy e configuração

- **Vercel:** `vercel.json` { framework nextjs, buildCommand "next build", installCommand "bun install", github.enabled true, git.deploymentEnabled true } → auto-deploy por push.
- **Env vars (.env, NÃO commitado; verificado `git rev-list --all -- .env` vazio):** `NEXT_PUBLIC_SUPABASE_URL` (pública), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pública), `DATABASE_URL` (Prisma morto), `SUPABASE_ACCESS_TOKEN` (admin Management API — usado pelo runner; NUNCA commitar), `SUPABASE_PROJECT_REF`. Vercel dashboard: as duas NEXT_PUBLIC_ configuradas (app conecta em produção).
- **Migrations:** `bun run supabase:migrate` → `.zscripts/run-migrations.sh` roda 10 SQLs na ordem via Management API e verifica 7 RPCs. ⚠️ `supabase-security.sql` **não está na lista** (D-08) — instalado manualmente no banco atual.
- **Build:** `output: standalone` + cópia de static/public; `typescript.ignoreBuildErrors: true` (erros TS não quebram build); `reactStrictMode: false`.

## 9. Estado (Zustand app-store.ts)

Slices persistidos (localStorage `sudoku-arena:*`): settings (locale, tema, autoCheck, highlights, showTimer, candidateCount, maxErrors 5, maxHints 3, soundEnabled, boardTheme), profile (username/avatar/cosmetics/totalXp/rating local), stats (5 modos × 4 dificuldades), history (cap 200), daily-records, onboarding, streak, achievements. Não-persistidos: route, activeRankedMatchId, levelUps/achievementToasts (transientes), practiceBoard, hydrated, level (derivado).

`hydrate()` roda 1× no mount (Providers.tsx:44-46) — merge de settings sobre defaults, recomputa level.

**Sincronização local↔servidor:** profile.totalXp/rating locais são "preview"; ranked é server-authoritative na intenção (RPC escreve e devolve; cliente sobrescreve o local com o valor do servidor) — **mas C-05 faz o valor do servidor NÃO persistir**, então no próximo sync o rating local "volta" a 0. Solo/daily: cliente escreve local E na nuvem (fire-and-forget) — fonte de verdade duplicada (M-08).

## 10. Validação de dados — onde acontece

| Dado | Frontend | Servidor |
|------|----------|----------|
| Senha forte | ✅ 8+/A/a/n/especial (AuthDialog:758) | ❌ (Supabase Auth default ≥6) |
| Username formato | ✅ regex input | ✅ RPC set_username/check |
| Username duplicado | ✅ check live + ✅ índice unique lower() no DB |
| Solução ranked | ✅ isComplete client | ⚠️ valida grade, NÃO valida contra o puzzle (C-02); e persistência de rating revertida (C-05) |
| Bounds submit-match | ✅ | Parcial (tempo ≤3600, erros ≤100; XP sem teto C-04) |
| Rate limit | ❌ | ❌ |

## 11. Testes

- **Automatizados: 0.** Sem unit/integration/E2E de aplicação.
- `bun run lint` (ESLint 9 flat, ~30 rules off) e `npx next build` são os únicos gates.
- `tests/` contém 3 scripts de infra do sandbox (não testam o app).
- QA histórico feito manualmente via `agent-browser` no Vercel (documentado no worklog.md).

---

# PARTE III — INVENTÁRIO DE FUNCIONALIDADES

> Status: ✅ = implementado e verificado no código · 🟡 = parcialmente implementado · 📋 = planejado/mencionado (contratos) · ❌ = não encontrado · ❔ = não foi possível verificar.
> Evidência = arquivo:linha. Atualizado com os achados da reverificação de banco (C-05, D-17).

## Autenticação e contas

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Cadastro email+senha | ✅ | AuthDialog.tsx:361-429; auth.tsx:228-238 | Senha forte só frontend (M-04) |
| Login por username OU email | ✅ | auth.tsx:189-221 via RPC get_email_by_username | RPC vaza email a anon (C-01) |
| Login Google OAuth | ✅ | auth.tsx:240-249 | Fluxo implicit, sem PKCE (M-03) |
| Conclusão de cadastro Google (username obrigatório) | ✅ | GoogleSignupCompletion.tsx; AppShell.tsx:265-267 | Bloqueia app até escolher username |
| Verificação de username disponível (live) | ✅ | AuthDialog.tsx:33-59; RPC check_username_available | Case-insensitive |
| Username único case-insensitive | ✅ | Índice unique lower(username) fix-leaderboard-friends.sql:34-36 | |
| Recuperação de senha (pedido de email) | ✅ | AuthDialog.tsx:176-191; auth.tsx:253-258 | Tela de DEFINIR nova senha pós-link não implementada |
| Sessão persiste (reload) | ✅ | auth.tsx:102-180 | getSession+getUser+profile |
| Auto-logout de usuário deletado | ✅ | auth.tsx:148-180 | getUser falha ou profile ausente → signOut |
| Modo visitante | ✅ | auth.tsx:263-287; GuestLoginRequired.tsx | Flag fora do namespace (L-11) |
| Logout | ✅ | auth.tsx:291-311 | scope "local" (por design) |
| Exclusão de conta (self-service) | ✅ | policy DELETE profiles; audit-fixes.sql:43-44 | Via API; sem UI dedicada |
| Confirmação de email | 🟡 | AuthDialog.tsx:112-116 | Depende da config do Supabase dashboard (❔) |

## Modos de jogo

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Solo — 4 dificuldades | ✅ | SoloView.tsx:92-108; engine.ts:230-235 | Givens 36-45/30-35/26-30/22-26 |
| Solo — solução única garantida | ✅ | engine.ts:57-96, :260 | countSolutions MRV |
| Solo — anotações (lápis) | ✅ | use-sudoku-game.ts:168-182 | SET_VALUE limpa peers |
| Solo — desfazer/refazer | ✅ | use-sudoku-game.ts:400-442 | Stacks persistem no autosave |
| Solo — dicas | ✅ | use-sudoku-game.ts:345-398 | Target usa Math.random() (D-12) |
| Solo — pausar (board oculto) | ✅ | SudokuGamePlay.tsx:228-238 | Timer para |
| Solo — autosave/resume | ✅ | use-sudoku-game.ts:471-500 | debounce 400ms |
| Solo — teclado completo | ✅ | SudokuGamePlay.tsx:52-91 | 1-9, 0/Bksp/Del, N, H, P/Esc, A, C, ?, Ctrl+Z, setas |
| Solo — limite de erros encerra jogo | ❌ | SudokuGamePlay.tsx:165-169 | Apenas banner visual (D-11) |
| Solo — compartilhar tabuleiro (código/URL) | ✅ | share.ts; ShareDialogs.tsx | Formato SA1x + 81 dígitos + URL #s= |
| Solo — exportar imagem PNG | ✅ | board-image.ts; ExportImageDialog.tsx | |
| Solo — estimador de dificuldade | ✅ | difficulty-estimator.ts | Simula solving lógico, 6 níveis |
| Solo — solver didático | ✅ | solver-hint.ts | naked/hidden single, pairs + fallback |
| Guia — 13 técnicas / 3 níveis | ✅ | guide/content.ts:43-271 | |
| Guia — mini-tabuleiros ilustrados | ✅ | GuideMiniBoard.tsx:26-67 | 5 tipos de célula |
| Guia — prática jogável com XP | ✅ | GuideView.tsx:169-173; content.ts:288-307 | 0.3× XP; salva como "solo" (D-13) |
| Diário — tabuleiro por data determinístico | ✅ | use-sudoku-game.ts:644 | seed `daily-{date}-{dif}-v1` UTC (D-16) |
| Diário — streak com freezes | ✅ | app-store.ts:554-602 | Freeze em gap; ganho nos níveis 3/7/14 |
| Diário — replay de dias passados | ✅ | DailyView.tsx:179-188; StreakCalendar | Corrompe streak (D-06) |
| Diário — leaderboard global do dia | ❌ | — | Não existe |
| Archive — puzzles semanais | ✅ | ArchiveView.tsx:1-159 | Seeds ISO-week, 12 semanas |
| Ranked — fila com heartbeat | ✅ | RankedView.tsx:207-220; ranked.ts:53-78 | 10s ping; expira >30s |
| Ranked — matchmaking atômico | ✅ | RPC try_matchmake_atomic (SKIP LOCKED) | Race do chamador (D-07) |
| Ranked — mesmo tabuleiro (seed) | ✅ | RankedView.tsx:293-297 | Solução no cliente (D-01) |
| Ranked — primeiro que resolve vence | ✅ | RankedView.tsx:471-480; RPC finish_ranked_match | |
| Ranked — 3 erros = derrota | ✅ | RankedView.tsx:486-489 | Tratada como abandono com −50 (D-08b) |
| Ranked — Elo server-side K=32 | 🟡 | supabase-ranked-xp-matches.sql:330-347 | ⚠️ Cálculo correto e gravado NA PARTIDA, mas **persistência em profiles revertida pelo trigger (C-05)** |
| Ranked — penalidade abandono −50 | ✅ | idem:420-429 | (rating_after da partida; profile não persiste — C-05) |
| Ranked — idempotência (sem double-XP) | ✅ | idem:62-85 | FOR UPDATE + status check |
| Ranked — XP + matches p/ AMBOS jogadores | ✅ | idem:210-240 | matches grava ✅; profiles XP revertido (C-05) |
| Ranked — progress sync por jogada | ✅ | RankedView.tsx:514-521; RPC update_ranked_progress | ~50 RPCs/partida (Fase 6.1) |
| Ranked — realtime (oponente terminou) | ✅ | ranked.ts:202-225; RankedView.tsx:310-347 | Perdedor registra no histórico |
| Ranked — desistência com modal | ✅ | RankedView.tsx:720-727, 813-842 | |
| Ranked — interceptação de navegação | ✅ | AppShell.tsx:134-141, 229-250, 347-373 | events customizados |
| Ranked — teclado (1-9, 0, N, setas) | ✅ | RankedView.tsx:165-205 | Sem undo/dica |
| Ranked — timer sem limite (conta ↑) | ✅ | RankedView.tsx:146-158 | Regra exibida ainda diz "dez minutos" (inconsistência) |
| Ranked — dificuldade selecionável | ❌ | RankedView.tsx:241,250 | Hardcoded "medium" |
| Ranked — dica/undo no NumberPad | ❌ | RankedView.tsx:707-714 | Stubs `() => {}` |
| Duo — criar/entrar sala por código | ✅ | matches.ts:485-558; DuoView.tsx:81-98 | |
| Duo — presença realtime | ❌ | matches.ts:560-588 | **Tabelas fora da publication → canal mudo (D-17, confirmado no banco)** |
| Duo — partida jogável | ❌ | DuoView.tsx:226-230 | Botão "Iniciar" SEM onClick |
| Duo — tabuleiro compartilhado | ❌ | — | |
| Duo — chat | ❌ | matches.ts:434-479 sem caller | Infra existe; publication não (D-17) |
| Duo — sair remove participante | ❌ | DuoView.tsx:105-110 | Só limpa local |
| Duo — salas públicas (browser) | ❌ | is_private só é flag | |

## Social / comunidade

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Amigos — busca por username | ✅ | FriendsView.tsx:173-199; RPC search_user_by_username | Exata, sem busca parcial |
| Amigos — enviar/aceitar/recusar | ✅ | matches.ts:195-417 | |
| Amigos — bloquear | 🟡 | matches.ts:419 blockUser | status blocked nunca verificado server-side |
| Leaderboard — top 50 global | ✅ | matches.ts:43-64; LeaderboardView | ⚠️ todos rating 0 enquanto C-05 persistir |
| Leaderboard — auto-refresh | ✅ | LeaderboardView:96-102 | focus + 30s |
| Leaderboard — divisões com emblemas | ✅ | DIVISIONS progression.ts:128-136 | |
| Chat | ❌ | infra existe (chat_messages, RLS author-only) | RLS impede destinatário LER (L-07) + D-17 |

## Progressão e perfil

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| XP + níveis | ✅ | progression.ts:8-25; recordGame app-store.ts:468-552 | 100+50·n (⚠️ M-10 divergência em submit_match_result) |
| Cosméticos (6 molduras, 6 títulos, 4-5 efeitos) | ✅ | COSMETICS progression.ts:94-114; ProfileView | Níveis 1-18 |
| 15 conquistas com XP | ✅ | achievements.ts; AchievementToast | 50-500 XP bônus |
| Histórico (cap 200) | ✅ | HistoryView.tsx; recordGame:513 | Ranked derrota = "Derrota" (não "Abandonada") |
| Recordes por dificuldade | ✅ | RecordsView.tsx | Medalhas 🥇🥈🥉 |
| Gráficos de estatísticas | ✅ | OverviewView + ProfileCharts (recharts) | Radar + barras + área |
| Export/import/reset de dados | ✅ | local-storage.ts:66-91; SettingsView | ⚠️ guest flag fora (L-11) |
| Avatar identicon determinístico | ✅ | Avatar.tsx:1-105 | SVG próprio FNV-1a |
| Sons (12 efeitos WebAudio) | ✅ | sounds.ts:1-125 | Zero assets |
| Temas de tabuleiro (5) | ✅ | board-themes.ts | CSS vars injetadas no board |
| Tema claro/escuro | ✅ | next-themes; Providers.tsx:49 | oklch |
| i18n pt-BR/en | ✅ | translations.ts (~390 chaves/idioma); context.tsx | Fallback en→key |
| Tour guiado | ✅ | GuidedTour.tsx (7 passos) | Só autenticado |
| Onboarding de idioma | ✅ | OnboardingDialog.tsx | 1ª execução |
| Animação promoção de divisão | ✅ | DivisionPromotionAnimation.tsx | 4 estágios, prefers-reduced-motion |
| Animação vitória/derrota ranked 3-5s | ✅ | RankedView ResultScreen:845-971 | |
| Conquistas/level-up toasts | ✅ | LevelUpToast.tsx; AchievementToast.tsx | |
| Streak calendar (13 semanas) | ✅ | StreakCalendar.tsx:1-159 | GitHub-style, 5 níveis |
| Divisões: Bronze→Grandmaster | ✅ | progression.ts:128-136 | 0/800/1600/2400/3200/4000/5000 |
| Temporadas (seasons) | 🟡 | Tabela existe (schema.sql:94-101) | Nenhuma UI/lógica usa |
| Títulos/molduras/efeitos equipáveis | ✅ | ProfileView cosmetics picker | Persistidos no profile |

## Infra/UX

| Funcionalidade | Status | Evidência |
|---|---|---|
| Responsivo mobile/desktop | ✅ | AppShell Sheet; SudokuBoard max-w 30rem; clamp() |
| Rodapé sticky | ✅ | AppShell.tsx:343-347 |
| Alt+setas navegação | ✅ | AppShell.tsx:200-217 |
| Acessibilidade (aria grid, focus-visible, focus-trap) | ✅ | SudokuBoard role=grid/gridcell; use-focus-trap |
| prefers-reduced-motion | ✅ | DivisionPromotionAnimation:35-74 |
| Deploy Vercel auto-GitHub | ✅ | vercel.json |
| Migrations automatizadas via API | 🟡 | .zscripts/run-migrations.sh | ⚠️ security.sql fora (D-08) |
| Realtime publication completa | ❌ | ranking ✅; rooms/chat ❌ (D-17) |
| Testes automatizados | ❌ | Nenhum |
| Rate limiting | ❌ | Nenhum |
| Monitoramento/telemetria/analytics | ❌ | Nenhum |

## Contratos futuros (só planejado — 📋)

`src/lib/contracts/persistence.ts` define interfaces NÃO implementadas: AuthService completo, MatchService com MoveAck/MatchState, RoomService com eventos, RankingService com seasons, XpService, FriendsService, ChatService, ReportService, DailyChallengeService. `GET /api/contracts` documenta 9 requisitos de segurança futuros (solução oculta, scoring server-side etc.) — hoje parcialmente cumpridos apenas no ranked.

---

*Fim do Arquivo 1 de 2 — bugs priorizados, backlog e handoff para IA estão em `docs/AUDITORIA-BUGS-PLANO.md`. Nenhum arquivo de código foi modificado durante esta auditoria.*
