"use client";

import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n/translations";

export function PlaceholderView({
  titleKey,
  subtitleKey,
  noteKey,
}: {
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  noteKey?: TranslationKey;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t(titleKey)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t(subtitleKey)}</p>
      </div>
      <Card className="border-dashed p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-muted">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-medium">{t("common.comingSoon")}</p>
        {noteKey && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t(noteKey)}</p>}
      </Card>
    </div>
  );
}
