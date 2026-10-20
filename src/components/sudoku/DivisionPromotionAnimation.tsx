"use client";

import { useEffect, useState } from "react";
import { Crown, ChevronUp } from "lucide-react";
import { DIVISIONS } from "@/lib/progression/progression";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";

interface DivisionPromotionAnimationProps {
  fromDiv: string;
  toDiv: string;
  rating: number;
  onComplete: () => void;
}

/**
 * Full-screen division promotion animation.
 * Sequence:
 *   1. Screen dims
 *   2. Old division emblem fades in
 *   3. Transform: emblem morphs + slides up
 *   4. New division emblem + name revealed
 *   5. Final rating shown
 *   6. "Continue" button appears
 *
 * Respects prefers-reduced-motion (skips to final state).
 */
export function DivisionPromotionAnimation({
  fromDiv,
  toDiv,
  rating,
  onComplete,
}: DivisionPromotionAnimationProps) {
  const { t, locale } = useI18n();
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [stage, setStage] = useState<"old" | "transition" | "new" | "done">(
    () => {
      // If reduced motion, skip directly to done
      if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return "done";
      }
      return "old";
    }
  );

  const fromInfo = DIVISIONS.find((d) => d.id === fromDiv);
  const toInfo = DIVISIONS.find((d) => d.id === toDiv);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      // Skip animation for reduced-motion users — already initialized to "done"
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Stage 1: show old emblem (0.8s)
    timers.push(setTimeout(() => setStage("transition"), 800));
    // Stage 2: transition morph (1.5s)
    timers.push(setTimeout(() => setStage("new"), 2300));
    // Stage 3: show new + rating (1.5s)
    timers.push(setTimeout(() => setStage("done"), 3800));

    return () => timers.forEach(clearTimeout);
  }, [reducedMotion]);

  if (!fromInfo || !toInfo) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-background/95 backdrop-blur-md"
      style={{ animation: "fade-in 0.5s ease-out both" }}>

      {/* Animated radial glow */}
      <div className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${toInfo.color}, transparent 60%)`,
          animation: "pulse-slow 2s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6">

        {/* Old division (fades out during transition) */}
        <div className={cn_transition(stage === "old", stage === "transition")}
          style={{
            opacity: stage === "old" ? 1 : stage === "transition" ? 0.3 : 0,
            transform: stage === "transition" ? "translateY(-40px) scale(0.8)" : "translateY(0) scale(1)",
            transition: "all 1s ease-out",
          }}>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl mb-3 mx-auto"
            style={{ background: `color-mix(in oklch, ${fromInfo.color} 20%, transparent)`, color: fromInfo.color }}>
            <Crown className="h-10 w-10" />
          </div>
          <p className="text-sm text-muted-foreground">
            {locale === "pt-BR" ? "Liga anterior" : "Previous league"}
          </p>
          <p className="text-xl font-bold" style={{ color: fromInfo.color }}>
            {t(`leaderboard.${fromDiv}` as never)}
          </p>
        </div>

        {/* Arrow / chevron during transition */}
        {stage === "transition" && (
          <div className="my-4" style={{ animation: "pop 0.5s ease-out" }}>
            <ChevronUp className="h-10 w-10 text-primary animate-bounce" />
          </div>
        )}

        {/* New division (fades in) */}
        {stage !== "old" && (
          <div className="mt-6"
            style={{
              opacity: stage === "transition" ? 0.5 : 1,
              transform: stage === "transition" ? "translateY(40px) scale(0.8)" : "translateY(0) scale(1)",
              transition: "all 1s ease-out",
              animation: stage === "new" || stage === "done" ? "pop 0.8s ease-out" : undefined,
            }}>
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl mb-4 mx-auto relative"
              style={{
                background: `color-mix(in oklch, ${toInfo.color} 25%, transparent)`,
                color: toInfo.color,
                boxShadow: `0 0 40px ${toInfo.color}40`,
              }}>
              <Crown className="h-14 w-14" />
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-3xl border-2"
                style={{ borderColor: toInfo.color, animation: "pulse-slow 1.5s ease-in-out infinite" }} />
            </div>

            <p className="text-sm font-medium text-primary mb-1"
              style={{ animation: "fade-in 0.8s ease-out 0.3s both" }}>
              {locale === "pt-BR" ? "PROMOÇÃO!" : "PROMOTION!"}
            </p>
            <h2 className="text-4xl font-bold mb-2"
              style={{ color: toInfo.color, animation: "fade-in 0.8s ease-out 0.5s both" }}>
              {t(`leaderboard.${toDiv}` as never)}
            </h2>

            {(stage === "new" || stage === "done") && (
              <div className="mt-4" style={{ animation: "fade-in 1s ease-out 1s both" }}>
                <p className="text-sm text-muted-foreground">
                  {locale === "pt-BR" ? "Rating final" : "Final rating"}
                </p>
                <p className="text-3xl font-bold font-mono text-foreground mt-1">{rating}</p>

                {/* Rank position among divisions */}
                <div className="mt-6 flex items-center justify-center gap-1">
                  {DIVISIONS.map((d, i) => {
                    const reached = d.min <= rating;
                    const isCurrent = d.id === toDiv;
                    const isPassed = d.id === fromDiv;
                    return (
                      <div key={d.id}
                        className={cn_dot(reached, isCurrent, isPassed)}
                        style={{
                          background: reached ? d.color : "var(--muted)",
                          opacity: isCurrent ? 1 : reached ? 0.5 : 0.2,
                          width: isCurrent ? 12 : 8,
                          height: isCurrent ? 12 : 8,
                        }}
                        title={d.id}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Continue button — appears at the end */}
        {stage === "done" && (
          <div className="mt-8" style={{ animation: "fade-in 0.5s ease-out both" }}>
            <Button size="lg" onClick={onComplete}>
              {locale === "pt-BR" ? "Continuar" : "Continue"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// helper to avoid importing cn (keep component self-contained-ish)
function cn_transition(isOld: boolean, isTransition: boolean): string {
  return isOld ? "block" : isTransition ? "block" : "hidden";
}
function cn_dot(reached: boolean, isCurrent: boolean, isPassed: boolean): string {
  return "rounded-full transition-all duration-500";
}
