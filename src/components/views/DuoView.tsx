"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NeedsBackendBanner, RulesList } from "@/components/common/ComingSoon";
import { createRoom, joinRoom, fetchRoomParticipants, subscribeToRoom } from "@/lib/supabase/matches";
import { Users, Lock, Globe, Loader2, Wifi, Copy, Check, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/sudoku/types";

const DUO_RULES = [
  "duo.rules.1", "duo.rules.2", "duo.rules.3", "duo.rules.4",
  "duo.rules.5", "duo.rules.6", "duo.rules.7", "duo.rules.8",
] as const;

interface Participant {
  user_id: string;
  team: number;
  seat: number;
  display_name: string;
  avatar_seed: string;
}

export function DuoView() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const profile = useAppStore((s) => s.profile);
  const [isPrivate, setIsPrivate] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshParticipants = useCallback(async (rId: string) => {
    const data = await fetchRoomParticipants(rId);
    setParticipants(
      data.map((p: Record<string, unknown>) => ({
        user_id: p.user_id as string,
        team: p.team as number,
        seat: p.seat as number,
        display_name: (p.profiles as Record<string, unknown>)?.display_name as string ?? "Player",
        avatar_seed: (p.profiles as Record<string, unknown>)?.avatar_seed as string ?? "default",
      }))
    );
  }, []);

  // Subscribe to room changes
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const doRefresh = async () => {
      if (!cancelled) await refreshParticipants(roomId);
    };
    doRefresh();
    const unsub = subscribeToRoom(roomId, doRefresh);
    return () => { cancelled = true; unsub(); };
  }, [roomId, refreshParticipants]);

  const handleCreate = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const result = await createRoom(user.id, "medium" as Difficulty, isPrivate);
    if (result) {
      setRoomCode(result.code);
      setRoomId(result.roomId);
    } else {
      setError(locale === "pt-BR" ? "Erro ao criar sala." : "Failed to create room.");
    }
    setBusy(false);
  };

  const handleJoin = async () => {
    if (!user || !code.trim()) return;
    setBusy(true);
    setError(null);
    const rId = await joinRoom(code.trim(), user.id);
    if (rId) {
      setRoomId(rId);
      setRoomCode(code.trim().toUpperCase());
    } else {
      setError(locale === "pt-BR" ? "Sala não encontrada ou cheia." : "Room not found or full.");
    }
    setBusy(false);
  };

  const handleLeave = () => {
    setRoomId(null);
    setRoomCode(null);
    setParticipants([]);
    setCode("");
  };

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!user) {
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
        <Card className="p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {locale === "pt-BR" ? "Entre para jogar Duo." : "Sign in to play Duo."}
          </p>
        </Card>
      </div>
    );
  }

  // In-room view
  if (roomId && roomCode) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" />
            {t("duo.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("duo.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2 rounded-sm border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
          <Wifi className="h-4 w-4 text-[var(--success)]" />
          <span className="font-medium text-[var(--success)]">
            {locale === "pt-BR" ? "Sala ativa!" : "Room active!"}
          </span>
        </div>

        {/* Room code */}
        <Card className="p-5">
          <p className="mb-2 text-sm font-medium">
            {locale === "pt-BR" ? "Código da sala" : "Room code"}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-sm border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center">
              <span className="text-2xl font-bold tracking-widest text-primary">{roomCode}</span>
            </div>
            <Button variant="outline" size="icon" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {locale === "pt-BR"
              ? "Compartilhe este código com outros jogadores."
              : "Share this code with other players."}
          </p>
        </Card>

        {/* Teams */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-medium">{t("duo.title")} — 2×2</p>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2].map((team) => (
              <div
                key={team}
                className={cn(
                  "rounded-sm border-2 p-3",
                  team === 1 ? "border-primary/40" : "border-[var(--chart-4)]/40"
                )}
              >
                <p className={cn("mb-2 text-xs font-semibold", team === 1 ? "text-primary" : "text-[var(--chart-4)]")}>
                  {t("duo.title")} {team === 1 ? "A" : "B"}
                </p>
                {[1, 2].map((seat) => {
                  const p = participants.find((x) => x.team === team && x.seat === seat);
                  return (
                    <div key={seat} className={cn("mb-2 flex items-center gap-2", !p && "opacity-40")}>
                      <Avatar seed={p?.avatar_seed ?? "empty"} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{p?.display_name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p ? (locale === "pt-BR" ? "pronto" : "ready") : (locale === "pt-BR" ? "vago" : "empty")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {participants.length < 4 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {locale === "pt-BR"
                ? `Aguardando ${4 - participants.length} jogador(es)...`
                : `Waiting for ${4 - participants.length} player(s)...`}
            </p>
          )}
          {participants.length === 4 && (
            <Button className="mt-3 w-full" size="lg">
              {locale === "pt-BR" ? "Iniciar partida" : "Start match"}
            </Button>
          )}
        </Card>

        <Button variant="outline" onClick={handleLeave} className="w-full gap-1.5">
          <LogOut className="h-4 w-4" />
          {locale === "pt-BR" ? "Sair da sala" : "Leave room"}
        </Button>
      </div>
    );
  }

  // Lobby view (create/join)
  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6 text-primary" />
          {t("duo.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("duo.subtitle")}</p>
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Duo online!" : "Duo online!"}
        </span>
      </div>

      {/* Team preview */}
      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">{t("duo.title")} — 2×2</p>
        <div className="grid grid-cols-2 gap-4">
          <TeamCard name={t("duo.title") + " A"} you={profile.displayName} partner={null} color="var(--primary)" />
          <TeamCard name={t("duo.title") + " B"} you={null} partner={null} color="var(--chart-4)" />
        </div>
      </Card>

      <RulesList rules={[...DUO_RULES]} />

      {/* Room controls */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">{t("duo.createRoom")} / {t("duo.joinRoom")}</p>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setIsPrivate(false)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                !isPrivate ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"
              )}
            >
              <Globe className="h-4 w-4" />
              {t("duo.public")}
            </button>
            <button
              onClick={() => setIsPrivate(true)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors",
                isPrivate ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"
              )}
            >
              <Lock className="h-4 w-4" />
              {t("duo.private")}
            </button>
          </div>

          <Button className="w-full" size="lg" onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="mr-1.5 h-4 w-4" />}
            {t("duo.createRoom")}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="roomcode">{t("duo.roomCode")}</Label>
            <div className="flex gap-2">
              <Input
                id="roomcode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="font-mono uppercase"
              />
              <Button onClick={handleJoin} disabled={busy || !code.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("duo.joinRoom")}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-center text-xs text-[var(--destructive)]">{error}</p>
          )}
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
    <div className="rounded-sm border p-3" style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}>
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
