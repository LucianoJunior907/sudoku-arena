"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore, localDivision } from "@/lib/store/app-store";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/common/Avatar";
import { Progress } from "@/components/ui/progress";
import { RulesList } from "@/components/common/ComingSoon";
import { GuestLoginRequired } from "@/components/common/GuestLoginRequired";
import { DivisionPromotionAnimation } from "@/components/sudoku/DivisionPromotionAnimation";
import { DIVISIONS } from "@/lib/progression/progression";
import {
  joinRankedQueue,
  leaveRankedQueue,
  heartbeatQueue,
  tryMatchmake,
  checkForMatch,
  fetchRankedMatch,
  fetchOpponentName,
  updateRankedProgress,
  finishRankedMatch,
  subscribeToRankedMatch,
  type RankedMatch,
  type FinishResult,
} from "@/lib/supabase/ranked";
import { generatePuzzle } from "@/lib/sudoku/engine";
import { SudokuBoard } from "@/components/sudoku/SudokuBoard";
import { NumberPad } from "@/components/sudoku/NumberPad";
import { formatTime } from "@/lib/sudoku/saved-game";
import { isComplete, findConflicts } from "@/lib/sudoku/engine";
import {
  Swords, Trophy, Clock, AlertTriangle, Loader2, Wifi, X, Crown, Zap, Flag,
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

interface ResultData {
  won: boolean;
  reason: string | null;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  opponentName: string;
  errors: number;
  elapsed: number;
  abandoned: boolean;
}

export function RankedView() {
  const { t, locale } = useI18n();
  const { user, isGuest } = useAuth();
  const profile = useAppStore((s) => s.profile);

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
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [showPromotion, setShowPromotion] = useState(false);
  const [promotionData, setPromotionData] = useState<{
    fromDiv: string; toDiv: string; rating: number;
  } | null>(null);

  const isPlayer1 = match?.player1Id === user?.id;
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reportedRef = useRef(false);
  const matchRef = useRef<RankedMatch | null>(null);

  // Keep matchRef in sync for use in callbacks
  useEffect(() => { matchRef.current = match; }, [match]);

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

  // Match timer (counts UP — no 10 min limit per new rules)
  useEffect(() => {
    if (phase !== "match") return;
    matchTimerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [phase]);

  // Queue heartbeat — every 10s while in queue, keeps entry alive
  useEffect(() => {
    if (phase !== "queue") {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    heartbeatQueue(); // immediate
    heartbeatRef.current = setInterval(() => {
      heartbeatQueue();
    }, 10000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (queueTimerRef.current) clearInterval(queueTimerRef.current);
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Leave queue if we were in it (ghost prevention)
      if (user && phase === "queue") {
        leaveRankedQueue(user.id).catch(() => {});
      }
    };
  }, [user, phase]);

  // Handle entering queue
  const handleJoinQueue = async () => {
    if (!user) return;
    setPhase("queue");
    setQueueTime(0);
    const { error } = await joinRankedQueue(user.id, "medium");
    if (error) {
      toast.error(locale === "pt-BR" ? "Erro ao entrar na fila." : "Failed to join queue.");
      setPhase("lobby");
      return;
    }
    // Start polling for match
    pollRef.current = setInterval(async () => {
      // First try to matchmake (create match ourselves)
      const { matchId, boardSeed } = await tryMatchmake("medium");
      if (matchId) {
        await startMatch(matchId, boardSeed);
        return;
      }
      // Also check if someone else matched us
      const found = await checkForMatch();
      if (found.matchId) {
        await startMatch(found.matchId, found.boardSeed);
      }
    }, 2000);
  };

  // Handle leaving queue
  const handleLeaveQueue = async () => {
    if (!user) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    await leaveRankedQueue(user.id);
    setPhase("lobby");
  };

  // Start a match
  const startMatch = async (matchId: string, boardSeed: string | null) => {
    if (!user) return;
    if (pollRef.current) clearInterval(pollRef.current);
    if (queueTimerRef.current) clearInterval(queueTimerRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    const m = await fetchRankedMatch(matchId);
    if (!m) {
      toast.error(locale === "pt-BR" ? "Erro ao carregar partida." : "Failed to load match.");
      setPhase("lobby");
      return;
    }

    const seed = boardSeed || m.boardSeed;
    setMatch(m);
    const isP1 = m.player1Id === user.id;
    const opponentId = isP1 ? m.player2Id : m.player1Id;
    const name = await fetchOpponentName(opponentId);
    setOpponentName(name);

    // Generate the board from the seed (solution stays client-side for
    // gameplay, but the SERVER validates the final solution on finish)
    const p = generatePuzzle(m.difficulty as Difficulty, seed);
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

    // Subscribe to match updates (opponent finished / abandoned)
    const unsub = subscribeToRankedMatch(matchId, async (updated) => {
      setMatch(updated);
      // If the match was finalized by the opponent, show result
      if ((updated.status === "completed" || updated.status === "abandoned") && !reportedRef.current) {
        reportedRef.current = true;
        const won = updated.winnerId === user.id;
        const myBefore = isP1 ? updated.player1RatingBefore : updated.player2RatingBefore;
        const myAfter = isP1 ? updated.player1RatingAfter : updated.player2RatingAfter;
        // Refresh profile to get the new rating from server
        refreshProfileRating();
        setResultData({
          won,
          reason: updated.finishReason,
          ratingBefore: myBefore,
          ratingAfter: myAfter,
          ratingChange: myAfter - myBefore,
          opponentName: name,
          errors,
          elapsed,
          abandoned: false,
        });
        checkPromotion(myBefore, myAfter);
        setPhase("result");
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      }
    });

    return () => unsub();
  };

  // Refresh the rating from the server into the local store
  const refreshProfileRating = useCallback(async () => {
    if (!user) return;
    const { data } = await supabaseQueryRating(user.id);
    if (data?.rating !== undefined) {
      // Update local profile store so leaderboard/UI reflects new rating
      useAppStore.getState().updateProfile({ rating: data.rating });
    }
  }, [user]);

  // Check if the rating change caused a division promotion
  const checkPromotion = useCallback((before: number, after: number) => {
    const beforeDiv = localDivision(before);
    const afterDiv = localDivision(after);
    if (beforeDiv !== afterDiv && after > before) {
      setPromotionData({ fromDiv: beforeDiv, toDiv: afterDiv, rating: after });
      setShowPromotion(true);
    }
  }, []);

  // FINISH match — send solution to server for validation
  const handleFinish = async (abandon = false) => {
    const currentMatch = matchRef.current;
    if (!user || !currentMatch || reportedRef.current) return;
    reportedRef.current = true;

    const isP1 = currentMatch.player1Id === user.id;
    const oppName = opponentName;

    const result: FinishResult = await finishRankedMatch(
      currentMatch.id,
      abandon ? [] : board,
      abandon
    );

    if (result.error) {
      toast.error(result.error);
      reportedRef.current = false;
      return;
    }

    // Refresh profile rating from server
    await refreshProfileRating();

    const won = result.winnerId === user.id;
    setResultData({
      won,
      reason: result.reason,
      ratingBefore: result.ratingBefore,
      ratingAfter: result.ratingAfter,
      ratingChange: result.ratingChange,
      opponentName: oppName,
      errors,
      elapsed,
      abandoned: abandon,
    });
    checkPromotion(result.ratingBefore, result.ratingAfter);
    setPhase("result");
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
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
        setBoard((prev) => {
          const next = prev.slice();
          next[selectedIndex] = 0;
          return next;
        });
      } else {
        const newBoard = board.slice();
        newBoard[selectedIndex] = value;
        setBoard(newBoard);
        const newNotes = notes.map((n) => n.slice());
        newNotes[selectedIndex] = [];
        for (const p of PEERS[selectedIndex]) {
          if (newNotes[p].includes(value)) {
            newNotes[p] = newNotes[p].filter((n) => n !== value);
          }
        }
        setNotes(newNotes);

        // Check error
        const isWrong = value !== solution[selectedIndex];
        let newErrors = errors;
        if (isWrong) {
          newErrors = errors + 1;
          setErrors(newErrors);
          toast.error(locale === "pt-BR" ? `Erro! ${newErrors}/3` : `Error! ${newErrors}/3`);
          if (newErrors >= 3) {
            // Player loses by errors — finish on server (opponent wins)
            handleFinishByErrors();
            return;
          }
        }

        // Check WIN — first to solve correctly wins
        if (isComplete(newBoard)) {
          handleFinish(false); // send solution to server for validation
          return;
        }

        // Update progress to server
        if (matchRef.current) {
          const filledCount = newBoard.filter((v) => v !== 0).length - puzzle.filter((v) => v !== 0).length;
          const totalEmptyCount = puzzle.filter((v) => v === 0).length || 1;
          const pct = Math.round((filledCount / totalEmptyCount) * 100);
          const correct = newBoard.reduce((acc, v, i) => acc + (v !== 0 && v === solution[i] ? 1 : 0), 0);
          updateRankedProgress(matchRef.current.id, pct, newErrors, correct);
        }
      }
    }
  };

  // Player lost by errors (3 errors) — opponent wins
  const handleFinishByErrors = async () => {
    const currentMatch = matchRef.current;
    if (!user || !currentMatch || reportedRef.current) return;
    reportedRef.current = true;
    // Send an INVALID solution so the server marks opponent as winner
    // Actually: we send abandon=false with a wrong board → server validates →
    // invalid → returns error. Better: the server needs a "lose by errors" path.
    // For now, treat as abandon (opponent wins, no abandon penalty since it's errors).
    // We'll send the current incomplete board; server sees it's not a valid
    // solution and returns error. So instead, we DON'T call finish — we let
    // the opponent's realtime update end the match. But if opponent is also
    // stuck, the match never ends. 
    // SIMPLEST: call finish with abandon=true (opponent wins). The penalty
    // is only -50 extra; acceptable for now. A dedicated "errors" path
    // could be added to the RPC later.
    const result = await finishRankedMatch(currentMatch.id, [], true);
    await refreshProfileRating();
    const won = result.winnerId === user.id;
    setResultData({
      won,
      reason: "errors",
      ratingBefore: result.ratingBefore,
      ratingAfter: result.ratingAfter,
      ratingChange: result.ratingChange,
      opponentName,
      errors: 3,
      elapsed,
      abandoned: false,
    });
    checkPromotion(result.ratingBefore, result.ratingAfter);
    setPhase("result");
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
  };

  // Abandon button — show confirmation modal
  const handleAbandonClick = () => {
    setShowAbandonModal(true);
  };

  // Confirm abandon
  const handleAbandonConfirm = async () => {
    setShowAbandonModal(false);
    await handleFinish(true);
  };

  if (isGuest) {
    return <GuestLoginRequired featureName={locale === "pt-BR" ? "Ranked — Competitivo" : "Ranked — Competitive"} />;
  }

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

  // Result phase — enhanced animation (3-5s)
  if (phase === "result" && resultData) {
    return (
      <>
        <ResultScreen data={resultData} locale={locale} onBack={() => {
          setPhase("lobby"); setMatch(null); setResultData(null);
        }} />
        {showPromotion && promotionData && (
          <DivisionPromotionAnimation
            fromDiv={promotionData.fromDiv}
            toDiv={promotionData.toDiv}
            rating={promotionData.rating}
            onComplete={() => { setShowPromotion(false); setPromotionData(null); }}
          />
        )}
      </>
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
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
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

    return (
      <>
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {formatTime(elapsed)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                onClick={handleAbandonClick}
              >
                <Flag className="h-4 w-4" />
                <span className="hidden sm:inline">{locale === "pt-BR" ? "Desistir" : "Forfeit"}</span>
              </Button>
            </div>
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-2 gap-2">
            <div><Progress value={myProgress} className="h-2" /></div>
            <div><Progress value={oppProgress} className="h-2" /></div>
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

        {/* Abandon confirmation modal */}
        {showAbandonModal && (
          <AbandonModal
            locale={locale}
            onCancel={() => setShowAbandonModal(false)}
            onConfirm={handleAbandonConfirm}
          />
        )}
      </>
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

      <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Ranqueada online!" : "Ranked online!"}
        </span>
      </div>

      {/* Rating card */}
      <Card className="relative overflow-hidden p-5">
        <div className="absolute inset-0 opacity-15" style={{ background: `radial-gradient(circle at 30% 20%, ${divInfo.color}, transparent 65%)` }} />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl" style={{ background: `color-mix(in oklch, ${divInfo.color} 20%, transparent)`, color: divInfo.color }}>
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
                "flex items-center gap-3 rounded-lg border p-3",
                isCurrent ? "border-primary bg-primary/5" : "border-border"
              )}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{
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
    </div>
  );
}

// ---- helper: query rating ----
async function supabaseQueryRating(userId: string) {
  const { supabase } = await import("@/lib/supabase/client");
  return supabase.from("profiles").select("rating").eq("id", userId).maybeSingle();
}

// ---- Abandon Modal ----
function AbandonModal({ locale, onCancel, onConfirm }: { locale: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onCancel}>
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl animate-float-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--destructive)]/10">
            <AlertTriangle className="h-7 w-7 text-[var(--destructive)]" />
          </div>
          <h3 className="text-lg font-bold">
            {locale === "pt-BR" ? "Abandonar partida?" : "Forfeit match?"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {locale === "pt-BR"
              ? "Abandonar provoca uma penalidade maior de rating (-50 pontos extras sobre a perda normal). Seu oponente será declarado vencedor."
              : "Forfeiting incurs a larger rating penalty (-50 extra points on top of the normal loss). Your opponent will be declared the winner."}
          </p>
          <div className="mt-5 flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              {locale === "pt-BR" ? "Continuar jogando" : "Keep playing"}
            </Button>
            <Button variant="destructive" className="flex-1 gap-1.5" onClick={onConfirm}>
              <Flag className="h-4 w-4" />
              {locale === "pt-BR" ? "Abandonar" : "Forfeit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Result Screen (enhanced 3-5s animation) ----
function ResultScreen({ data, locale, onBack }: { data: ResultData; locale: string; onBack: () => void }) {
  const [showButton, setShowButton] = useState(false);
  const won = data.won;

  useEffect(() => {
    // Show the "Back" button after the animation completes (4s)
    const timer = setTimeout(() => setShowButton(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className={cn(
        "relative w-full max-w-md overflow-hidden border-2 p-8 text-center",
        won ? "border-[var(--success)]/40" : "border-[var(--destructive)]/40"
      )}>
        {/* Animated background glow */}
        <div className={cn(
          "absolute inset-0 opacity-20 animate-pulse-slow",
          won ? "bg-[var(--success)]" : "bg-[var(--destructive)]"
        )} style={{ animationDuration: "3s" }} />

        <div className="relative">
          {/* Trophy/X icon with entrance animation */}
          <div className={cn(
            "mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-1000",
            won ? "bg-[var(--success)]/15 scale-100" : "bg-[var(--destructive)]/15 scale-100"
          )}
          style={{ animation: won ? "pop 0.6s ease-out, float-up 0.8s ease-out" : "pop 0.6s ease-out" }}>
            {won ? (
              <Trophy className="h-12 w-12 text-[var(--success)]" style={{ animation: "spin 2s ease-out" }} />
            ) : (
              <X className="h-12 w-12 text-[var(--destructive)]" />
            )}
          </div>

          {/* Title with fade-in delay */}
          <h2 className={cn(
            "text-4xl font-bold transition-opacity duration-1000",
            won ? "text-[var(--success)]" : "text-[var(--destructive)]"
          )}
          style={{ animation: "fade-in 1s ease-out 0.3s both" }}>
            {won
              ? (locale === "pt-BR" ? "Vitória!" : "Victory!")
              : data.abandoned
                ? (locale === "pt-BR" ? "Abandonado" : "Forfeited")
                : (locale === "pt-BR" ? "Derrota" : "Defeat")}
          </h2>

          <p className="mt-2 text-sm text-muted-foreground" style={{ animation: "fade-in 1s ease-out 0.6s both" }}>
            {locale === "pt-BR" ? "vs" : "vs"} {data.opponentName}
          </p>

          {/* Rating summary with staggered fade-in */}
          <div className="mt-8 space-y-3" style={{ animation: "fade-in 1s ease-out 0.9s both" }}>
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {locale === "pt-BR" ? "Rating anterior" : "Previous rating"}
              </span>
              <span className="font-mono font-semibold">{data.ratingBefore}</span>
            </div>

            <div className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3",
              data.ratingChange >= 0
                ? "border-[var(--success)]/40 bg-[var(--success)]/5"
                : "border-[var(--destructive)]/40 bg-[var(--destructive)]/5"
            )}>
              <span className="text-sm font-medium">
                {data.ratingChange >= 0
                  ? (locale === "pt-BR" ? "Pontos ganhos" : "Points gained")
                  : (locale === "pt-BR" ? "Pontos perdidos" : "Points lost")}
              </span>
              <span className={cn(
                "font-mono text-lg font-bold",
                data.ratingChange >= 0 ? "text-[var(--success)]" : "text-[var(--destructive)]"
              )}>
                {data.ratingChange >= 0 ? "+" : ""}{data.ratingChange}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border-2 border-primary/40 bg-primary/5 px-4 py-3">
              <span className="text-sm font-semibold">
                {locale === "pt-BR" ? "Rating final" : "Final rating"}
              </span>
              <span className="font-mono text-xl font-bold text-primary">{data.ratingAfter}</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-6 grid grid-cols-2 gap-4" style={{ animation: "fade-in 1s ease-out 1.2s both" }}>
            <div>
              <p className="text-2xl font-bold">{formatTime(data.elapsed)}</p>
              <p className="text-xs text-muted-foreground">{locale === "pt-BR" ? "Tempo" : "Time"}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--destructive)]">{data.errors}</p>
              <p className="text-xs text-muted-foreground">{locale === "pt-BR" ? "Erros" : "Errors"}</p>
            </div>
          </div>

          {/* Division badge */}
          {(() => {
            const newDiv = localDivision(data.ratingAfter);
            const divInfo = DIVISIONS.find((d) => d.id === newDiv)!;
            return (
              <div className="mt-6 flex items-center justify-center gap-2" style={{ animation: "fade-in 1s ease-out 1.5s both" }}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `color-mix(in oklch, ${divInfo.color} 25%, transparent)`, color: divInfo.color }}>
                  <Crown className="h-4 w-4" />
                </div>
                <span className="font-semibold" style={{ color: divInfo.color }}>
                  {locale === "pt-BR" ? "Liga atual" : "Current league"}: {newDiv}
                </span>
              </div>
            );
          })()}

          {/* Back button — appears after animation */}
          <div className="mt-8 transition-opacity duration-500" style={{ opacity: showButton ? 1 : 0 }}>
            <Button className="w-full" size="lg" onClick={onBack} disabled={!showButton}>
              {locale === "pt-BR" ? "Voltar ao lobby" : "Back to lobby"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
