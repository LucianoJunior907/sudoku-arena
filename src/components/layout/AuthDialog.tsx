"use client";

import { useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, Mail, Lock, User, Chrome, LogOut, Loader2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { checkUsernameAvailable, setUsername } from "@/lib/supabase/matches";
import { cn } from "@/lib/utils";

export function AuthDialog() {
  const { t, locale } = useI18n();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
    } else if (result.error && result.error.includes("characters")) {
      setUsernameStatus("invalid");
    } else {
      setUsernameStatus("taken");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    if (mode === "signup") {
      // Validate username
      if (username.trim().length < 3) {
        toast.error(locale === "pt-BR" ? "Nome de usuário deve ter no mínimo 3 caracteres." : "Username must be at least 3 characters.");
        setBusy(false);
        return;
      }
      if (usernameStatus === "taken") {
        toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken.");
        setBusy(false);
        return;
      }
      // Re-check availability
      const check = await checkUsernameAvailable(username);
      if (!check.available) {
        toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken.");
        setUsernameStatus("taken");
        setBusy(false);
        return;
      }

      const { error } = await signUpWithEmail(email, password, name || username);
      if (error) {
        toast.error(error.message);
      } else {
        // After signup, set the username in the profile
        setTimeout(async () => {
          const result = await setUsername(username);
          if (!result.success) {
            toast.error(result.error || "Failed to set username");
          }
        }, 1500);
        toast.success(locale === "pt-BR" ? "Conta criada!" : "Account created!");
      }
    } else {
      const { error } = await signInWithEmail(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(locale === "pt-BR" ? "Bem-vindo!" : "Welcome!");
      }
    }
    setBusy(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
    setBusy(false);
  };

  // If user is signed in, show profile card + logout button
  if (user) {
    return <LoggedInHeader displayName={user.displayName} onSignOut={signOut} locale={locale} />;
  }

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  // Full-screen opaque login overlay
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      {/* Background pattern */}
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
            {locale === "pt-BR" ? "Treine. Compita. Evolua." : "Train. Compete. Evolve."}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-xl">
          <h2 className="mb-1 text-center text-lg font-semibold">
            {mode === "signin"
              ? (locale === "pt-BR" ? "Entrar" : "Sign In")
              : (locale === "pt-BR" ? "Criar conta" : "Sign Up")}
          </h2>
          <p className="mb-4 text-center text-xs text-muted-foreground">
            {locale === "pt-BR"
              ? "Entre para competir online, salvar seu progresso e jogar com amigos."
              : "Sign in to compete online, sync your progress, and play with friends."}
          </p>

          {/* Google OAuth */}
          <Button variant="outline" className="w-full mb-3" onClick={handleGoogle} disabled={busy}>
            <Chrome className="mr-2 h-4 w-4" />
            {locale === "pt-BR" ? "Continuar com Google" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{locale === "pt-BR" ? "ou" : "or"}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email/Password form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">{locale === "pt-BR" ? "Nome" : "Name"}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={locale === "pt-BR" ? "Seu nome" : "Your name"}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">
                    {locale === "pt-BR" ? "Nome de usuário" : "Username"}
                  </Label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                        setUsernameState(val);
                        if (val.length >= 3) {
                          checkUsername(val);
                        } else {
                          setUsernameStatus("invalid");
                        }
                      }}
                      placeholder="username"
                      className={cn(
                        "pl-9",
                        usernameStatus === "available" && "border-[var(--success)] focus-visible:ring-[var(--success)]",
                        usernameStatus === "taken" && "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]",
                      )}
                      maxLength={20}
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
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{locale === "pt-BR" ? "Senha" : "Password"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy || (mode === "signup" && usernameStatus !== "available")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin"
                ? (locale === "pt-BR" ? "Entrar" : "Sign In")
                : (locale === "pt-BR" ? "Criar conta" : "Sign Up")}
            </Button>
          </form>

          {/* Toggle mode */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "signin"
              ? (locale === "pt-BR" ? "Não tem conta? " : "No account? ")
              : (locale === "pt-BR" ? "Já tem conta? " : "Already have an account? ")}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setUsernameStatus("idle"); }}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin"
                ? (locale === "pt-BR" ? "Criar" : "Sign up")
                : (locale === "pt-BR" ? "Entrar" : "Sign in")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoggedInHeader({ displayName, onSignOut, locale }: { displayName: string; onSignOut: () => void; locale: string }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowLogoutConfirm(true)}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Logout confirmation popup */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl animate-float-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--destructive)]/10">
                <LogOut className="h-7 w-7 text-[var(--destructive)]" />
              </div>
              <h3 className="text-lg font-bold">
                {locale === "pt-BR" ? "Sair da conta?" : "Sign out?"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {locale === "pt-BR"
                  ? "Você precisará entrar novamente para acessar o multiplayer e o ranking."
                  : "You'll need to sign in again to access multiplayer and ranking."}
              </p>
              <div className="mt-5 flex w-full gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  {locale === "pt-BR" ? "Cancelar" : "Cancel"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onSignOut();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  {locale === "pt-BR" ? "Sair" : "Sign out"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
