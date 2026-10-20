"use client";

import { useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, AtSign, Loader2, Check, Chrome } from "lucide-react";
import { toast } from "sonner";
import { checkUsernameAvailable, setUsername } from "@/lib/supabase/matches";
import { cn } from "@/lib/utils";

/**
 * Shown when a Google OAuth user signs in for the first time and doesn't
 * have a username yet. They must choose a username (and optionally set a
 * password) before accessing the lobby.
 *
 * The Supabase session is already established (Google auth succeeded),
 * so we just need to set the username in their profile.
 */
export function GoogleSignupCompletion() {
  const { locale } = useI18n();
  const { user } = useAuth();
  const [username, setUsernameState] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);

  const checkUsername = async (value: string) => {
    setUsernameState(value);
    if (value.length < 3) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const result = await checkUsernameAvailable(value);
    if (result.available) {
      setUsernameStatus("available");
    } else if (result.error) {
      const err = result.error.toLowerCase();
      if (err.includes("character") || err.includes("must be") || err.includes("only letters")) {
        setUsernameStatus("invalid");
      } else if (err.includes("taken") || err.includes("already") || err.includes("exists")) {
        setUsernameStatus("taken");
      } else {
        setUsernameStatus("available");
      }
    } else {
      setUsernameStatus("taken");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (username.trim().length < 3) {
      toast.error(locale === "pt-BR" ? "Nome de usuário deve ter no mínimo 3 caracteres." : "Username must be at least 3 characters.");
      return;
    }
    if (usernameStatus === "taken") {
      toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken.");
      return;
    }
    setBusy(true);
    const result = await setUsername(username);
    if (!result.success) {
      toast.error(result.error || (locale === "pt-BR" ? "Erro ao definir nome de usuário." : "Failed to set username."));
      setBusy(false);
      return;
    }
    toast.success(locale === "pt-BR" ? "Cadastro concluído! Bem-vindo!" : "Signup complete! Welcome!");
    // Reload to refresh the auth state (profile now has username)
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 bg-arena-grid opacity-30" />
      <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-[var(--warning)]/10 blur-3xl" />

      <div className="relative w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Grid3x3 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Sudoku Arena</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "pt-BR" ? "Complete seu cadastro" : "Complete your signup"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <Chrome className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground">
              {locale === "pt-BR"
                ? "Conectado com Google. Escolha um nome de usuário para concluir."
                : "Connected with Google. Choose a username to finish."}
            </span>
          </div>

          <h2 className="mb-1 text-center text-lg font-semibold">
            {locale === "pt-BR" ? "Escolha seu nome de usuário" : "Choose your username"}
          </h2>
          <p className="mb-4 text-center text-xs text-muted-foreground">
            {locale === "pt-BR"
              ? "Será sua identidade pública no jogo, ranking e perfil."
              : "This will be your public identity in the game, ranking, and profile."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="google-username">
                {locale === "pt-BR" ? "Nome de usuário" : "Username"}
              </Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="google-username"
                  value={username}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                    checkUsername(val);
                  }}
                  placeholder="username"
                  className={cn(
                    "pl-9",
                    usernameStatus === "available" && "border-[var(--success)] focus-visible:ring-[var(--success)]",
                    usernameStatus === "taken" && "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]",
                  )}
                  maxLength={20}
                  required
                  autoFocus
                />
                {usernameStatus === "checking" && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--success)]">
                    {locale === "pt-BR" ? "Disponível" : "Available"}
                  </span>
                )}
                {usernameStatus === "taken" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--destructive)]">
                    {locale === "pt-BR" ? "Em uso" : "Taken"}
                  </span>
                )}
              </div>
              {usernameStatus === "invalid" && username.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {locale === "pt-BR" ? "Mínimo 3 caracteres. Apenas letras, números e _." : "Min 3 characters. Letters, numbers and _ only."}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || usernameStatus !== "available"}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  <Check className="h-4 w-4" />
                  {locale === "pt-BR" ? "Concluir cadastro" : "Complete signup"}
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
