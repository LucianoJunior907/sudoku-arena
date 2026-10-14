"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
  Cell,
} from "recharts";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import type { Difficulty } from "@/lib/sudoku/types";

const DIFFS: Difficulty[] = ["easy", "medium", "hard", "expert"];
const COLORS: Record<Difficulty, string> = {
  easy: "oklch(0.55 0.14 168)",
  medium: "oklch(0.6 0.12 195)",
  hard: "oklch(0.75 0.16 75)",
  expert: "oklch(0.58 0.22 25)",
};

export function ProfileCharts() {
  const { t, locale } = useI18n();
  const stats = useAppStore((s) => s.stats);
  const history = useAppStore((s) => s.history);

  const winRateData = useMemo(
    () =>
      DIFFS.map((d) => {
        const s = stats.solo[d];
        return {
          name: t(`difficulty.${d}` as never),
          rate: s.played ? Math.round((s.wins / s.played) * 100) : 0,
          played: s.played,
          color: COLORS[d],
        };
      }),
    [stats, t, locale]
  );

  const xpOverTime = useMemo(() => {
    const chrono = [...history].reverse();
    const points = chrono.reduce<{ idx: number; xp: number }[]>((acc, h, i) => {
      const prev = acc.length ? acc[acc.length - 1].xp : 0;
      acc.push({ idx: i + 1, xp: prev + h.xp });
      return acc;
    }, []);
    if (points.length === 0) return [];
    return [{ idx: 0, xp: 0 }, ...points];
  }, [history]);

  const noSoloData = winRateData.every((d) => d.played === 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Win rate by difficulty */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">
          {t("profile.winRate")} · {t("nav.solo")}
        </h3>
        {noSoloData ? (
          <EmptyChart label={t("history.empty")} />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={winRateData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, t("profile.winRate")]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {winRateData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* XP over time */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">
          {t("common.xp")} · {t("profile.statistics")}
        </h3>
        {xpOverTime.length <= 1 ? (
          <EmptyChart label={t("history.empty")} />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={xpOverTime} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="idx" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [v, t("common.xp")]}
                labelFormatter={(l) => `#${l}`}
              />
              <Area type="monotone" dataKey="xp" stroke="var(--primary)" strokeWidth={2} fill="url(#xpGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
