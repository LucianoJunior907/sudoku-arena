"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import type { DailyRecord } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

interface StreakCalendarProps {
  records: DailyRecord[];
  /** number of weeks to show */
  weeks?: number;
}

/** GitHub-style contribution heat-map of completed daily challenges. */
export function StreakCalendar({ records, weeks = 13 }: StreakCalendarProps) {
  const { t } = useI18n();

  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - today.getDay()));
    const start = new Date(end);
    start.setDate(end.getDate() - (weeks * 7 - 1));

    const cols: Date[][] = [];
    const months: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const col: Date[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        col.push(date);
        const m = date.getMonth();
        if (d === 1 && m !== lastMonth) {
          months.push({ col: w, label: date.toLocaleDateString(undefined, { month: "short" }) });
          lastMonth = m;
        }
      }
      cols.push(col);
    }
    return { cols, months };
  }, [weeks]);

  const levelColors = [
    "bg-muted/50",
    "bg-primary/30",
    "bg-primary/55",
    "bg-primary/80",
    "bg-primary",
  ];

  function levelFor(date: Date): 0 | 1 | 2 | 3 | 4 {
    const key = date.toISOString().slice(0, 10);
    const todayKey = new Date().toISOString().slice(0, 10);
    if (key > todayKey) return 0;
    const score = records.find((r) => r.date === key && r.completed)?.score ?? 0;
    if (score === 0) return 0;
    if (score < 500) return 1;
    if (score < 1500) return 2;
    if (score < 3000) return 3;
    return 4;
  }

  const completedCount = records.filter((r) => r.completed).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold">{t("daily.streak")}</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount} {t("daily.completed").toLowerCase()}
        </span>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <div className="inline-block min-w-full">
          {/* month labels */}
          <div className="mb-1 flex gap-[3px] pl-6 text-[10px] text-muted-foreground">
            {grid.cols.map((_, w) => {
              const m = grid.months.find((x) => x.col === w);
              return (
                <span key={w} className="w-3 text-center">
                  {m?.label ?? ""}
                </span>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {/* weekday labels */}
            <div className="flex flex-col gap-[3px] pr-1 text-[9px] leading-3 text-muted-foreground">
              {["", "S", "", "T", "", "Q", ""].map((label, i) => (
                <span key={i} className="h-3">{label}</span>
              ))}
            </div>
            {grid.cols.map((col, w) => (
              <div key={w} className="flex flex-col gap-[3px]">
                {col.map((date, d) => {
                  const lvl = levelFor(date);
                  const key = date.toISOString().slice(0, 10);
                  const isToday = key === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={key}
                      title={`${date.toLocaleDateString()} · ${lvl > 0 ? t("daily.completed") : "—"}`}
                      className={cn(
                        "h-3 w-3 rounded-sm transition-all hover:scale-125 hover:ring-1 hover:ring-primary/40",
                        levelColors[lvl],
                        isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                      )}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* legend */}
          <div className="mt-3 flex items-center justify-end gap-1 text-[9px] text-muted-foreground">
            <span className="mr-1">{t("common.level").toLowerCase()}</span>
            {levelColors.map((c, i) => (
              <span key={i} className={cn("h-3 w-3 rounded-sm", c)} />
            ))}
            <span className="ml-1">{t("daily.completed").toLowerCase()}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
