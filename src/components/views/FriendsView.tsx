"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/common/Avatar";
import { NeedsBackendBanner } from "@/components/common/ComingSoon";
import { useAuth } from "@/lib/supabase/auth";
import { fetchFriends, fetchPendingRequests, acceptFriendRequest, sendFriendRequest, type FriendEntry } from "@/lib/supabase/matches";
import { UserPlus, Users, MessageSquare, ShieldAlert, Ban, Inbox, Check, X, Loader2, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function FriendsView() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [requests, setRequests] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addId, setAddId] = useState("");

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [f, r] = await Promise.all([
      fetchFriends(user.id),
      fetchPendingRequests(user.id),
    ]);
    setFriends(f);
    setRequests(r);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [f, r] = await Promise.all([
        fetchFriends(user.id),
        fetchPendingRequests(user.id),
      ]);
      if (!cancelled) {
        setFriends(f);
        setRequests(r);
        setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleAccept = async (requesterId: string) => {
    if (!user) return;
    const ok = await acceptFriendRequest(user.id, requesterId);
    if (ok) {
      load();
    }
  };

  const handleAddFriend = async () => {
    if (!user || !addId.trim()) return;
    const ok = await sendFriendRequest(user.id, addId.trim());
    if (ok) {
      setAddId("");
      load();
    }
  };

  if (!user) {
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
        <Card className="p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {locale === "pt-BR" ? "Entre para adicionar amigos." : "Sign in to add friends."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <UserPlus className="h-6 w-6 text-primary" />
          {t("friends.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("friends.subtitle")}</p>
      </div>

      {/* Online indicator */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Amigos online!" : "Friends online!"}
        </span>
      </div>

      {/* Add friend */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">{t("friends.addFriend")}</p>
        <div className="flex gap-2">
          <Input
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            placeholder={locale === "pt-BR" ? "ID do usuário (UUID)" : "User ID (UUID)"}
          />
          <Button onClick={handleAddFriend} disabled={!addId.trim()}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("friends.addFriend")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {locale === "pt-BR"
            ? "Cole o ID do usuário que você quer adicionar."
            : "Paste the user ID of the person you want to add."}
        </p>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Pending requests */}
          {requests.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4 text-[var(--warning)]" />
                {t("friends.requests")}
                <span className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-xs font-bold text-[var(--warning)]">
                  {requests.length}
                </span>
              </h3>
              <div className="space-y-2">
                {requests.map((req) => (
                  <div key={req.userId} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar seed={req.avatarSeed} size={40} />
                      <div>
                        <p className="font-medium">{req.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {locale === "pt-BR" ? "Quer ser seu amigo" : "Wants to be your friend"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="default" onClick={() => handleAccept(req.userId)} className="gap-1">
                        <Check className="h-3.5 w-3.5" />
                        {locale === "pt-BR" ? "Aceitar" : "Accept"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Friends list */}
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" />
              {t("friends.friendsList")}
              {friends.length > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  {friends.length}
                </span>
              )}
            </h3>
            {friends.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                <Users className="mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("friends.noFriends")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div key={friend.userId} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <Avatar seed={friend.avatarSeed} size={40} />
                      <div>
                        <p className="font-medium">{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">{t("profile.rating")}: {friend.rating}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                        {t("friends.online")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Moderation tools */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">
          {t("friends.title")} — {locale === "pt-BR" ? "moderação" : "moderation"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ModerationItem icon={<Ban className="h-4 w-4" />} label={locale === "pt-BR" ? "Bloquear" : "Block"} />
          <ModerationItem icon={<ShieldAlert className="h-4 w-4" />} label={locale === "pt-BR" ? "Denunciar" : "Report"} />
        </div>
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
