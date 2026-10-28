# Sudoku Arena — Documento C: Inventário de Funcionalidades

> Status: ✅ = implementado e verificado no código · 🟡 = parcialmente implementado · 📋 = planejado/mencionado (contratos) · ❌ = não encontrado · ❔ = não foi possível verificar.
> Evidência = arquivo:linha.

## Autenticação e contas

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Cadastro email+senha | ✅ | AuthDialog.tsx:361-429; auth.tsx:228-238 | Senha forte 8+/A/a/n/especial só frontend |
| Login por username OU email | ✅ | auth.tsx:189-221 via RPC get_email_by_username | RPC vaza email a anon (C-01) |
| Login Google OAuth | ✅ | auth.tsx:240-249 | Fluxo implicit, sem PKCE (M-03) |
| Conclusão de cadastro Google (username obrigatório) | ✅ | GoogleSignupCompletion.tsx:1-174; AppShell.tsx:265-267 | Bloqueia app até escolher username |
| Verificação de username disponível (live) | ✅ | AuthDialog.tsx:33-59; RPC check_username_available | Case-insensitive |
| Username único case-insensitive | ✅ | Índice unique lower(username) em fix-leaderboard-friends.sql:34-36 | |
| Recuperação de senha (pedido de email) | ✅ | AuthDialog.tsx:176-191; auth.tsx:253-258 | Tela de DEFINIR nova senha pós-link não implementada (fluxo para no envio) |
| Sessão persiste (reload) | ✅ | auth.tsx:102-180 (getSession+getUser+profile) | |
| Auto-logout de usuário deletado | ✅ | auth.tsx:148-180 (getUser falha ou profile ausente → signOut) | |
| Modo visitante | ✅ | auth.tsx:263-287; GuestLoginRequired.tsx | Bloqueado de Duo/Ranked/Leaderboard/Friends |
| Logout | ✅ | auth.tsx:291-311 | scope "local" (não desloga outros dispositivos — por design) |
| Exclusão de conta (self-service) | ✅ | policy DELETE profiles; supabase-audit-fixes.sql:43-44 | Via API; sem UI dedicada |
| Confirmação de email | 🟡 | AuthDialog.tsx:112-116 trata "email not confirmed" | Depende da config do Supabase dashboard (❔ não verificável daqui) |

## Modos de jogo

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Solo — 4 dificuldades | ✅ | SoloView.tsx:92-108; engine.ts:230-235 | Givens 36-45/30-35/26-30/22-26 |
| Solo — solução única garantida | ✅ | engine.ts:57-96 (countSolutions MRV), :260 | |
| Solo — anotações (lápis) | ✅ | use-sudoku-game.ts:168-182, SET_VALUE limpa peers | |
| Solo — desfazer/refazer | ✅ | use-sudoku-game.ts:400-442 | Stacks persistem no autosave |
| Solo — dicas | ✅ | use-sudoku-game.ts:345-398 | Target usa Math.random() (não determinístico) |
| Solo — pausar (board oculto) | ✅ | SudokuGamePlay.tsx:228-238 | Timer para |
| Solo — autosave/resume | ✅ | use-sudoku-game.ts:471-500 (debounce 400ms) | |
| Solo — teclado completo | ✅ | SudokuGamePlay.tsx:52-91 | 1-9, 0/Bksp/Del, N, H, P/Esc, A, C, ?, Ctrl+Z, setas |
| Solo — limite de erros encerra jogo | ❌ | SudokuGamePlay.tsx:165-169 | Apenas banner visual (D-11) |
| Solo — compartilhar tabuleiro (código/URL) | ✅ | share.ts:1-78; ShareDialogs.tsx | Formato SA1x + 81 dígitos |
| Solo — exportar imagem PNG | ✅ | board-image.ts; ExportImageDialog.tsx:1-111 | |
| Solo — estimador de dificuldade | ✅ | difficulty-estimator.ts:1-176 | Simula solving lógico |
| Solo — solver didático | ✅ | solver-hint.ts (naked/hidden single, pairs) | |
| Guia — 13 técnicas / 3 níveis | ✅ | guide/content.ts:43-271 | |
| Guia — mini-tabuleiros ilustrados | ✅ | GuideMiniBoard.tsx:26-67 | 5 tipos de célula |
| Guia — prática jogável com XP | ✅ | GuideView.tsx:169-173; content.ts:288-307 | 0.3× XP; salva como "solo" (D-13) |
| Diário — tabuleiro por data determinístico | ✅ | use-sudoku-game.ts:644 seed `daily-{date}-{dif}-v1` | UTC (D-16); sem servidor (M: /api/daily stub) |
| Diário — streak com freezes | ✅ | app-store.ts:554-602 | Freeze consumido em gap; ganho nos níveis 3/7/14 |
| Diário — replay de dias passados | ✅ | DailyView.tsx:179-188; StreakCalendar | Corrompe streak (D-06) |
| Diário — leaderboard global do dia | ❌ | — | Não existe |
| Archive — puzzles semanais | ✅ | ArchiveView.tsx:1-159 | Seeds ISO-week |
| Ranked — fila com heartbeat | ✅ | RankedView.tsx:207-220; ranked.ts:53-78 | 10s ping; expira >30s |
| Ranked — matchmaking atômico | ✅ | RPC try_matchmake_atomic (FOR UPDATE SKIP LOCKED) | Race do chamador (D-07) |
| Ranked — mesmo tabuleiro (seed) | ✅ | RankedView.tsx:293-297 | Solução no cliente (D-02) |
| Ranked — primeiro que resolve vence | ✅ | RankedView.tsx:471-480; RPC finish_ranked_match | |
| Ranked — 3 erros = derrota | ✅ | RankedView.tsx:486-489 | Tratada como abandono com −50 (D-08) |
| Ranked — Elo server-side K=32 | ✅ | supabase-ranked-xp-matches.sql:330-347 | |
| Ranked — penalidade abandono −50 | ✅ | idem:420-429 | |
| Ranked — idempotência (sem double-XP) | ✅ | idem:62-85 (FOR UPDATE + status check) | |
| Ranked — XP + matches p/ AMBOS jogadores | ✅ | idem:210-240 | |
| Ranked — progress sync por jogada | ✅ | RankedView.tsx:514-521; RPC update_ranked_progress | |
| Ranked — realtime (oponente terminou) | ✅ | ranked.ts:202-225; RankedView.tsx:310-347 | Perdedor registra no histórico |
| Ranked — desistência com modal | ✅ | RankedView.tsx:720-727, 813-842 | |
| Ranked — interceptação de navegação | ✅ | AppShell.tsx:134-141, 229-250, 347-373 | |
| Ranked — teclado (1-9, 0, N, setas) | ✅ | RankedView.tsx:165-205 | Sem undo/dica |
| Ranked — timer sem limite (conta ↑) | ✅ | RankedView.tsx:146-158 | Regra: sem 10min |
| Ranked — dificuldade selecionável | ❌ | RankedView.tsx:241,250 | Hardcoded "medium" |
| Ranked — dica/undo no NumberPad | ❌ | RankedView.tsx:707-714 | Stubs `() => {}` |
| Duo — criar/entrar sala por código | ✅ | matches.ts:485-558; DuoView.tsx:81-98 | |
| Duo — presença realtime | ✅ | subscribeToRoom matches.ts:560-588 | username sempre null (D-04) |
| Duo — partida jogável | ❌ | DuoView.tsx:226-230 | Botão "Iniciar" SEM onClick |
| Duo — tabuleiro compartilhado | ❌ | — | |
| Duo — chat | ❌ | sendChatMessage existe (matches.ts:434-479) mas sem caller | |
| Duo — sair remove participante | ❌ | DuoView.tsx:105-110 só limpa local | |
| Duo — salas públicas (browser) | ❌ | is_private só é flag | |

## Social / comunidade

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| Amigos — busca por username | ✅ | FriendsView.tsx:173-199; RPC search_user_by_username | |
| Amigos — enviar/aceitar/recusar | ✅ | matches.ts:195-417 | |
| Amigos — bloquear | 🟡 | matches.ts:419 blockUser | status blocked nunca verificado server-side |
| Leaderboard — top 50 global | ✅ | matches.ts:43-64; LeaderboardView | |
| Leaderboard — auto-refresh | ✅ | LeaderboardView:96-102 (focus + 30s) | |
| Leaderboard — divisões com emblemas | ✅ | DIVISIONS progression.ts:128-136 | |
| Chat | ❌ | infra existe (chat_messages, RLS author-only) | RLS impede destinatário LER (D-L7) |

## Progressão e perfil

| Funcionalidade | Status | Evidência | Observações |
|---|---|---|---|
| XP + níveis | ✅ | progression.ts:8-25; recordGame app-store.ts:468-552 | 100+50·n |
| Cosméticos (6 molduras, 6 títulos, 5 efeitos) | ✅ | COSMETICS progression.ts:94-114; ProfileView | Por nível 1-18 |
| 15 conquistas com XP | ✅ | achievements.ts:1-221; AchievementToast | |
| Histórico (cap 200) | ✅ | HistoryView.tsx; recordGame:513 | Ranked derrota = "Derrota" (não "Abandonada") |
| Recordes por dificuldade | ✅ | RecordsView.tsx | |
| Gráficos de estatísticas | ✅ | OverviewView + ProfileCharts (recharts) | |
| Export/import/reset de dados | ✅ | local-storage.ts:66-91; SettingsView | |
| Avatar identicon determinístico | ✅ | Avatar.tsx:1-105 | SVG próprio, sanitiza seed |
| Sons (12 efeitos WebAudio) | ✅ | sounds.ts:1-125 | Zero assets |
| Temas de tabuleiro (5) | ✅ | board-themes.ts | |
| Tema claro/escuro | ✅ | next-themes; Providers.tsx:49 | |
| i18n pt-BR/en | ✅ | translations.ts (390/389 chaves); context.tsx | Fallback en→key |
| Tour guiado | ✅ | GuidedTour.tsx (7 passos) | |
| Onboarding de idioma | ✅ | OnboardingDialog.tsx | |
| Animação promoção de divisão | ✅ | DivisionPromotionAnimation.tsx | 4 estágios, prefers-reduced-motion |
| Animação vitória/derrota ranked 3-5s | ✅ | RankedView ResultScreen:845-971 | |
| Conquistas/level-up toasts | ✅ | LevelUpToast.tsx; AchievementToast.tsx | |
| Streak calendar (13 semanas) | ✅ | StreakCalendar.tsx:1-159 | GitHub-style |
| Divisões: Bronze→Grandmaster | ✅ | progression.ts:128-136 | 0/800/1600/2400/3200/4000/5000 |
| Temporadas (seasons) | 🟡 | Tabela existe (schema.sql:94-101) | Nenhuma UI/logica usa |
| Títulos/molduras/efeitos equipáveis | ✅ | ProfileView cosmetics picker | Persistidos no profile |

## Infra/UX

| Funcionalidade | Status | Evidência |
|---|---|---|
| Responsivo mobile/desktop | ✅ | AppShell Sheet; SudokuBoard max-w 30rem |
| Rodapé sticky | ✅ | AppShell.tsx:343-347 |
| Alt+setas navegação | ✅ | AppShell.tsx:200-217 |
| Acessibilidade (aria grid, focus-visible, focus-trap) | ✅ | SudokuBoard role=grid; use-focus-trap no WinScreen |
| prefers-reduced-motion | ✅ | DivisionPromotionAnimation:35-74 |
| Deploy Vercel auto-GitHub | ✅ | vercel.json |
| Migrations automatizadas via API | ✅ | .zscripts/run-migrations.sh | 
| Testes automatizados | ❌ | Nenhum |
| Rate limiting | ❌ | Nenhum |
| Monitoramento/telemetria | ❌ | Nenhum |
| analytics | ❌ | Nenhum |

## Contratos futuros (só planejado — 📋)

`src/lib/contracts/persistence.ts` define interfaces NÃO implementadas: AuthService completo, MatchService com MoveAck/MatchState, RoomService com eventos, RankingService com seasons, XpService, FriendsService, ChatService, ReportService, DailyChallengeService. `GET /api/contracts` documenta 9 requisitos de segurança futuros (solução oculta, scoring server-side etc.) — hoje parcialmente cumpridos apenas no ranked.
