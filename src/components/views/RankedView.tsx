"use client";

import { useEffect, useState, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore, localDivision } from "@/lib/store/app-store";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/common/Avatar";
import { Progress } from "@/components/ui/progress";
import { RulesList } from "@/components/common/ComingSoon";
import { DIVISIONS } from "@/lib/progression/progression";
import {
  joinRankedQueue,
  leaveRankedQueue,
  tryMatchmake,
  checkForMatch,
  fetchRankedMatch,
  fetchOpponentName,
  updateRankedProgress,
  reportRankedWin,
  subscribeToRankedMatch,
  type RankedMatch,
} from "@/lib/supabase/ranked";
import { generatePuzzle } from "@/lib/sudoku/engine";
import { SudokuBoard } from "@/components/sudoku/SudokuBoard";
import { NumberPad } from "@/components/sudoku/NumberPad";
import { formatTime } from "@/lib/sudoku/saved-game";
import { isComplete, findConflicts } from "@/lib/sudoku/engine";
import {
  Swords, Trophy, Clock, AlertTriangle, Loader2, Wifi, X, Crown, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Board, Notes, Difficulty } from "@/lib/sudoku/types";
import { emptyBoard, PEERS } from "@/lib/sudoku/types";

const RANKED_RULES = [
  "ranked.rules.1", "ranked.rules.2", "ranked.rules.3", "ranked.rules.4",
  "ranked.rules.5", "ranked.rules.6", "ranked.rules.7",
] as const;

type Phase = "lobby" | "queue" | "match" | "result";

export function RankedView() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const profile = useAppStore((s) => s.profile);
  const setRoute = useAppStore((s) => s.setRoute);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [queueTime, setQueueTime] = useState(0);
  const [match, setMatch] = useState<RankedMatch | null>(null);
  const [opponentName, setOpponentName] = useState("Opponent");
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [solution, setSolution] = useState<Board>(emptyBoard());
  const [puzzle, setPuzzle] = useState<Board>(emptyBoard());
  const [given, setGiven] = useState<boolean[]>(new Array(81).fill(false));
  const [notes, setNotes] = useState<Notes>(Array.from({ length: 81 }, () => []));
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [notesMode, setNotesMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [errors, setErrors] = useState(0);
  const [result, setResult] = useState<"win" | "loss" | null>(null);

  const isPlayer1 = match?.player1Id === user?.id;
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportedRef = useRef(false);

  const division = localDivision(profile.rating);
  const divInfo = DIVISIONS.find((d) => d.id === division)!;
  const filled = board.filter((v) => v !== 0).length - puzzle.filter((v) => v !== 0).length;
  const totalEmpty = puzzle.filter((v) => v === 0).length || 1;
  const progress = Math.round((filled / totalEmpty) * 100);
  const conflicts = findConflicts(board);
  const wrongCells = new Set<number>();

  // Queue timer
  useEffect(() => {
    if (phase !== "queue") {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      return;
    }
    queueTimerRef.current = setInterval(() => {
      setQueueTime((s) => s + 1);
    }, 1000);
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    };
  }, [phase]);

  // Match timer (10 min countdown)
  useEffect(() => {
    if (phase !== "match") return;
    matchTimerRef.current = setInterval(() => {
      setElapsed((s) => {
        if (s + 1 >= 600) {
          // Time's up — handle inline to avoid forward-ref issue
          if (match && user && !reportedRef.current) {
            reportedRef.current = true;
            const myCells = isPlayer1 ? match.player1CellsCorrect : match.player2CellsCorrect;
            const oppCells = isPlayer1 ? match.player2CellsCorrect : match.player1CellsCorrect;
            const winnerId = myCells >= oppCells ? user.id : (isPlayer1 ? match.player2Id : match.player1Id);
            reportRankedWin(match.id, winnerId);
            setResult(winnerId === user.id ? "win" : "loss");
            setPhase("result");
          }
          return 600;
        }
        return s + 1;
      });
    }, 1000);
    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [phase]);

  // Handle entering queue
  const handleJoinQueue = async () => {
    if (!user) return;
    setPhase("queue");
    await joinRankedQueue(user.id, "medium");
    // Start polling for match
    pollRef.current = setInterval(async () => {
      // First try to matchmake (create match ourselves)
      const { matchId } = await tryMatchmake(user.id, "medium");
      if (matchId) {
        await startMatch(matchId);
        return;
      }
      // Also check if someone else matched us
      const foundId = await checkForMatch(user.id);
      if (foundId) {
        await startMatch(foundId);
      }
    }, 2000);
  };

  // Handle leaving queue
  const handleLeaveQueue = async () => {
    if (!user) return;
    if (pollRef.current) clearInterval(pollRef.current);
    await leaveRankedQueue(user.id);
    setPhase("lobby");
  };

  // Start a match
  const startMatch = async (matchId: string) => {
    if (!user) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);

    const m = await fetchRankedMatch(matchId);
    if (!m) {
      toast.error(locale === "pt-BR" ? "Erro ao carregar partida." : "Failed to load match.");
      setPhase("lobby");
      return;
    }

    setMatch(m);
    const isP1 = m.player1Id === user.id;
    const opponentId = isP1 ? m.player2Id : m.player1Id;
    const name = await fetchOpponentName(opponentId);
    setOpponentName(name);

    // Generate the board from the seed
    const p = generatePuzzle(m.difficulty as Difficulty, m.boardSeed);
    setPuzzle(p.puzzle);
    setSolution(p.solution);
    setBoard(p.puzzle.slice());
    setGiven(p.puzzle.map((v) => v !== 0));
    setNotes(Array.from({ length: 81 }, () => []));
    setSelectedIndex(-1);
    setErrors(0);
    setElapsed(0);
    reportedRef.current = false;
    setPhase("match");

    // Subscribe to match updates
    const unsub = subscribeToRankedMatch(matchId, (updated) => {
      setMatch(updated);
      // Check if opponent won
      if (updated.status === "completed" && !reportedRef.current) {
        reportedRef.current = true;
        const won = updated.winnerId === user.id;
        setResult(won ? "win" : "loss");
        setPhase("result");
        toast(won ? "🏆 Vitória!" : "💀 Derrota", {
          description: won
            ? `+${25} rating`
            : `-${15} rating`,
        });
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      }
    });

    return () => unsub();
  };

  // Place a number
  const handleNumber = (value: number) => {
    if (phase !== "match" || selectedIndex < 0 || given[selectedIndex]) return;
    if (notesMode) {
      setNotes((prev) => {
        const next = prev.map((n) => n.slice());
        const current = next[selectedIndex];
        const has = current.includes(value);
        next[selectedIndex] = has
          ? current.filter((n) => n !== value)
          : [...current, value].sort();
        return next;
      });
    } else {
      const prevVal = board[selectedIndex];
      if (value === prevVal) {
        // Erase
        setBoard((prev) => {
          const next = prev.slice();
          next[selectedIndex] = 0;
          return next;
        });
      } else {
        setBoard((prev) => {
          const next = prev.slice();
          next[selectedIndex] = value;
          return next;
        });
        const newNotes = notes.map((n) => n.slice());
        newNotes[selectedIndex] = [];
        // Clear peer notes
        for (const p of PEERS[selectedIndex]) {
          if (newNotes[p].includes(value)) {
            newNotes[p] = newNotes[p].filter((n) => n !== value);
          }
        }
        setNotes(newNotes);

        // Check error
        const isWrong = value !== solution[selectedIndex];
        if (isWrong) {
          const newErrors = errors + 1;
          setErrors(newErrors);
          toast.error(locale === "pt-BR" ? `Erro! ${newErrors}/3` : `Error! ${newErrors}/3`);
          if (newErrors >= 3) {
            // Player loses
            if (match && user && !reportedRef.current) {
              reportedRef.current = true;
              const winnerId = isPlayer1 ? match.player2Id : match.player1Id;
              reportRankedWin(match.id, winnerId);
              setResult("loss");
              setPhase("result");
              if (matchTimerRef.current) clearInterval(matchTimerRef.current);
            }
          }
        }

        // Check win
        const wouldBoard = board.slice();
        const winBoard = wouldBoard.slice();
        winBoard[selectedIndex] = value;
        if (isComplete(winBoard)) {
          if (match && user && !reportedRef.current) {
            reportedRef.current = true;
            reportRankedWin(match.id, user.id);
            setResult("win");
            setPhase("result");
            if (matchTimerRef.current) clearInterval(matchTimerRef.current);
            toast.success("🏆 Vitória!");
          }
        }

        // Update progress to Supabase (every move)
        if (match && user) {
          const progressBoard = board.slice();
          progressBoard[selectedIndex] = value;
          const filledCount = progressBoard.filter((v) => v !== 0).length - puzzle.filter((v) => v !== 0).length;
          const totalEmptyCount = puzzle.filter((v) => v === 0).length || 1;
          const pct = Math.round((filledCount / totalEmptyCount) * 100);
          const correct = progressBoard.reduce((acc, v, i) => acc + (v !== 0 && v === solution[i] ? 1 : 0), 0);
          updateRankedProgress(match.id, user.id, isPlayer1, {
            progress: pct,
            errors: isWrong ? errors + 1 : errors,
            cellsCorrect: correct,
          });
        }
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      if (user && phase === "queue") leaveRankedQueue(user.id);
    };
  }, []);

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Swords className="h-6 w-6 text-primary" />
            {t("ranked.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ranked.subtitle")}</p>
        </div>
        <Card className="p-10 text-center">
          <Swords className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {locale === "pt-BR" ? "Entre para competir no modo Ranqueado." : "Sign in to compete in Ranked mode."}
          </p>
        </Card>
      </div>
    );
  }

  // Result phase
  if (phase === "result" && match) {
    const won = result === "win";
    const ratingChange = won ? 25 : -15;
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className={cn(
          "w-full max-w-md overflow-hidden p-8 text-center border-2",
          won ? "border-[var(--success)]/40" : "border-[var(--destructive)]/40"
        )}>
          <div className={cn(
            "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-sm",
            won ? "bg-[var(--success)]/15" : "bg-[var(--destructive)]/15"
          )}>
            {won ? <Trophy className="h-10 w-10 text-[var(--success)]" /> : <X className="h-10 w-10 text-[var(--destructive)]" />}
          </div>
          <h2 className={cn("text-3xl font-bold", won ? "text-[var(--success)]" : "text-[var(--destructive)]")}>
            {won ? (locale === "pt-BR" ? "Vitória!" : "Victory!") : (locale === "pt-BR" ? "Derrota" : "Defeat")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {locale === "pt-BR" ? "vs" : "vs"} {opponentName}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold">{formatTime(elapsed)}</p>
              <p className="text-xs text-muted-foreground">{t("solo.timer")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--destructive)]">{errors}</p>
              <p className="text-xs text-muted-foreground">{t("solo.errors")}</p>
            </div>
            <div>
              <p className={cn("text-2xl font-bold", won ? "text-[var(--success)]" : "text-[var(--destructive)]")}>
                {ratingChange > 0 ? "+" : ""}{ratingChange}
              </p>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>
          <Button className="mt-6 w-full" size="lg" onClick={() => { setPhase("lobby"); setMatch(null); setResult(null); }}>
            {locale === "pt-BR" ? "Voltar" : "Back"}
          </Button>
        </Card>
      </div>
    );
  }

  // Queue phase
  if (phase === "queue") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Swords className="h-6 w-6 text-primary" />
            {t("ranked.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("ranked.subtitle")}</p>
        </div>

        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-sm bg-primary/10">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h3 className="text-xl font-bold">
            {locale === "pt-BR" ? "Procurando oponente..." : "Searching for opponent..."}
          </h3>
          <p className="mt-2 text-3xl font-bold tabular-nums text-primary">{formatTime(queueTime)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("ranked.estimated")}</p>
          <Button variant="outline" className="mt-6" onClick={handleLeaveQueue}>
            <X className="mr-1.5 h-4 w-4" />
            {locale === "pt-BR" ? "Cancelar" : "Cancel"}
          </Button>
        </Card>
      </div>
    );
  }

  // Match phase
  if (phase === "match" && match) {
    const oppProgress = isPlayer1 ? match.player2Progress : match.player1Progress;
    const oppErrors = isPlayer1 ? match.player2Errors : match.player1Errors;
    const myProgress = isPlayer1 ? match.player1Progress : match.player2Progress;
    const timeLeft = 600 - elapsed;

    return (
      <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar seed={profile.avatarSeed} size={32} className="rounded-md" />
              <div>
                <p className="text-xs font-semibold">{profile.displayName}</p>
                <p className="text-[10px] text-muted-foreground">{myProgress}% · {errors}/3</p>
              </div>
            </div>
            <span className="text-lg font-bold text-muted-foreground">VS</span>
            <div className="flex items-center gap-2">
              <Avatar seed={opponentName} size={32} className="rounded-md" />
              <div>
                <p className="text-xs font-semibold">{opponentName}</p>
                <p className="text-[10px] text-muted-foreground">{oppProgress}% · {oppErrors}/3</p>
              </div>
            </div>
          </div>
          <Badge variant={timeLeft < 60 ? "destructive" : "outline"} className="gap-1 tabular-nums">
            <Clock className="h-3 w-3" />
            {formatTime(timeLeft)}
          </Badge>
        </div>

        {/* Progress bars */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Progress value={myProgress} className="h-2" />
          </div>
          <div>
            <Progress value={oppProgress} className="h-2" />
          </div>
        </div>

        {errors >= 2 && (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-3 py-1.5 text-center text-xs font-medium text-[var(--destructive)]">
            {locale === "pt-BR" ? "Cuidado! Mais 1 erro e você perde!" : "Careful! 1 more error and you lose!"}
          </div>
        )}

        {/* Board */}
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <SudokuBoard
            board={board}
            notes={notes}
            given={given}
            hintCells={[]}
            conflicts={conflicts}
            wrongCells={wrongCells}
            selectedIndex={selectedIndex}
            highlightDigit={0}
            settings={{ highlightPeers: true, highlightSame: true, autoCheck: true, showCandidateCount: false }}
            onSelect={setSelectedIndex}
          />
          <div className="space-y-3">
            <NumberPad
              valueCounts={Array.from({ length: 10 }, (_, i) => board.filter((v) => v === i).length)}
              notesMode={notesMode}
              onNumber={handleNumber}
              onErase={() => {
                if (selectedIndex >= 0 && !given[selectedIndex]) {
                  setBoard((prev) => { const n = prev.slice(); n[selectedIndex] = 0; return n; });
                  setNotes((prev) => { const n = prev.map((x) => x.slice()); n[selectedIndex] = []; return n; });
                }
              }}
              onToggleNotes={() => setNotesMode(!notesMode)}
              onHint={() => {}}
              onUndo={() => {}}
              onRedo={() => {}}
              canUndo={false}
              canRedo={false}
              hintsLeft={0}
              selectedValue={selectedIndex >= 0 ? board[selectedIndex] : 0}
            />
          </div>
        </div>
      </div>
    );
  }

  // Lobby phase
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Swords className="h-6 w-6 text-primary" />
          {t("ranked.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("ranked.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Ranqueada online!" : "Ranked online!"}
        </span>
      </div>

      {/* Rating card */}
      <Card className="relative overflow-hidden p-5">
        <div className="absolute inset-0 opacity-15" style={{ background: `radial-gradient(circle at 30% 20%, ${divInfo.color}, transparent 65%)` }} />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md text-2xl" style={{ background: `color-mix(in oklch, ${divInfo.color} 20%, transparent)`, color: divInfo.color }}>
            <Crown className="h-8 w-8" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{t("ranked.yourDivision")}</p>
            <p className="text-xl font-bold" style={{ color: divInfo.color }}>
              {t(`leaderboard.${division}` as never)}
            </p>
            <p className="text-sm text-muted-foreground">{t("ranked.yourRating")}: <span className="font-mono font-semibold text-foreground">{profile.rating}</span></p>
          </div>
          <Button size="lg" onClick={handleJoinQueue} className="gap-1.5 shadow-md">
            <Zap className="h-4 w-4" />
            {t("ranked.queue")}
          </Button>
        </div>
      </Card>

      <RulesList rules={[...RANKED_RULES]} />

      {/* Divisions */}
      <Card className="p-5">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Trophy className="h-4 w-4 text-[var(--warning)]" />
          {t("leaderboard.divisions")}
        </h3>
        <div className="space-y-2">
          {DIVISIONS.map((d, i) => {
            const isCurrent = d.id === division;
            const isPassed = profile.rating >= d.min;
            return (
              <div key={d.id} className={cn(
                "flex items-center gap-3 rounded-sm border p-3",
                isCurrent ? "border-primary bg-primary/5" : "border-border"
              )}>
                <div className="flex h-9 w-9 items-center justify-center rounded-sm text-xs font-bold" style={{
                  background: isPassed ? `color-mix(in oklch, ${d.color} 25%, transparent)` : "var(--muted)",
                  color: isPassed ? d.color : "var(--muted-foreground)",
                }}>{i + 1}</div>
                <div className="flex-1">
                  <p className="font-medium" style={isPassed ? { color: d.color } : undefined}>{t(`leaderboard.${d.id}` as never)}</p>
                  <p className="text-xs text-muted-foreground">{d.min}+ rating</p>
                </div>
                {isCurrent && <Badge variant="default">★</Badge>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          {t("leaderboard.season")}
        </h3>
        <p className="text-sm text-muted-foreground">{t("ranked.seasons")}</p>
      </Card>
    </div>
  );
}
