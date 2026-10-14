# Sudoku Arena — Architecture

A competitive Sudoku platform. **Current phase: LOCAL** — everything runs in the
browser with `localStorage`. No backend, no fake auth, no simulated multiplayer.
Online features are explicitly marked as pending backend.

## Stack
- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Zustand (app/game state), next-themes (light/dark), sonner (toasts)
- Custom Sudoku engine (generation/solving/validation) — pure TS, no deps

## Project layout
```
src/
  app/
    layout.tsx          Root layout: ThemeProvider + Sonner + Providers
    page.tsx            Single user route; view router driven by useAppStore.route
    globals.css         Sudoku Arena identity (emerald/teal + amber) + animations
    api/
      route.ts          Root API: app/phase/version
      contracts/route.ts  Future backend contract index + security requirements
      match/route.ts    501 — create competitive match (future)
      rooms/route.ts    501 — create/join Duo room (future)
      daily/route.ts    Returns locally-derived daily seed + future contract note
  lib/
    i18n/               translations (pt-BR, en) + useI18n/useT (store-backed)
    sudoku/
      types.ts          Board/Notes/peers/box tables
      engine.ts         generateSolvedBoard, generatePuzzle (unique solution),
                        solve, countSolutions, hasUniqueSolution, findConflicts
      saved-game.ts     Mode-scoped (solo/daily) persistence of in-progress games
    persistence/
      local-storage.ts  ISOLATED persistence layer (only localStorage touch point)
    progression/
      progression.ts    XP curve, level derivation, mode/difficulty multipliers,
                        computeXp, daily score, cosmetics catalog, divisions
    guide/
      content.ts        13 illustrated techniques (beginner/intermediate/advanced)
    store/
      app-store.ts      Zustand: nav, settings, profile, stats, history, daily,
                        streak, level-ups, saved-game, recordGame/recordDaily
    contracts/
      persistence.ts    FUTURE backend TS interfaces (Auth/Profile/Match/Room/
                        Ranking/XP/Friends/Chat/Daily) — not wired to a fake server
  hooks/
    use-sudoku-game.ts  Full game reducer: NEW/LOAD/SET_VALUE/TOGGLE_NOTE/ERASE/
                        UNDO/REDO/HINT/PAUSE/RESUME/TICK/RESTART; autosave; resume;
                        win→recordGame; supports solo + daily modes
  components/
    layout/             AppShell (sidebar+mobile sheet+header+sticky footer),
                        OnboardingDialog, LevelUpToast, Providers, nav-config
    sudoku/             SudokuBoard, SudokuCell, NumberPad, WinScreen,
                        SudokuGamePlay (shared play UI for Solo + Daily)
    guide/              GuideMiniBoard (illustrated technique boards)
    common/             Avatar (deterministic identicon), ComingSoon (needs-backend
                        banner, rules list, disabled button)
    views/              Lobby, Solo, Daily, Guide, Duo, Ranked, Friends,
                        Leaderboard, History, Profile, Settings
```

## Separation of concerns (spec §11)
- **Interface** → `components/views/*`, `components/sudoku/*`, `components/layout/*`
- **Sudoku logic** → `lib/sudoku/engine.ts` (pure, testable, no React)
- **Game state** → `hooks/use-sudoku-game.ts` (reducer) + `lib/store/app-store.ts`
- **Persistence** → `lib/persistence/local-storage.ts` (isolated, swappable)
- **i18n** → `lib/i18n/*` (store-backed, pt-BR + en)
- **Progression** → `lib/progression/progression.ts` (XP/level/cosmetics/divisions)
- **Future online comm** → `lib/contracts/persistence.ts` (interfaces only) +
  `app/api/*` stubs documenting the contract

The persistence layer is the ONLY module that touches `localStorage`. To go
online, implement the interfaces in `lib/contracts/persistence.ts` against a
real backend and swap the persistence provider — the rest of the app stays
unchanged.

## What works locally (this phase)
- **Solo**: full Sudoku — generate (unique solution), play, notes, undo/redo,
  hints, pause, timer, errors, progress, completion, autosave/resume, win screen.
- **Daily**: deterministic date-seeded puzzle, records per difficulty, streak, XP.
- **Guide**: 13 illustrated technique articles with mini-boards + steps.
- **Profile**: avatar, level/XP, stats by mode, cosmetics (frames/titles/effects
  with level-locked unlocks).
- **History**: local match log.
- **Settings**: theme (light/dark/system), language (pt-BR/en), gameplay toggles,
  data export/import/clear.
- **Onboarding**: language picker on first access.

## What is prepared (UI ready, needs backend) — spec §9/§10
- **Duo**: rules, 2×2 team preview, room controls — all disabled with notices.
  No simulated opponents.
- **Ranked**: rules, rating/division card, divisions ladder, queue — disabled.
- **Friends/Leaderboard**: structure with empty states and explicit backend-need
  notices. No fake online friends/messages/reports.

## Future backend requirements (spec §12) — NOT yet implemented
1. Server-side move validation (client never trusted).
2. Hidden solution during competitive matches (server-authoritative board).
3. Server-side scoring & rating calculation.
4. Room access control (public/private, codes, invites).
5. Consistent move synchronization (WebSocket) + 60s reconnection pause.
6. Duplicate-result prevention (idempotent submissions).
7. Abuse rate limiting.
8. Shared persistence (global ranking, seasons, friends, chat).
9. Real authentication & authorization (no anonymous-as-real).

These are documented in `/api/contracts` and `lib/contracts/persistence.ts`.

## Known limitations (this phase)
- All data is local to one browser; clearing storage loses progress.
- Daily challenge determinism holds only within one app version on one device —
  it cannot guarantee cross-player consistency or prevent local manipulation.
- XP/level/rating are local-only and user-modifiable; not an official ranking.
- No real multiplayer, friends, chat, or reports.

## How to run
```bash
bun run dev      # http://localhost:3000 (dev server, port 3000)
bun run lint     # ESLint
bun run db:push  # Prisma (available but unused in local phase)
```
Open the app via the Preview Panel (do not visit localhost directly).

## Versioning
- App version: `1.0.0-local` (bumped on each release; daily seed includes `v1`).
- When the backend lands, bump the version so daily seeds rotate cleanly.
