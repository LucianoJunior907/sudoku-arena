"use client";

import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/sudoku/saved-game";
import { History as HistoryIcon, Trophy, X, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/translations";

export function HistoryView() {
  const { t } = useI18n();
  const history = useAppStore((s) => s.history);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("history.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("history.subtitle")}</p>
      </div>

      {history.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <HistoryIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{t("history.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="scrollbar-thin max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">{t("history.mode")}</th>
                  <th className="px-4 py-3">{t("history.difficulty")}</th>
                  <th className="px-4 py-3">{t("history.time")}</th>
                  <th className="px-4 py-3">{t("history.result")}</th>
                  <th className="px-4 py-3 text-right">{t("history.xp")}</th>
                  <th className="hidden px-4 py-3 text-right sm:table-cell">{t("history.date")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-medium capitalize">{t(`nav.${h.mode}` as never)}</span>
                    </td>
                    <td className="px-4 py-3">{t(`difficulty.${h.difficulty}` as never)}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatTime(h.elapsedSec)}</td>
                    <td className="px-4 py-3">
                      {h.completed ? (
                        <Badge variant="default" className="gap-1">
                          <Trophy className="h-3 w-3" />
                          {t("history.win")}
                        </Badge>
                      ) : h.mode === "ranked" ? (
                        <Badge variant="secondary" className="gap-1">
                          <X className="h-3 w-3" />
                          {t("history.loss")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <X className="h-3 w-3" />
                          {t("history.abandoned")}
                        </Badge>
                      )}
                      {h.isRecord && (
                        <Badge variant="outline" className="ml-1 gap-1 border-[var(--warning)]/40 text-[var(--warning)]">
                          <Sparkles className="h-3 w-3" />
                          {t("solo.newRecord")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-primary">+{h.xp}</td>
                    <td className="hidden px-4 py-3 text-right text-xs text-muted-foreground sm:table-cell">
                      {new Date(h.date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
