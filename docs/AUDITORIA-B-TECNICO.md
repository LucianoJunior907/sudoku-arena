# Sudoku Arena — Documento B: Documentação Técnica

> Base: código-fonte real (commit `6300eed`) + banco de produção confirmado via Supabase Management API em 28/10/2026. Evidências citadas como `arquivo:linha`.

---

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
│  │   GET /api/daily (stub implemented:false)         │   │
│  │   POST /api/match, /api/rooms (501)               │   │
│  │   GET /api/contracts (documentação)              │   │
│  └──────────┬──────────────────────────────────────┘   │
└─────────────┼────────────────────────────────────────────┘
              │ PostgREST + Realtime WebSocket
┌─────────────▼────────────────────────────────────────────┐
│                  SUPABASE (us-east-1)                     │
│  Postgres 17 · 11 tabelas (RLS em todas)                 │
│  Auth (email/senha + Google OAuth)                        │
│  15 RPCs SECURITY DEFINER                                 │
│  Realtime (ranked_matches, ranked_queue, rooms, chat)     │
│  Trigger handle_new_user (profile no signup)             │
│  Trigger protect_profile_fields (blindar rating/XP)      │
└───────────────────────────────────────────────────────────┘
```

**Não existe ORM em uso.** `prisma/schema.prisma` (User/Post demo SQLite) e `src/lib/db.ts` estão presentes mas **nunca importados** — código morto. Toda comunicação com o banco é via `@supabase/supabase-js` (PostgREST) + RPCs SQL.

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
│   │   └── achievements.ts (221)# 15 conquistas
│   ├── supabase/
│   │   ├── client.ts (44)   # singleton Proxy + isSupabaseConfigured
│   │   ├── auth.tsx (341)   # AuthProvider Context (VIVO)
│   │   ├── auth.ts (234)   # MORTO — duplicata antiga
│   │   ├── matches.ts (602)# 23 funções (leaderboard, amigos, salas...)
│   │   └── ranked.ts (266) # fila, heartbeat, finish, realtime
│   ├── i18n/ translations.ts (859) + context.tsx (41)
│   ├── guide/content.ts (307)   # 13 técnicas bilíngues
│   ├── audio/sounds.ts (125)    # WebAudio sintetizado
│   └── contracts/persistence.ts (268) # interfaces FUTURAS (não implementadas)
├── hooks/
│   ├── use-sudoku-game.ts (798) # reducer de jogo: coração do gameplay
│   ├── use-focus-trap.ts (89)
│   ├── use-toast.ts (193)   # MORTO
│   └── use-mobile.ts (19)   # MORTO
└── components/
    ├── layout/  # AppShell(376), AuthDialog(775), GoogleSignupCompletion(174),
    │            # GuidedTour(134), OnboardingDialog(54), Providers(57), toasts...
    ├── views/   # 16 views (Ranked 972, Overview 398, Duo 359, Profile 358...)
    ├── sudoku/  # SudokuBoard(245), SudokuGamePlay(291), NumberPad(144),
    │            # WinScreen(175), SolverDialog(153), ShareDialogs(174),
    │            # DivisionPromotionAnimation(199), DifficultyDialog(131)...
    ├── ui/      # 47 shadcn defaults (13 usados, 34 mortos)
    └── common/  # Avatar identicon(105), GuestLoginRequired(52), ComingSoon(58)
```

## 3. Banco de dados (11 tabelas, RLS 100%, confirmado em produção)

### 3.1 Tabelas e relacionamentos

| Tabela | Colunas-chave | FK | RLS | Papel |
|--------|---------------|----|----|-------|
| `profiles` | id(uuid PK), username, display_name, avatar_seed, title_id, frame_id, effect_id, total_xp, level, rating, streak_freezes | id → auth.users ON DELETE CASCADE | ✅ | identidade pública única (username = display_name) |
| `matches` | user_id, mode(solo/daily/duo/ranked/guide), difficulty, elapsed_sec, errors, hints_used, completed, xp_earned, score, is_record | user_id → auth.users | ✅ | histórico de partidas |
| `daily_records` | user_id, date, difficulty, completed, elapsed_sec, score — UNIQUE(user_id,date,difficulty) | user_id | ✅ | recordes diários |
| `ranked_matches` | player1_id, player2_id, difficulty, board_seed, status(active/completed/abandoned), winner_id, finish_reason, player{1,2}_{progress,errors,cells_correct,rating_before,rating_after} | players → auth.users | ✅ | partidas ranqueadas |
| `ranked_queue` | user_id UNIQUE, difficulty, joined_at, last_heartbeat | user_id | ✅ | fila de matchmaking |
| `friends` | user_id, friend_id, status(pending/accepted/blocked) — UNIQUE(user_id,friend_id) | ambos | ✅ | amizades |
| `rooms` | code UNIQUE, is_private, difficulty, host_id, status | host | ✅ | salas duo |
| `room_participants` | room_id, user_id, team(1/2), seat(1/2) — UNIQUE(room_id,user_id) | ambos | ✅ | assentos |
| `chat_messages` | thread_id(text), author_id, body | author | ✅ | chat (dormant) |
| `seasons` | name, starts_at, ends_at, reset_policy, is_active | — | ✅ | temporadas (não usado) |
| `match_solutions` | **RLS nega todo acesso direto** | — | ✅ | soluções (JAMAIS populada — ver risco D-02) |

### 3.2 RPCs (15, todas SECURITY DEFINER exceto validate_sudoku_solution)

| RPC | Grant | O que faz | Validação |
|-----|-------|-----------|-----------|
| `finish_ranked_match(match_id, solution int[], abandon bool)` | authenticated | **Autoritativa**: bloqueia a partida (FOR UPDATE), valida solução (grade válida — NÃO contra o puzzle real), calcula Elo K=32 (abandão −50 extra, floor 0), atualiza `profiles.{rating,total_xp,level}` dos DOIS jogadores atomicamente, insere 2 rows em `matches`, marca `completed/abandoned`, idempotente (retorna resultado existente) | Parcial |
| `try_matchmake_atomic(difficulty)` | authenticated | Limpa fila stale (>30s), SELECT...FOR UPDATE **SKIP LOCKED**, exclui oponentes com partida ativa, cria match com seed, remove ambos da fila | Race do chamador não checa (D-07) |
| `check_my_ranked_match()` | authenticated | Retorna match_id ativo do chamador | — |
| `heartbeat_ranked_queue()` | authenticated | `UPDATE last_heartbeat = now()` do chamador | — |
| `update_ranked_progress(match_id, progress, errors, cells_correct)` | authenticated | Atualiza SÓ as colunas do chamador (player1_* ou player2_*) | ✅ |
| `validate_sudoku_solution(int[])` | — | Valida linhas/colunas/caixas de um grid 81 | estrutura apenas |
| `get_email_by_username(username)` | **anon + authenticated** | Retorna email do usuário por username | ⚠️ vazamento C-01 |
| `check_username_available(username)` | anon + authenticated | Disponibilidade (3-20 chars, `[a-zA-Z0-9_]`, case-insensitive) | ✅ |
| `set_username(username)` | authenticated | Define username do chamador (case-insensitive unique) | ✅ |
| `search_user_by_username(username)` | authenticated | Busca amigo por username (exclui self) | ✅ |
| `submit_match_result(mode, difficulty, elapsed_sec, errors, hints, completed, xp_earned, score, final_board, is_record)` | authenticated | Insere match + soma XP/level do chamador | ⚠️ XP sem teto (C-04) |
| `update_user_rating(rating_change ±100)` | authenticated | Soma rating ao próprio perfil (bypassa trigger via GUC) | ⚠️ C-03, sem caller no app |
| `update_display_info(display_name, avatar_seed)` | authenticated | Atualiza cosmetics do próprio perfil | ✅ |
| `handle_new_user()` | trigger | Cria profile no signup: username = user_metadata.username || prefixo do email; sanitiza | ✅ |
| `protect_profile_fields()` | trigger | Reverte write direto em `total_xp/level/rating/streak_freezes` a menos que `app.skip_profile_protection='true'` | ⚠️ fora do runner (D-08) |

### 3.3 Triggers

1. `on_auth_user_created` → `handle_new_user()`: INSERT em `profiles` no signup.
2. `protect_profile_fields` (BEFORE UPDATE em profiles): blindar progressão contra write direto do cliente; RPCs setam GUC `app.skip_profile_protection` para passar.

### 3.4 Quem escreve o quê

| Operação | Caminho | Confiança |
|----------|---------|-----------|
| Rating, XP, level | Apenas RPCs `finish_ranked_match` / `submit_match_result` (+ trigger guard) | Server-side (com lacunas C-02/C-03/C-04) |
| Progresso ranked por jogada | RPC `update_ranked_progress` (chamada após cada placement, RankedView:514-521) | Server restringe às colunas próprias |
| matches INSERT | Direto pelo cliente (`saveMatchToCloud`, matches.ts:69) **e** via RPC `submit_match_result` — duplicação | Misto |
| daily_records UPSERT | Direto (`saveDailyToCloud`, matches.ts:166) | Cliente |
| friends/rooms/participants | Direto com RLS de participação | Cliente |
| Fila | INSERT/DELETE direto + RPC heartbeat | Cliente |

## 4. Autenticação (auth.tsx — o VIVO)

- **Provider:** `AuthProvider` (Context) em `Providers.tsx:50`. `useAuth()` lança fora do provider.
- **Init:** lazy `initialGuest` do localStorage → se guest, user=Visitante sem rede; senão `getSession()` → `getUser()` (validação de rede; usuário deletado → signOut) → profile lookup (profile ausente → signOut).
- **Login:** `signInWithUsernameOrEmail` — se contém `@`, email direto; senão RPC `get_email_by_username` → `signInWithPassword`.
- **Signup:** `signUpWithEmail` — user_metadata `{username, display_name: username}`; trigger cria profile. Confirmação de email: se Supabase exigir (sem sessão no retorno), app mostra "verifique seu email" (AuthDialog:113-116).
- **Google:** `signInWithOAuth` com `redirectTo: origin`, `prompt: select_account`. Fluxo **implicit** (sem PKCE — risco M-03). Usuário Google sem username → `GoogleSignupCompletion` bloqueia o app até escolher username (`AppShell.tsx:265-267`).
- **Reset:** `resetPasswordForEmail` → email → link `origin/#reset` (tela de nova senha não implementada além do formulário de pedido).
- **Visitante:** flag `sudoku-arena-guest` no localStorage; `GuestLoginRequired` bloqueia Duo/Ranked/Leaderboard/Friends.
- **Logout:** `signOut({scope:"local"})` + limpeza manual de `sb-*` do localStorage (auth.tsx:299-311).

## 5. Fluxo de jogo — máquina de estados

### 5.1 Solo/Diário/Prática (`use-sudoku-game.ts`, 798 ln)

`useReducer` com 20 actions. Estado: puzzle/solution/board/notes/given, seed, elapsedSec, mistakes, hintsUsed, undo/redo stacks, highlightDigit, status(playing/paused/won).

- **Geração:** `generatePuzzle(difficulty, seed)` (engine.ts:237-296): `mulberry32` PRNG seeded → tabuleiro resolvido (backtracking) → escavação **simétrica** (idx e 80−idx) mantendo **solução única** (`countSolutions(limit 2)`, MRV solver). Alvos de givens: easy 36-45 / medium 30-35 / hard 26-30 / expert 22-26.
- **Diário:** seed = `daily-${date}-${difficulty}-v1` (UTC) — determinístico, sem servidor.
- **Autosave:** debounce 400ms em toda mudança; resume no mount; undo stacks sobrevivem reload.
- **Erros:** conta apenas placement NOVO errado; `maxErrors` (default 5, 0=∞) — **só mostra banner, não encerra**.
- **Dicas:** revelam `solution[cel]` (target errado/selecionado, senão random candidate — não determinístico); `maxHints` default 3.
- **Vitória:** `isComplete(board)` → WinScreen + `recordGame` (XP local) + `recordDaily` (se diário) + `checkAchievements` + save na nuvem fire-and-forget.
- **XP:** `computeXp` = 60 × multDif × multModo × fatorTempo − 8·erros − 10·dicas, floor 15. MultModo: solo 1, daily 1.2, guide 0.3, duo 1.8, ranked 2.2.

### 5.2 Ranked (RankedView 972 ln + ranked.ts 266 ln)

Fluxo: lobby → fila (INSERT + heartbeat 10s + poll 2s: `tryMatchmake` / `checkForMatch`) → match → result.

- **Board:** `generatePuzzle(difficulty, board_seed)` — ambos jogadores derivam o MESMO tabuleiro do seed compartilhado (criado no servidor).
- **Vitória:** primeiro `isComplete(newBoard)` → `handleFinish(false, newBoard)` (passa o board explícito para evitar stale state).
- **Derrota:** 3 erros → `handleFinish(true)` (tratado como abandono, −50 extra) — atalho documentado.
- **Finalização server-side:** RPC `finish_ranked_match` (idempotente, FOR UPDATE, Elo K=32, XP, matches INSERT para ambos, profiles UPDATE para ambos).
- **Realtime:** subscription em UPDATE de `ranked_matches` — quando o oponente termina, o perdedor registra a partida localmente e vê a tela de resultado (RankedView:310-347).
- **Abandono:** botão Desistir + modal; navegação interceptada (`ranked-abandon-attempt` event → AppShell modal → `ranked-forfeit-confirm` → handleFinish(true)).
- **Resultado:** 3-5s animado (rating antes→ganhos→final, tempo, erros, liga); promoção de divisão → `DivisionPromotionAnimation` full-screen 4 estágios (respeita `prefers-reduced-motion`).
- **Teclado (match):** 1-9, 0/Backspace, N, setas (subconjunto — sem undo/dica).

### 5.3 Duo — SHELL APENAS

`createRoom`/`joinRoom` (código 6-char) + realtime presence funcionam, mas: botão "Iniciar partida" **sem onClick** (DuoView:226-230), sem tabuleiro compartilhado, sem chat wired, leave não deleta participant do banco, join é read-then-insert (race de assentos).

## 6. Ranking e rating

- **Elo:** `finish_ranked_match` — E_a = 1/(1+10^((R_b−R_a)/400)); Δ = round(32·(S_a−E_a)); abandão: −50 extra se perdedor; floor 0; ambos profiles atualizados atomicamente; idempotente por match (FOR UPDATE + status check).
- **Divisões** (progression.ts:128-136): bronze 0, silver 800, gold 1600, platinum 2400, diamond 3200, master 4000, grandmaster 5000. `localDivision(rating)` espelha no cliente.
- **Leaderboard:** `fetchGlobalLeaderboard` — SELECT top 50 por rating DESC de profiles (RLS: using(true)). Auto-refresh no focus da aba + interval 30s (LeaderboardView:96-102) + refresh do próprio rating no mount (idempotente contra stale localStorage).
- **XP/level:** server: `finish_ranked_match` recalcula level com laço `while rem >= 100+50·level`. Cliente: `levelFromXp` idêntico.

## 7. Realtime (Supabase channels)

| Canal | Tabela | Uso |
|-------|--------|-----|
| `ranked:{matchId}` | ranked_matches UPDATE | oponente terminou → resultado para o perdedor |
| `room:{roomId}` | room_participants, rooms | presença duo |
| `chat:{threadId}` | chat_messages | chat (dormante — sendChatMessage sem caller) |

## 8. Deploy e configuração

- **Vercel:** `vercel.json` { framework nextjs, buildCommand "next build", installCommand "bun install", github.enabled true, git.deploymentEnabled true } → auto-deploy por push.
- **Env vars (.env, NÃO commitado):** `NEXT_PUBLIC_SUPABASE_URL` (pública), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pública), `DATABASE_URL` (Prisma, não usada), `SUPABASE_ACCESS_TOKEN` (admin Management API — usada pelo runner), `SUPABASE_PROJECT_REF`. **Vercel dashboard:** as duas NEXT_PUBLIC_ devem estar configuradas (confirmado — o app conecta em produção).
- **Migrations:** `bun run supabase:migrate` → `.zscripts/run-migrations.sh` roda 10 SQLs na ordem via Management API e verifica 7 RPCs. ⚠️ `supabase-security.sql` **não está na lista** (D-08).
- **Build:** `output: standalone` + cópia de static/public; `typescript.ignoreBuildErrors: true` (erros TS não quebram build); `reactStrictMode: false`.

## 9. Estado (Zustand app-store.ts)

Slices persistidos (localStorage `sudoku-arena:*`): settings, profile (displayName/avatar/cosmetics/totalXp/rating local), stats (5 modos × 4 difs), history (cap 200), daily-records, onboarding, streak, achievements. Não-persistidos: route, activeRankedMatchId, levelUps/achievementToasts (transientes), practiceBoard, hydrated, level (derivado).

`hydrate()` roda 1× no mount (Providers.tsx:44-46) — merge de settings sobre defaults, recomputa level.

**Sincronização local↔servidor:** profile.totalXp/rating locais são "preview"; ranked é server-authoritative (RPC escreve e devolve; cliente sobrescreve o local com o valor do servidor). Solo/daily: cliente escreve local E na nuvem (fire-and-forget) — fonte de verdade duplicada (risco M-08).

## 10. Validação de dados — onde acontece

| Dado | Frontend | Servidor |
|------|----------|----------|
| Senha forte | ✅ 8+/A/a/n/especial (AuthDialog:758) | ❌ (Supabase Auth default) |
| Username formato | ✅ regex input | ✅ RPC set_username/check |
| Username duplicado | ✅ check disponibilidade + ✅ índice unique lower() no DB |
| Solução ranked | ✅ isComplete client | ⚠️ valida grade, NÃO valida contra o puzzle (C-02) |
| Bounds submit-match | ✅ | Parcial (tempo ≤3600, erros ≤100; XP sem teto C-04) |
| Rate limit | ❌ | ❌ |

## 11. Testes

- **Automatizados: 0.** Sem unit/integration/E2E de aplicação.
- `bun run lint` (ESLint 9 flat, ~30 rules off) e `npx next build` são os únicos gates.
- `tests/` contém 3 scripts de infra do sandbox (não testam o app).
- QA histórico feito manualmente via `agent-browser` (documentado no worklog.md).

---
*Documento B — fim. Evidências completas nos relatórios de auditoria originais.*
