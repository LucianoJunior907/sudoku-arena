"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import {
  Grid3x3,
  User,
  CalendarDays,
  GraduationCap,
  PieChart,
  Award,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

interface TourStep {
  icon: LucideIcon;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  accent: string;
}

const STEPS: TourStep[] = [
  { icon: Grid3x3, titleKey: "tour.title.welcome", descKey: "tour.desc.welcome", accent: "from-primary/15 to-transparent" },
  { icon: User, titleKey: "tour.title.solo", descKey: "tour.desc.solo", accent: "from-emerald-500/15 to-transparent" },
  { icon: CalendarDays, titleKey: "tour.title.daily", descKey: "tour.desc.daily", accent: "from-teal-500/15 to-transparent" },
  { icon: GraduationCap, titleKey: "tour.title.guide", descKey: "tour.desc.guide", accent: "from-amber-500/15 to-transparent" },
  { icon: PieChart, titleKey: "tour.title.overview", descKey: "tour.desc.overview", accent: "from-[var(--chart-4)]/15 to-transparent" },
  { icon: Award, titleKey: "tour.title.achievements", descKey: "tour.desc.achievements", accent: "from-[var(--warning)]/15 to-transparent" },
  { icon: Settings, titleKey: "tour.title.settings", descKey: "tour.desc.settings", accent: "from-muted to-transparent" },
];

interface GuidedTourProps {
  open: boolean;
  onComplete: () => void;
}

export function GuidedTour({ open, onComplete }: GuidedTourProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === total - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      setStep(0);
    } else {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    onComplete();
    setStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <DialogHeader className="pt-2">
          <div className={cn("relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br", current.accent)}>
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{t(current.titleKey)}</DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed">
            {t(current.descKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Footer buttons */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            {t("tour.skip")}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {t("tour.step")} {step + 1} {t("tour.of")} {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={step === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {t("tour.prev")}
            </Button>
            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLast ? t("tour.done") : t("tour.next")}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
