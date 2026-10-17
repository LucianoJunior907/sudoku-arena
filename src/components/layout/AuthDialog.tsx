"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, Mail, Lock, User, Chrome, LogOut, Loader2, AtSign, Eye, EyeOff, Ghost, LogIn, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { checkUsernameAvailable, setUsername } from "@/lib/supabase/matches";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AuthDialog() {
  const { locale } = useI18n();
  const { user, loading, isGuest, signInWithUsernameOrEmail, signUpWithEmail, signInWithGoogle, signOut, enterGuestMode, exitGuestMode } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsernameState] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      // Distinguish validation errors (format/length) from "actually taken"
      const err = result.error.toLowerCase();
      if (err.includes("character") || err.includes("must be") || err.includes("only letters")) {
        setUsernameStatus("invalid");
      } else if (err.includes("taken") || err.includes("already") || err.includes("exists")) {
        setUsernameStatus("taken");
      } else {
        // RPC/permission/network error — don't block the user, allow them to try
        // (the final re-check on submit will catch real conflicts)
        setUsernameStatus("available");
      }
    } else {
      // No error but not available = genuinely taken
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
      // Validate password confirmation
      if (password !== confirmPassword) {
        toast.error(locale === "pt-BR" ? "As senhas não coincidem." : "Passwords do not match.");
        setBusy(false);
        return;
      }
      // Re-check availability (but don't block on RPC errors — set_username will validate)
      const check = await checkUsernameAvailable(username);
      if (!check.available && (!check.error || check.error.toLowerCase().includes("taken") || check.error.toLowerCase().includes("already"))) {
        toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken.");
        setUsernameStatus("taken");
        setBusy(false);
        return;
      }

      const { error } = await signUpWithEmail(email, password, name || username, username);
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
      // Login by username or email
      if (!loginIdentifier.trim()) {
        toast.error(locale === "pt-BR" ? "Digite seu nome de usuário ou email." : "Enter your username or email.");
        setBusy(false);
        return;
      }
      const { error } = await signInWithUsernameOrEmail(loginIdentifier, password);
      if (error) {
        toast.error(locale === "pt-BR" ? "Credenciais inválidas." : "Invalid credentials.");
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

  // If user is signed in (or in guest mode), show profile card + logout button
  if (user) {
    return (
      <LoggedInHeader
        displayName={user.displayName}
        onSignOut={signOut}
        locale={locale}
        isGuest={isGuest}
        onLogin={exitGuestMode}
      />
    );
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-arena-grid opacity-30" />
      <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-[var(--warning)]/10 blur-3xl" />

      {/* Grid-aligned numbers */}
      <GridNumbers />

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

          {/* Supabase not configured warning (e.g. missing env vars on Vercel) */}
          {!isSupabaseConfigured && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-amber-700 dark:text-amber-300">
                <p className="font-semibold">
                  {locale === "pt-BR" ? "Backend não configurado" : "Backend not configured"}
                </p>
                <p className="mt-0.5 leading-relaxed">
                  {locale === "pt-BR"
                    ? "As variáveis do Supabase não foram definidas. Login não funcionará, mas você pode jogar como visitante."
                    : "Supabase environment variables are missing. Login won't work, but you can play as guest."}
                </p>
              </div>
            </div>
          )}

          {/* Google OAuth */}
          <Button variant="outline" className="w-full mb-3" onClick={handleGoogle} disabled={busy || !isSupabaseConfigured}>
            <Chrome className="mr-2 h-4 w-4" />
            {locale === "pt-BR" ? "Continuar com Google" : "Continue with Google"}
          </Button>

          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{locale === "pt-BR" ? "ou" : "or"}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signin" ? (
              /* Login by username or email */
              <div className="space-y-1.5">
                <Label htmlFor="loginId">
                  {locale === "pt-BR" ? "Nome de usuário ou email" : "Username or email"}
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="loginId"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={locale === "pt-BR" ? "@usuario ou email" : "@username or email"}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
            ) : (
              /* Signup fields */
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
              </>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">{locale === "pt-BR" ? "Senha" : "Password"}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password confirmation (signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">
                  {locale === "pt-BR" ? "Confirmar senha" : "Confirm password"}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "pl-9 pr-9",
                      confirmPassword.length > 0 && password !== confirmPassword && "border-[var(--destructive)] focus-visible:ring-[var(--destructive)]",
                      confirmPassword.length > 0 && password === confirmPassword && "border-[var(--success)] focus-visible:ring-[var(--success)]",
                    )}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-[var(--destructive)]">
                    {locale === "pt-BR" ? "As senhas não coincidem." : "Passwords do not match."}
                  </p>
                )}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={busy || !isSupabaseConfigured || (mode === "signup" && ((usernameStatus !== "available" && usernameStatus !== "idle" && usernameStatus !== "checking") || (confirmPassword.length > 0 && password !== confirmPassword)))}
            >
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
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setUsernameStatus("idle");
                setPassword("");
                setConfirmPassword("");
              }}
              className="font-semibold text-primary hover:underline"
            >
              {mode === "signin"
                ? (locale === "pt-BR" ? "Criar" : "Sign up")
                : (locale === "pt-BR" ? "Entrar" : "Sign in")}
            </button>
          </p>

          {/* Guest mode divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {locale === "pt-BR" ? "ou" : "or"}
              </span>
            </div>
          </div>

          {/* Play as guest */}
          <Button
            type="button"
            variant={isSupabaseConfigured ? "ghost" : "default"}
            className={cn(
              "w-full border border-dashed",
              isSupabaseConfigured
                ? "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            )}
            onClick={enterGuestMode}
          >
            <Ghost className="h-4 w-4" />
            {locale === "pt-BR" ? "Jogar como visitante" : "Play as guest"}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
            {locale === "pt-BR"
              ? "Explore o modo solo e o guia sem criar conta."
              : "Explore solo mode and the guide without an account."}
          </p>
        </div>
      </div>
    </div>
  );
}

function LoggedInHeader({ displayName, onSignOut, locale, isGuest, onLogin }: { displayName: string; onSignOut: () => void; locale: string; isGuest?: boolean; onLogin?: () => void }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5",
          isGuest && "border-dashed border-muted-foreground/40"
        )}>
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
            isGuest ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          )}>
            {isGuest ? <Ghost className="h-3.5 w-3.5" /> : displayName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{displayName}</span>
          {isGuest && (
            <span className="hidden rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
              {locale === "pt-BR" ? "Visitante" : "Guest"}
            </span>
          )}
        </div>
        {isGuest ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogin}
            className="gap-1.5"
            aria-label={locale === "pt-BR" ? "Entrar" : "Sign in"}
            title={locale === "pt-BR" ? "Entrar" : "Sign in"}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">{locale === "pt-BR" ? "Entrar" : "Sign in"}</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLogoutConfirm(true)}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
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

function GridNumbers() {
  const [cells, setCells] = useState<GridCell[]>(() => generateGridCells());

  useEffect(() => {
    const interval = setInterval(() => {
      setCells((prev) =>
        prev.map((c) => {
          if (c.phase === "hidden") {
            if (Math.random() < 0.2) {
              return {
                ...c,
                digit: Math.floor(Math.random() * 9) + 1,
                phase: "in" as const,
              };
            }
            return c;
          }
          if (c.phase === "in") {
            if (c.opacity >= 0.12) return { ...c, phase: "hold" as const };
            return { ...c, opacity: c.opacity + 0.02 };
          }
          if (c.phase === "hold") {
            if (c.holdTime <= 0) return { ...c, phase: "out" as const };
            return { ...c, holdTime: c.holdTime - 1 };
          }
          if (c.phase === "out") {
            if (c.opacity <= 0) return { ...c, phase: "hidden" as const, opacity: 0 };
            return { ...c, opacity: c.opacity - 0.02 };
          }
          return c;
        })
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0">
      {cells.map((c) => (
        <span
          key={c.id}
          className="absolute flex items-center justify-center font-bold tabular-nums text-muted-foreground transition-opacity duration-100"
          style={{
            left: `${c.col * 32}px`,
            top: `${c.row * 32}px`,
            width: "32px",
            height: "32px",
            fontSize: "1rem",
            opacity: c.phase === "hidden" ? 0 : c.opacity,
          }}
        >
          {c.phase !== "hidden" ? c.digit : ""}
        </span>
      ))}
    </div>
  );
}

interface GridCell {
  id: number;
  digit: number;
  col: number;
  row: number;
  opacity: number;
  phase: "hidden" | "in" | "hold" | "out";
  holdTime: number;
}

function generateGridCells(): GridCell[] {
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    digit: Math.floor(Math.random() * 9) + 1,
    col: Math.floor(Math.random() * 60),
    row: Math.floor(Math.random() * 40),
    opacity: 0,
    phase: (["hidden", "hidden", "hidden", "in"] as const)[Math.floor(Math.random() * 4)],
    holdTime: Math.floor(Math.random() * 40) + 10,
  }));
}
