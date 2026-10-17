"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuideMiniBoard } from "@/components/guide/GuideMiniBoard";
import { GUIDE_LEVELS, GUIDE_TECHNIQUES, techniqueToPractice, type GuideTechnique } from "@/lib/guide/content";
import { ChevronLeft, GraduationCap, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_ACCENT: Record<string, string> = {
  beginner: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30",
  intermediate: "from-teal-500/15 to-amber-500/5 border-teal-500/30",
  advanced: "from-rose-500/15 to-amber-500/5 border-rose-500/30",
};

const KIND_STYLE: Record<string, string> = {
  given: "bg-[var(--cell-bg-given)] border-border",
  solved: "bg-[var(--cell-bg-same)] border-primary/30",
  candidate: "bg-[var(--cell-bg-peer)] border-border",
  target: "bg-[var(--cell-bg-selected)] border-primary",
  eliminate: "bg-[var(--cell-bg-error)] border-[var(--destructive)]/30",
};

export function GuideView() {
  const { t, locale } = useI18n();
  const setRoute = useAppStore((s) => s.setRoute);
  const setPracticeBoard = useAppStore((s) => s.setPracticeBoard);
  const [activeId, setActiveId] = useState<string | null>(null);

  const active = activeId ? GUIDE_TECHNIQUES.find((x) => x.id === activeId) : null;

  if (active) {
    return (
      <ArticleView
        technique={active}
        onBack={() => setActiveId(null)}
        onPractice={() => {
          const pb = techniqueToPractice(active);
          if (pb) {
            setPracticeBoard({
              ...pb,
              difficulty: "easy",
              seed: `guide-${active.id}`,
            });
            setRoute("solo");
          } else {
            // technique illustration isn't a solvable puzzle — fall back to a new easy game
            setPracticeBoard(null);
            setRoute("solo");
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("guide.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("guide.subtitle")}</p>
      </div>

      {GUIDE_LEVELS.map((lvl) => {
        const techniques = GUIDE_TECHNIQUES.filter((x) => x.level === lvl.id);
        return (
          <div key={lvl.id}>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-primary" />
              {t(lvl.labelKey)}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {techniques.map((tech) => (
                <Card
                  key={tech.id}
                  className={cn("group cursor-pointer border bg-gradient-to-br p-4 transition-all hover:shadow-md", LEVEL_ACCENT[lvl.id])}
                  onClick={() => setActiveId(tech.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{tech.title[locale]}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tech.intro[locale]}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tech.legend.map((l, i) => (
                      <span key={i} className={cn("inline-block h-3 w-3 rounded-sm border", KIND_STYLE[l.kind])} />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArticleView({
  technique,
  onBack,
  onPractice,
}: {
  technique: GuideTechnique;
  onBack: () => void;
  onPractice: () => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" />
        {t("guide.backToGuide")}
      </Button>

      <div>
        <Badge variant="secondary" className="mb-2 capitalize">
          {t(`guide.${technique.level}` as never)}
        </Badge>
        <h2 className="text-2xl font-bold">{technique.title[locale]}</h2>
      </div>

      <Card className="p-5">
        <p className="text-sm leading-relaxed text-foreground/90">{technique.intro[locale]}</p>
      </Card>

      <Card className="p-5">
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <BookOpen className="h-4 w-4 text-primary" />
          {t("guide.howItWorks")}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{technique.howItWorks[locale]}</p>
      </Card>

      <Card className="p-5">
        <GuideMiniBoard cells={technique.cells} />
        {/* legend */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {technique.legend.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("inline-block h-3.5 w-3.5 rounded-sm border", KIND_STYLE[l.kind])} />
              {l.label[locale]}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 font-semibold">{t("guide.steps")}</h3>
        <ol className="space-y-2">
          {technique.steps[locale].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="flex justify-center">
        <Button size="lg" onClick={onPractice}>
          <GraduationCap className="mr-2 h-4 w-4" />
          {t("guide.practice")}
        </Button>
      </div>
    </div>
  );
}
