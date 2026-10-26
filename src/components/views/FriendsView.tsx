"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/common/Avatar";
import { useAuth } from "@/lib/supabase/auth";
import { GuestLoginRequired } from "@/components/common/GuestLoginRequired";
import {
  fetchFriends,
  fetchPendingRequests,
  fetchSentRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  searchUserByUsername,
  type FriendEntry,
} from "@/lib/supabase/matches";
import { UserPlus, Users, Inbox, Check, X, Loader2, Wifi, Search, UserCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function FriendsView() {
  const { t, locale } = useI18n();
  const { user, isGuest } = useAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [pending, setPending] = useState<FriendEntry[]>([]);
  const [sent, setSent] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{ found: boolean; user?: { id: string; displayName: string; username: string; avatarSeed: string; rating: number } } | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [f, p, s] = await Promise.all([
      fetchFriends(user.id),
      fetchPendingRequests(user.id),
      fetchSentRequests(user.id),
    ]);
    setFriends(f);
    setPending(p);
    setSent(s);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [f, p, s] = await Promise.all([
        fetchFriends(user.id),
        fetchPendingRequests(user.id),
        fetchSentRequests(user.id),
      ]);
      if (!cancelled) {
        setFriends(f);
        setPending(p);
        setSent(s);
        setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    const result = await searchUserByUsername(searchQuery.trim());
    setSearchResult(result);
    setSearching(false);
  };

  const handleSendRequest = async (targetId: string, targetName: string) => {
    if (!user) return;
    setSending(true);
    const result = await sendFriendRequest(user.id, targetId);
    setSending(false);
    if (result.success) {
      toast.success(locale === "pt-BR" ? `Solicitação enviada para ${targetName}!` : `Request sent to ${targetName}!`);
      setSearchResult(null);
      setSearchQuery("");
      load();
    } else if (result.error === "already_friends") {
      toast.info(locale === "pt-BR" ? "Vocês já são amigos." : "You are already friends.");
    } else if (result.error === "already_pending") {
      toast.info(locale === "pt-BR" ? "Já existe uma solicitação pendente." : "A request is already pending.");
    } else {
      toast.error(result.error || "Erro");
    }
  };

  const handleAccept = async (requesterId: string) => {
    if (!user) return;
    const ok = await acceptFriendRequest(user.id, requesterId);
    if (ok) {
      toast.success(locale === "pt-BR" ? "Amizade aceita!" : "Friend added!");
      load();
    } else {
      toast.error("Error");
    }
  };

  const handleReject = async (requesterId: string) => {
    if (!user) return;
    const ok = await rejectFriendRequest(user.id, requesterId);
    if (ok) {
      toast.info(locale === "pt-BR" ? "Solicitação recusada." : "Request declined.");
      load();
    }
  };

  if (isGuest) {
    return <GuestLoginRequired featureName={locale === "pt-BR" ? "Amigos" : "Friends"} />;
  }

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

      <div className="flex items-center gap-2 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 p-3 text-sm">
        <Wifi className="h-4 w-4 text-[var(--success)]" />
        <span className="font-medium text-[var(--success)]">
          {locale === "pt-BR" ? "Amigos online!" : "Friends online!"}
        </span>
      </div>

      {/* Search user by username */}
      <Card className="p-5">
        <p className="mb-3 text-sm font-medium">
          {locale === "pt-BR" ? "Adicionar amigo por nome de usuário" : "Add friend by username"}
        </p>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder={locale === "pt-BR" ? "nome_de_usuario" : "username"}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {/* Search result */}
        {searchResult && (
          <div className="mt-3">
            {searchResult.found && searchResult.user ? (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar seed={searchResult.user.avatarSeed} size={40} />
                  <div>
                    <p className="font-medium">{searchResult.user.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{searchResult.user.username} · {t("profile.rating")}: {searchResult.user.rating}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendRequest(searchResult.user!.id, searchResult.user!.displayName)}
                  disabled={sending}
                  className="gap-1"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  {locale === "pt-BR" ? "Adicionar" : "Add"}
                </Button>
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">
                {locale === "pt-BR" ? "Usuário não encontrado." : "User not found."}
              </p>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Pending requests (incoming) */}
          {pending.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4 text-[var(--warning)]" />
                {locale === "pt-BR" ? "Solicitações recebidas" : "Incoming requests"}
                <span className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-xs font-bold text-[var(--warning)]">{pending.length}</span>
              </h3>
              <div className="space-y-2">
                {pending.map((req) => (
                  <div key={req.userId} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Avatar seed={req.avatarSeed} size={36} />
                      <div>
                        <p className="text-sm font-medium">{req.displayName}</p>
                        <p className="text-xs text-muted-foreground">{t("profile.rating")}: {req.rating}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="default" onClick={() => handleAccept(req.userId)} className="gap-1 h-8">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(req.userId)} className="gap-1 h-8">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sent requests (outgoing) */}
          {sent.length > 0 && (
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {locale === "pt-BR" ? "Solicitações enviadas" : "Sent requests"}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{sent.length}</span>
              </h3>
              <div className="space-y-2">
                {sent.map((req) => (
                  <div key={req.userId} className="flex items-center justify-between rounded-lg border p-3 opacity-70">
                    <div className="flex items-center gap-3">
                      <Avatar seed={req.avatarSeed} size={36} />
                      <div>
                        <p className="text-sm font-medium">{req.displayName}</p>
                        <p className="text-xs text-muted-foreground">{locale === "pt-BR" ? "Aguardando..." : "Pending..."}</p>
                      </div>
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
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{friends.length}</span>
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
                      <Avatar seed={friend.avatarSeed} size={36} />
                      <div>
                        <p className="text-sm font-medium">{friend.displayName}</p>
                        <p className="text-xs text-muted-foreground">{t("profile.rating")}: {friend.rating}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                      {t("friends.online")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
