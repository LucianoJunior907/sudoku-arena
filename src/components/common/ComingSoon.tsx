"use client";

import { Card } from "@/components/ui/card";
import { WifiOff, ServerCog } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";

export function NeedsBackendBanner({ noteKey }: { noteKey: TranslationKey }) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
        <ServerCog className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <WifiOff className="h-3.5 w-3.5" />
          {t("app.localMode")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(noteKey)}</p>
      </div>
    </div>
  );
}

export function RulesList({ rules }: { rules: TranslationKey[] }) {
  const { t } = useI18n();
  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold">{t("duo.rules")}</h3>
      <ol className="space-y-2">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{t(r)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DisabledButton({ label, sublabel }: { label: string; sublabel?: string }) {
  return (
    <button
      disabled
      className="relative flex flex-1 flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-center opacity-70"
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {sublabel && <span className="text-[10px] text-muted-foreground/70">{sublabel}</span>}
      <span className="absolute right-2 top-2">
        <WifiOff className="h-3.5 w-3.5 text-muted-foreground/60" />
      </span>
    </button>
  );
}
