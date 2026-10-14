# Sudoku Arena — Worklog

## Project Status (Etapa 1 complete)

Sudoku Arena is a single-route Next.js 16 App Router SPA (all "pages" are client-side views switched via a Zustand `route` state). Phase is **local-only**: no backend, no fake auth, no simulated multiplayer. Online-dependent features are clearly marked as "coming soon / needs backend".

### Tech stack in use
- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Zustand (app/game state) — already installed
- next-themes (light/dark) — already installed
- sonner (toasts)
- lucide-react icons
- Custom localStorage persistence layer (`src/lib/persistence/local-storage.ts`) isolated so it can be swapped for a remote implementation

### Architecture laid out
```
src/
  app/
    layout.tsx          # Root layout + ThemeProvider + Sonner toaster + Providers
    page.tsx            # Single route; view router driven by useAppStore.route
    globals.css         # Sudoku Arena identity (emerald/teal + amber, NO blue/indigo)
  lib/
    i18n/               # translations (pt-BR, en) + useI18n/useT hooks (store-backed)
    sudoku/             # engine.ts (generate/solve/validate/unique), types.ts, saved-game.ts
    persistence/        # local-storage.ts (isolated, swappable)
    progression/        # XP/levels/cosmetics/divisions
    store/              # app-store.ts (Zustand: nav, settings, profile, stats, history, daily, streak, levelups)
    contracts/          # persistence.ts (future backend interfaces: Auth/Profile/Match/Room/Ranking/XP/Friends/Chat/Daily)
  components/
    layout/             # AppShell, Sidebar, MobileNav (Sheet), OnboardingDialog, LevelUpToast, Providers, nav-config
    views/              # LobbyView, SettingsView (+ placeholders for other views)
    ui/                 # shadcn (existing)
```

## Etapa 1 — Completed

### What was built
- Custom visual identity in globals.css: emerald/teal primary + amber accents, semantic tokens for sudoku cell states, arena grid background texture, keyframe animations (pop/shake/confetti/shimmer/float-up/pulse-ring), custom scrollbar.
- i18n: pt-BR + en translations (~280 keys), `useI18n`/`useT` hooks driven by the persisted app store. Language onboarding dialog on first access (asks preferred language).
- Persistence layer: isolated `localPersistence` (get/set/remove/has/keys/clearAll/exportAll/importAll) namespaced `sudoku-arena:*`. Future `PersistenceProvider` interface documented in `contracts/persistence.ts`.
- Zustand app store: route navigation, settings (locale/theme/gameplay/audio), local profile, stats-by-mode-and-difficulty, match history, daily records, daily streak, level-up event queue, saved-game slot. All state hydrated from localStorage on mount and persisted on every mutation.
- Progression module: XP curve (`xpForLevel`), level derivation, mode+difficulty multipliers (duo/ranked weighted higher per spec §8), `computeXp`, daily score, cosmetics catalog (frames/titles/effects with unlock levels), divisions (bronze→grandmaster).
- Sudoku engine: `generateSolvedBoard` (seeded mulberry32 + diagonal-box fill + backtracking), `generatePuzzle` (symmetrical digging preserving unique solution, difficulty targets), `solve`, `countSolutions` (MRV backtracking), `hasUniqueSolution`, `isValid`, `findConflicts`, `isComplete`, peer/box index tables.
- AppShell: sticky header (logo, route title, local-mode badge, level/XP bar, language menu, theme toggle), expandable desktop sidebar with grouped nav (Play/Learn/Community/Account), mobile Sheet nav, sticky footer.
- LobbyView: hero with level card + quick actions, stat cards (streak/games/XP/rating), continue-game card, game-mode cards, daily featured + difficulty quick-start.
- SettingsView: theme picker (light/dark/system), language picker, gameplay toggles (auto-check/highlight-peers/highlight-same/show-timer), max-errors & max-hints sliders, audio toggle, data export/import/clear, about card.
- OnboardingDialog + LevelUpToast.

### Verification (agent-browser)
- App loads at `/`, onboarding dialog appears with language choice → "Continuar" enters lobby.
- Lobby renders: welcome hero, level/XP progress bar, stat cards, mode cards (Solo/Duo/Ranked with "coming soon" on online modes), daily featured, difficulty quick-start.
- Settings renders: theme/language pickers, toggles, sliders, data buttons, about.
- Dark theme toggles without errors.
- Mobile (iPhone 14): hamburger menu opens Sheet with full nav; desktop sidebar hidden.
- No console errors, no runtime errors. ESLint clean.

## Unresolved / Next
- Etapa 2 (Sudoku Solo mode UI) is the immediate next step — the engine exists but the interactive board is still a placeholder.
- Etapas 3–5 views are placeholders to be built.
- No real tests yet (manual testing only, per spec).

---
Task ID: 1
Agent: main
Task: Etapa 1 — foundation: environment inspection, structure, visual identity, i18n, navigation.

Work Log:
- Inspected existing Next.js 16 + TS + Tailwind 4 + shadcn scaffold; confirmed zustand, next-themes, sonner available.
- Authored custom theme tokens (emerald/teal + amber, no blue/indigo) + sudoku cell-state tokens + animations in globals.css.
- Built i18n (pt-BR/en, ~280 keys) as store-backed hooks; onboarding language dialog.
- Built isolated localStorage persistence layer + future backend contract interfaces.
- Built Zustand app store (nav, settings, profile, stats, history, daily, streak, levelups, saved-game).
- Built progression module (XP/level/cosmetics/divisions) + full Sudoku engine (generate/solve/validate/unique).
- Built AppShell (sidebar + mobile sheet + header + sticky footer), LobbyView, SettingsView.
- Wired single-route view router in page.tsx with placeholders for remaining views.
- Lint clean; verified end-to-end with agent-browser (desktop + mobile).

Stage Summary:
- Etapa 1 done & browser-verified. Foundation stable for Etapa 2.
- Key artifacts: `lib/sudoku/engine.ts`, `lib/store/app-store.ts`, `lib/persistence/local-storage.ts`, `lib/contracts/persistence.ts`, `components/layout/AppShell.tsx`, `components/views/LobbyView.tsx`, `components/views/SettingsView.tsx`.

---
Task ID: 2
Agent: main
Task: Etapa 2 — Sudoku engine + complete Solo mode.

Work Log:
- Built full Sudoku engine in lib/sudoku/engine.ts: seeded generator (mulberry32 + diagonal-box fill + backtracking), symmetrical cell-digging puzzle generator preserving unique solution with per-difficulty targets, MRV backtracking solver, countSolutions, hasUniqueSolution, isValid, findConflicts, isComplete, peer/box index tables.
- Built useSudokuGame hook (useReducer) with full game state: NEW/LOAD/SELECT/SET_VALUE/TOGGLE_NOTE/ERASE/UNDO/REDO/HINT/TOGGLE_NOTES_MODE/PAUSE/RESUME/TICK/RESTART/CLEAR. Mistakes counted cumulatively (snapshot in history entries for exact undo/redo). Hints reveal solution cell + lock it + clear peer notes. Auto peer-note elimination on placement. Completion via isComplete.
- Autosave: debounced 400ms persist to saved-game slot on every state change; resume on mount (skips completed games); clear saved game on win.
- Win effect: records game to app store (XP/stats/history), triggers level-up toast, shows WinScreen.
- Built SudokuBoard (9x9 grid, 3x3 thick dividers, cell states: given/selected/peer/same-value/conflict/hint, notes mini-grid, pop/pulse-ring animations, ARIA gridcell labels).
- Built NumberPad (1-9 with remaining counts, undo/redo/erase/notes-toggle/hint with count, disabled states).
- Built WinScreen (confetti animation, stats grid, XP earned, level-up banner, new-record badge, best time, play-again/back).
- Built SoloView: difficulty selector with gradient cards, stats bar (timer/errors/progress), keyboard support (1-9, Backspace, N, H, P, Ctrl+Z/Y, arrows, Escape), pause overlay, errors-exceeded banner, shortcuts hint.
- Wired SoloView into page router.

Stage Summary:
- Solo mode fully functional and browser-verified end-to-end:
  * Board generation (easy/medium/hard/expert) with unique solutions.
  * Cell selection (mouse/touch/keyboard), number placement, peer+same-value highlighting, conflict detection.
  * Notes mode, erase, undo/redo, hints (limited), pause/resume, restart, new game.
  * Timer, error counter with limit, progress bar, completion verification.
  * Autosave + resume after reload verified.
  * Win screen with time/errors/hints/XP/record/level-up verified by solving a puzzle (placed final cell → Vitória +120 XP + new record + best time 2:10).
- Lint clean, no runtime errors.

---
Task ID: 3
Agent: main
Task: Etapa 3 — local persistence, profile, XP/stats, history, cosmetics.

Work Log:
- Built deterministic geometric Avatar component (SVG identicon from seed).
- Built ProfileView: header card (avatar with equipped frame ring, editable display name, level/XP bar, division badge with color, rating), edit dialog (name + avatar regenerate), statistics by mode (Solo/Daily aggregates: played/wins/winRate/bestTime), per-difficulty Solo breakdown table, cosmetics sections (frames/titles/effects) with equip + level-locked states + equipped indicator.
- Built HistoryView: scrollable table (mode/difficulty/time/result/xp/date), win/abandoned badges, new-record badge, empty state.
- Wired Profile + History into the router.

Stage Summary:
- All persistence/progression machinery (from Etapa 1 store) now surfaced in real UIs.
- Browser-verified: Profile renders avatar/level/division(Bronze)/stats/cosmetics; locked cosmetics disabled at level 1 (Esmeralda disabled, Padrão enabled); edit dialog renames + regenerates avatar + persists; History shows empty state.
- Note: agent-browser does not persist localStorage across close/open sessions, so the Etapa 2 win data wasn't visible here, but the win→recordGame→persist path was verified during Etapa 2 (win screen showed +120 XP, new record, best time).

---
Task ID: 4
Agent: main
Task: Etapa 4 — Guide (illustrated techniques) + Daily challenge (date-seeded) + records.

Work Log:
- Refactored saved-game layer to support multiple modes (solo/daily) via separate localStorage keys; added `mode` + `dailyDate` fields to SavedGame.
- Extended useSudokuGame hook with a `mode` param + `startDaily(date, difficulty)` action. Daily uses deterministic seed `daily-${date}-${difficulty}-v1`. Win effect records with `state.mode` and calls `recordDaily` (score + streak) for daily.
- Built Guide content (lib/guide/content.ts): 13 techniques across 3 levels (Beginner: Rules, Scanning, Naked Singles, Hidden Singles, Candidate Elimination; Intermediate: Naked Pairs, Hidden Pairs, Pointing Pairs, Box-Line Reduction; Advanced: Naked Triples, X-Wing, Swordfish, XY-Wing). Each has bilingual intro, how-it-works, reasoning steps, and a 9×9 illustration with cell marks (given/solved/candidate/target/eliminate) + legend.
- Built GuideMiniBoard component (renders static 9×9 with highlighted marks + candidate notes grid + strikethrough eliminates).
- Built GuideView: level-grouped technique cards → article view (intro, how-it-works, illustrated mini-board with legend, numbered steps, practice-in-Solo button).
- Extracted shared SudokuGamePlay component (top bar, stats, board, numpad, pause/win overlays, keyboard) reused by Solo + Daily.
- Built DailyView: today/streak/next-challenge cards, limitation notice, difficulty starters (with completed badge + best time/score), records history table; starts daily game via SudokuGamePlay.

Stage Summary:
- Browser-verified: Guide lists all 13 techniques by level; article opens with mini-board + steps + practice button. Daily shows date/streak/limitation/starters/records; starting a daily easy game produced a board; restarting the same date+difficulty produced IDENTICAL givens (determinism confirmed). No errors.
- Lint clean.

---
Task ID: 5
Agent: main
Task: Etapa 5 — prepare Duo/Ranked/social interfaces (no simulated multiplayer) + document future API contracts.

Work Log:
- Built shared NeedsBackendBanner / RulesList / DisabledButton components (common/ComingSoon.tsx).
- Built DuoView: needs-backend banner, 2×2 team preview (you + empty partner slots, no fake opponents), all 8 Duo rules, room controls (public/private toggle, create/join) all disabled with WifiOff markers.
- Built RankedView: needs-backend banner, your-rating/division card with progress to next division, disabled queue, all 7 Ranked rules, full divisions ladder (Bronze→Grão-Mestre with rating thresholds + current marker), seasons card.
- Built FriendsView: needs-backend banner, disabled add-friend input, friends-list/requests/invites section structure (empty states, no fake online friends), moderation tools (block/report) disabled.
- Built LeaderboardView: needs-backend banner, your-rank card (local stats only), empty global leaderboard with explanation, divisions ladder grid, local stats summary.
- Created API route stubs documenting future backend contracts: /api/contracts (full contract index + security requirements), /api/match (501), /api/rooms (501), /api/daily (returns locally-derived seed + future contract note), updated /api root.

Stage Summary:
- Browser-verified: all four views render with "Modo local" badge + explicit backend-need notices; Ranked shows full divisions ladder (Bronze→Grão-Mestre), rules, rating, queue; API stubs respond (/api/contracts, /api/daily with seed). No simulated opponents/friends/messages anywhere.
- Lint clean.
- Per spec §9 & §11: no fake multiplayer via localStorage/BroadcastChannel/fictional data — all online features explicitly marked as pending backend.

---
Task ID: 6
Agent: main
Task: Etapa 6 — manual testing, i18n fixes, architecture docs, schedule cron.

Work Log:
- Full manual test pass via agent-browser across all 11 views (desktop + mobile iPhone 14): no runtime/console errors.
- Found & fixed i18n bug: SudokuBoard cell aria-labels were hardcoded Portuguese ("Célula"). Added board.cell/board.empty/board.value translation keys (pt-BR + en) and wired useT() into SudokuBoard. Verified English cells render as "Cell 1, 1, empty".
- Internationalized the hardcoded "Atalhos:" shortcuts hint → solo.shortcuts key.
- Re-verified redo: place 7 → undo (empty) → redo (value 7) works.
- Re-verified dark theme toggle (`.dark` class applies, board renders).
- Re-verified English UI end-to-end (onboarding "Continue", lobby "Welcome back"/"Quick Play", Solo "Start").
- Created ARCHITECTURE.md documenting: stack, project layout, separation of concerns, what works locally, what is prepared (needs backend), future backend security requirements (9 items), known limitations, how to run.
- Scheduled 15-minute recurring cron webDevReview job (id 457699) to continue QA + feature work autonomously.

Stage Summary:
- All 6 etapas complete. Final verification: all 11 views navigate cleanly, no errors; Solo full flow (generate/play/notes/undo/redo/hint/pause/autosave/resume/win/XP) verified; Daily determinism verified; Guide articles verified; Profile/History/Settings verified; Duo/Ranked/Friends/Leaderboard render with needs-backend notices; API contract stubs respond; light/dark + pt-BR/en verified; desktop + mobile responsive.
- Lint clean throughout.

## Final Summary (spec §15)

### 1. Funcionalidades concluídas
- Solo completo (gerador com solução única, anotações, desfazer/refazer, dicas, pausar, cronômetro, erros, progresso, conclusão, autosave/retomada, tela de vitória com XP).
- Desafio diário (tabuleiro determinístico por data, recordes por dificuldade, sequência, pontuação, XP).
- Guia com 13 técnicas ilustradas (iniciante/intermediário/avançado) com mini-tabuleiros e passos.
- Perfil (avatar, nível/XP, estatísticas por modo, cosméticos com desbloqueio por nível).
- Histórico de partidas locais.
- Configurações (tema claro/escuro/sistema, idioma pt-BR/en, opções de jogo, áudio, exportar/importar/limpar dados).
- Identidade visual própria (esmeralda/teal + âmbar), responsiva, acessível, com temas e i18n.
- Páginas Duo/Ranked/Amigos/Classificação preparadas com regras e avisos claros de "precisa de backend" — sem multiplayer simulado.
- Contratos de API documentados (/api/contracts, /api/match, /api/rooms, /api/daily) + interfaces TS em lib/contracts/persistence.ts.

### 2. Testes executados
- Geração de tabuleiros e solução única (motor + verificação visual).
- Validação de regras, conflitos, conclusão.
- Anotações, desfazer e refazer.
- Dicas (limite + revelação).
- Salvamento e retomada após recarregar.
- Cronômetro e conclusão (tela de vitória + XP + recorde).
- Desafio diário (determinismo confirmado: mesmos dados ao reiniciar).
- Pontuação e XP local (nível subiu, cosmético desbloqueado).
- Temas claro e escuro.
- Português e inglês (incluindo labels do tabuleiro corrigidos).
- Layout desktop e celular (iPhone 14).
- Navegação em todas as 11 views + estados vazios.
- Tratamento de erros (sem erros de runtime/console).

### 3. Problemas conhecidos
- Dados 100% locais: limpar storage perde tudo.
- Desafio diário determinístico só dentro de uma versão do app em um dispositivo — não garante consistência entre jogadores nem impede manipulação local.
- XP/nível/rating são locais e editáveis pelo usuário (não é ranking oficial).
- Sem multiplayer/amigos/chat/denúncias reais.

### 4. Como executar
- `bun run dev` (porta 3000). Abrir via Preview Panel (não visitar localhost diretamente).

### 5. Pendente até a integração com backend
- Autenticação real.
- Multiplayer Duo (WebSocket + salas) e Ranqueada (matchmaking + validação no servidor).
- Ranking global, temporadas compartilhadas, rating oficial.
- Amigos, convites, chat, denúncias, bloqueio multiusuário.
- Desafio diário oficial (seed do servidor, consistência global).
- Validação de movimentos, solução secreta, pontuação/rating no servidor, controle de salas, sincronização, prevenção de duplicatas, rate limiting, persistência compartilhada.

---
Task ID: 7 (cron webDevReview round 1)
Agent: main
Task: QA pass + new features (sound, achievements, charts, solo tools) + styling polish.

## Current project status / assessment
- Project was complete through Etapa 6 (Solo/Daily/Guide/Profile/History/Settings + Duo/Ranked/Friends/Leaderboard needs-backend UIs + i18n pt-BR/en + light/dark). Dev server healthy on :3000, lint clean.
- QA pass via agent-browser: confirmed conflict highlighting, notes (9-span grid), mistake counting (1/5 after wrong placement), autosave/resume, dark theme, English i18n. No bugs found in core flows.

## Goals / completed modifications / verification results
This round added 4 new feature areas + styling polish (mandatory: more features + more styling detail):

1. **Sound effects** (lib/audio/sounds.ts — Web Audio API, no asset files): tones for select/place/placeWrong/erase/note/undo/redo/hint/win/levelUp/tick/error. Wired into useSudokuGame callbacks + win effect + LevelUpToast. `setSoundEnabled` synced from `settings.soundEnabled` (the previously-no-op audio setting now actually produces sound). Verified: win sound + level-up sound play.

2. **Achievements system** (lib/progression/achievements.ts): 15 achievements across 4 categories (solo/skill/daily/level) — first_win, wins_10/50, flawless, no_hints, speed_easy/medium, expert_win, all_difficulties, daily_streak_3/7/30, level_5/10/20. Each has bilingual name/desc, icon, xpReward, pure `check(ctx)`. Store: `unlockedAchievements` (persisted), `achievementToasts` queue, `checkAchievements(lastGame)` action (awards bonus XP + re-derives level + pushes toasts). Hook calls it after recordGame+recordDaily. New `AchievementsView` (nav item "Conquistas/Achievements") with progress overview + category-grouped cards + lock/unlock states. New `AchievementToast` (bottom-fixed, auto-dismiss 8s) added to Providers. WinScreen extended to show unlocked achievements + bonus XP. Verified end-to-end: first easy win (60s, 0 errors, 0 hints) unlocked 4 achievements (Primeira Vitória +50, Impecável +150, Autossuficiente +100, Velocista +100 = +400 bonus XP); win screen listed all 4 + bonus XP; achievement toast appeared; Achievements view shows 4/15 progress after reload.

3. **Profile statistics charts** (components/profile/ProfileCharts.tsx, recharts): win-rate-by-difficulty bar chart (color-coded per difficulty) + cumulative-XP-over-time area chart with gradient fill. Embedded in ProfileView. Empty states when no data. Verified: 2 charts render with 1 win recorded.

4. **Solo tools** — Auto-notes (AUTO_NOTES reducer: fills candidate notes for all empty cells from peer elimination) + Check (CHECK reducer: sets `showMistakes` flag; clears on any board mutation). New `wrongCells` derived set in hook; SudokuBoard extended with `wrongCells` prop + wrong-cell error styling. Toolbar with Wand2/SearchCheck buttons in SudokuGamePlay. Keyboard shortcuts A (auto-notes) + C (check). Verified: pressing A filled 46 cells with notes; pressing C highlighted wrong cells; both no errors.

5. **Styling polish**: SudokuBoard cells gained hover states (peer bg on hover, sticky hover for given/selected/conflict/hint), selected cell inset ring, `cursor-pointer`. Lobby hero enhanced with arena-grid pattern overlay, blurred color glows, larger display name, gradient level badge, pct label, shadow buttons. Lobby StatCards gained group hover (scale icon, glow, border highlight). Selected cell uses inset ring + pulse.

Verification: ESLint clean throughout; agent-browser confirmed all features work; no runtime/console errors.

## Unresolved issues / risks / next-phase recommendations
- Sound context requires a user gesture to unlock on some browsers — handled by lazy creation in user-gesture callbacks, but the very first "win"/"levelup" sound (effect-triggered, not gesture) could be silent if no prior gesture occurred. In practice the user always interacts before winning, so fine.
- Achievements are local-only and user-resettable (consistent with the local-phase stance; not an official system).
- Recommended next round: (a) per-cell "candidate toggle" highlight when hovering a number-pad digit (highlight all cells containing/able-to-contain that digit); (b) a "daily calendar" heat-map view of streak; (c) board theme variants (cosmetic beyond light/dark); (d) a practice mode from Guide that loads the technique's exact mini-board into Solo.
- The scheduled 15-min cron (id 457699) continues to drive autonomous QA + feature work.

---
Task ID: 8 (cron webDevReview round 2)
Agent: main
Task: QA pass + 4 new features (candidate hover, streak calendar, guide practice, board themes) + bug fix.

## Current project status / assessment
- Project complete through Task 7 (Solo/Daily/Guide/Profile/History/Settings/Achievements + Duo/Ranked/Friends/Leaderboard needs-backend UIs + sound + charts + solo tools + i18n + light/dark). Dev server healthy on :3000, lint clean, 99→108 source files.
- QA pass via agent-browser: confirmed full Solo win flow (win→XP→achievements), auto-notes (45 cells filled), check tool, achievements view (4/15 after a win), profile charts (2 recharts surfaces). Found 1 real UX bug.

## Goals / completed modifications / verification results

### Bug fix (priority)
- **Toast pointer-events covering WinScreen buttons**: LevelUpToast and AchievementToast were `fixed inset-x-0 z-[100]` (higher than WinScreen z-50) with full-width containers, intercepting clicks across the bottom/top strip and making "Play again"/"Back" buttons unclickable until toasts auto-dismissed (~8-10s). Fixed by adding `pointer-events-none` to the wrapper divs and `pointer-events-auto` to the inner Card — clicks now pass through empty toast areas to the win screen beneath. Verified: "Play again" is immediately clickable with toasts visible.

### New features (mandatory: more features + more styling)

1. **Per-cell candidate highlight on number-pad hover** (recommended last round): added `highlightDigit` to game state + `SET_HIGHLIGHT_DIGIT` action + `setHighlightDigit` callback. NumberPad buttons emit `onMouseEnter/Leave/Focus/Blur` → `onHoverDigit`. SudokuBoard's `sameSet` and a new `candidateSet` now respond to `highlightDigit`: cells containing the digit get the "same-value" bg, and empty cells with that digit as a candidate note get a peer-tinted bg with the specific candidate digit highlighted (primary bg + bold) inside their NotesGrid. Hovering a number pad digit now visually traces every place that digit could go. NumberPad buttons also gained hover lift + shadow for polish.

2. **Daily streak heat-map calendar** (recommended last round): new `StreakCalendar` component (GitHub-style contribution graph) showing 13 weeks × 7 days of completed daily challenges, with 5 intensity levels (muted → primary), month labels, weekday labels, today ring, hover scale + tooltip, and a legend. Embedded in DailyView above the records table. Verified: 96 calendar cells render.

3. **Guide → Solo practice mode** (recommended last round): added `techniqueToPractice()` utility that converts a technique's CellMark illustration into a playable puzzle+solution+notes (givens/solved/target → locked givens; candidate/eliminate → empty with seeded notes; solution derived via engine solver, returns null if unsolvable). Added `startPractice()` action + `SET_NOTES` reducer to the hook, a transient `practiceBoard` slot + `setPracticeBoard` in the store. GuideView's "Practice in Solo" button now sets the practice board and routes to Solo; SoloView consumes it on mount (one-shot ref guard) and shows a "Praticar" badge when in guide/practice mode. Solo difficulty selector also gained a "Guide practice" shortcut card. Verified: opening Regras article → "Praticar no Solo" loads the technique's board into Solo with the practice badge, 81 cells render.

4. **Board theme variants** (recommended last round): new `board-themes.ts` with 5 themes (Emerald/Ocean/Sunset/Rose/Monochrome) each defining CSS var overrides for cell-state colors. Added `boardTheme` to AppSettings (default emerald). SudokuBoard accepts a `themeVars` prop applied as inline style on the wrapper (scoped, doesn't affect global theme). SudokuGamePlay derives `boardThemeVars` from settings via `getBoardTheme()`. New board-theme picker in SettingsView (swatch + name, active highlight). Verified: picker renders all 5 themes with localized names.

### Verification
- ESLint clean throughout (fixed an import bug: `emptyBoard` is exported from `types.ts` not `engine.ts` — caught when the Guide practice feature broke the build, fixed immediately).
- agent-browser confirmed: practice mode loads technique board (81 cells + "Praticar" badge), StreakCalendar renders (96 cells), board theme picker shows all 5 themes, toast pointer-events fix lets win-screen buttons be clicked immediately.
- No runtime/console errors.

## Unresolved issues / risks / next-phase recommendations
- Some Guide technique illustrations are partial diagrams (not full solvable puzzles); `techniqueToPractice` returns null for those and falls back to a normal easy Solo game — acceptable, but a future round could craft dedicated solvable practice puzzles per technique.
- Board themes currently recolor cell states; a future round could add full theme variants (background, number font, animations).
- The daily streak calendar shows completed days but doesn't yet allow clicking a past day to replay it (daily is date-locked by design).
- Recommended next round: (a) keyboard shortcut help overlay/modal; (b) "undo all notes" / "clear notes" tool; (c) export/import now includes the new settings (boardTheme) — verify; (d) a stats dashboard combining solo + daily + achievements into one overview.
- The scheduled 15-min cron (id 457699) continues to drive autonomous QA + feature work.

---
Task ID: 9 (cron webDevReview round 3)
Agent: main
Task: QA pass + 3 new features (keyboard help, clear notes, overview dashboard) + styling polish.

## Current project status / assessment
- Project complete through Task 8 (all 12 views + sound + achievements + charts + solo tools + candidate hover + streak calendar + guide practice + board themes). Dev server healthy on :3000, lint clean, 108 source files.
- QA pass via agent-browser: all 12 views navigate cleanly (no errors/console errors); full Solo win flow works (win→XP→achievements→toast); Guide practice loads technique board with board theme applied; Settings board theme picker works (Ocean `--cell-bg-selected` applied to board); StreakCalendar renders (96 cells); mobile (iPhone 14) hamburger nav works. No bugs found — the toast pointer-events fix from round 2 is confirmed working (play-again immediately clickable with toasts visible).

## Goals / completed modifications / verification results

### New features (mandatory: more features + more styling)

1. **Keyboard shortcut help overlay** (recommended last round): new `ShortcutHelpDialog` component with a Keyboard icon header, description, and 11 shortcut rows (1-9, Backspace, N, H, A, C, P, Ctrl+Z, Ctrl+Shift+Z, arrows, ?) rendered as `<kbd>` chips with labels. Triggered by the "?" key (Shift+/) in SudokuGamePlay's keyboard handler OR a new ghost keyboard-icon button in the tools row. Dialog closes via Escape or backdrop. Added 13 translation keys (solo.shortcutHelp, solo.shortcutHelpDesc, shortcut.*). Verified: dialog opens via "?" key + toolbar button, shows all 11 rows, closes via Escape.

2. **Clear notes tool** (recommended last round): new `CLEAR_NOTES` reducer action in the hook (clears all notes to empty arrays, resets showMistakes) + `clearNotes` callback. New "Limpar anotações / Clear notes" button in the SudokuGamePlay tools row (NotebookPen icon, chart-4 color). Added solo.clearNotes translation key (pt-BR + en). Verified: auto-notes filled 46 cells → click Clear notes → 0 cells with notes.

3. **Stats dashboard / Overview view** (recommended last round): new "Visão Geral / Overview" route + nav item (PieChart icon, Account group). New `OverviewView` combining: (a) profile summary card (avatar, level, division, XP, achievements progress bar), (b) 8-card quick-stats grid (games played, wins, best streak, total time, avg time, best time, daily completed, achievements count) with gradient accents + hover scale, (c) wins-per-difficulty radar chart (recharts, empty state when 0 wins), (d) recent-games list (top 10 from history with win/loss icons + xp), (e) daily streak summary card, (f) achievements summary with 15-icon grid (locked/unlocked). Deep-links to Profile/Daily/Achievements via ChevronRight buttons. Added 10 overview.* translation keys. Verified: title/quickStats/streak/achievements all render; empty state shows "Jogue uma partida" when no data; mobile nav includes the new item.

### Styling polish (mandatory: more styling)
- Overview stat cards: gradient accents + group hover (icon scale, border highlight, shadow).
- Help dialog: centered header with primary-tinted icon, kbd chips with shadow, hover rows.
- Tools row: keyboard help button (ghost, ml-auto) + color-coded tool icons (Wand2 primary, NotebookPen chart-4, SearchCheck warning).
- Overview profile summary: radial division-color glow + arena-grid texture + ringed avatar.
- Recent games: win/loss circular icons, hover bg, monospace xp.

### Verification
- ESLint clean throughout (removed unused Eraser import).
- agent-browser confirmed: Overview view renders all sections; help dialog opens via "?" + button (11 rows), closes via Escape; Clear notes clears 46→0; mobile nav includes Overview; no runtime/console errors.

## Unresolved issues / risks / next-phase recommendations
- The Overview radar chart only shows when soloWins > 0; a future round could show a placeholder radar with all-zero axes.
- Clear notes is not undoable (it doesn't push a history entry) — by design, but could be reconsidered.
- Recommended next round: (a) keyboard navigation across the whole app (Tab focus traps in dialogs); (b) a "share board" feature (export board as image/URL); (c) per-difficulty best-times leaderboard view (local); (d) sound on/off toggle in the header; (e) a "reset progress" confirmation dialog with type-to-confirm.
- The scheduled 15-min cron (id 457699) continues to drive autonomous QA + feature work.
