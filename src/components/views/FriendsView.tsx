"use client";

import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NeedsBackendBanner, DisabledButton } from "@/components/common/ComingSoon";
import { UserPlus, Users, MessageSquare, ShieldAlert, Ban, Inbox } from "lucide-react";
import { useState } from "react";

export function FriendsView() {
  const { t } = useI18n();
  const [addName, setAddName] = useState("");

  const sections = [
    { icon: Users, label: t("friends.friendsList"), desc: t("friends.online") + " / " + t("friends.offline") },
    { icon: Inbox, label: t("friends.requests"), desc: t("friends.needsBackend").slice(0, 60) + "…" },
    { icon: MessageSquare, label: t("friends.invites"), desc: t("friends.needsBackend").slice(0, 60) + "…" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <UserPlus className="h-6 w-6 text-primary" />
          {t("friends.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("friends.subtitle")}</p>
      </div>

      <NeedsBackendBanner noteKey="friends.needsBackend" />

      {/* Add friend (disabled) */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">{t("friends.addFriend")}</p>
        <div className="flex gap-2">
          <Input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="@username"
            disabled
          />
          <DisabledButton label={t("friends.addFriend")} />
        </div>
      </Card>

      {/* Sections structure */}
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="font-medium">{s.label}</p>
              </div>
              <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                <Users className="mb-1 h-5 w-5 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">{t("friends.noFriends")}</p>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground/70">{s.desc}</p>
            </Card>
          );
        })}
      </div>

      {/* Moderation tools (structure only) */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">
          {t("friends.title")} — moderação
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ModerationItem icon={<Ban className="h-4 w-4" />} label="Bloquear" />
          <ModerationItem icon={<ShieldAlert className="h-4 w-4" />} label="Denunciar" />
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground/70">
          {t("friends.needsBackend")}
        </p>
      </Card>
    </div>
  );
}

function ModerationItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      disabled
      className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground opacity-70"
    >
      {icon}
      {label}
    </button>
  );
}
