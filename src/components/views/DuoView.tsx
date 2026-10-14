"use client";

import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/common/Avatar";
import { NeedsBackendBanner, RulesList, DisabledButton } from "@/components/common/ComingSoon";
import { Users, Lock, Globe } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const DUO_RULES = [
  "duo.rules.1",
  "duo.rules.2",
  "duo.rules.3",
  "duo.rules.4",
  "duo.rules.5",
  "duo.rules.6",
  "duo.rules.7",
  "duo.rules.8",
] as const;

export function DuoView() {
  const { t } = useI18n();
  const profile = useAppStore((s) => s.profile);
  const [code, setCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6 text-primary" />
          {t("duo.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("duo.subtitle")}</p>
      </div>

      <NeedsBackendBanner noteKey="duo.needsBackend" />

      {/* Team preview (you + partner placeholder) */}
      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">
          {t("duo.title")} — 2×2
        </p>
        <div className="grid grid-cols-2 gap-4">
          <TeamCard
            name={t("duo.title") + " A"}
            you={profile.displayName}
            partner={null}
            color="var(--primary)"
          />
          <TeamCard
            name={t("duo.title") + " B"}
            you={null}
            partner={null}
            color="var(--chart-4)"
          />
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t("duo.needsBackend")}
        </p>
      </Card>

      <RulesList rules={[...DUO_RULES]} />

      {/* Room controls (disabled) */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">{t("duo.createRoom")} / {t("duo.joinRoom")}</p>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              disabled
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm",
                !isPrivate ? "border-primary bg-primary/5 text-primary" : "border-border opacity-60"
              )}
              onClick={() => setIsPrivate(false)}
            >
              <Globe className="h-4 w-4" />
              {t("duo.public")}
            </button>
            <button
              disabled
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm",
                isPrivate ? "border-primary bg-primary/5 text-primary" : "border-border opacity-60"
              )}
              onClick={() => setIsPrivate(true)}
            >
              <Lock className="h-4 w-4" />
              {t("duo.private")}
            </button>
          </div>

          <DisabledButton label={t("duo.createRoom")} sublabel={t("duo.needsBackend").slice(0, 40) + "…"} />

          <div className="space-y-2">
            <Label htmlFor="roomcode">{t("duo.roomCode")}</Label>
            <div className="flex gap-2">
              <Input
                id="roomcode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                disabled
                className="font-mono uppercase"
              />
              <DisabledButton label={t("duo.joinRoom")} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TeamCard({
  name,
  you,
  partner,
  color,
}: {
  name: string;
  you: string | null;
  partner: string | null;
  color: string;
}) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}>
      <p className="mb-2 text-xs font-semibold" style={{ color }}>
        {name}
      </p>
      <div className="flex items-center gap-2">
        <Avatar seed={you ?? "empty-1"} size={36} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{you ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">{you ? "você" : "vago"}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 opacity-50">
        <Avatar seed={partner ?? "empty-2"} size={36} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{partner ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">vago</p>
        </div>
      </div>
    </div>
  );
}
