"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, Mail, Lock, User, Chrome, LogOut, Loader2, AtSign, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { checkUsernameAvailable, setUsername } from "@/lib/supabase/matches";
import { cn } from "@/lib/utils";

export function AuthDialog() {
  const { locale } = useI18n();
  const { user, loading, signInWithUsernameOrEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
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
    if (value.length < 3) { setUsernameStatus("invalid"); return; }
    setUsernameStatus("checking");
    const result = await checkUsernameAvailable(value);
    if (result.available) setUsernameStatus("available");
    else if (result.error && result.error.includes("characters")) setUsernameStatus("invalid");
    else setUsernameStatus("taken");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      if (username.trim().length < 3) { toast.error(locale === "pt-BR" ? "Nome de usuário deve ter no mínimo 3 caracteres." : "Username must be at least 3 characters."); setBusy(false); return; }
      if (usernameStatus === "taken") { toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken."); setBusy(false); return; }
      if (password !== confirmPassword) { toast.error(locale === "pt-BR" ? "As senhas não coincidem." : "Passwords do not match."); setBusy(false); return; }
      const check = await checkUsernameAvailable(username);
      if (!check.available) { toast.error(locale === "pt-BR" ? "Nome de usuário já está em uso." : "Username already taken."); setUsernameStatus("taken"); setBusy(false); return; }
      const { error } = await signUpWithEmail(email, password, name || username, username);
      if (error) { toast.error(error.message); }
      else {
        setTimeout(async () => { const result = await setUsername(username); if (!result.success) toast.error(result.error || "Failed to set username"); }, 1500);
        toast.success(locale === "pt-BR" ? "Conta criada!" : "Account created!");
      }
    } else {
      if (!loginIdentifier.trim()) { toast.error(locale === "pt-BR" ? "Digite seu nome de usuário ou email." : "Enter your username or email."); setBusy(false); return; }
      const { error } = await signInWithUsernameOrEmail(loginIdentifier, password);
      if (error) toast.error(locale === "pt-BR" ? "Credenciais inválidas." : "Invalid credentials.");
      else toast.success(locale === "pt-BR" ? "Bem-vindo!" : "Welcome!");
    }
    setBusy(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) toast.error(error.message);
    setBusy(false);
  };

  if (user) return <LoggedInHeader displayName={user.displayName} onSignOut={signOut} locale={locale} />;
  if (loading) return <Button variant="ghost" size="sm" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background overflow-hidden">
      <div className="absolute inset-0 bg-arena-grid opacity-20" />
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-sm bg-primary/8 blur-3xl" />
      <div className="absolute -bottom-16 left-1/4 h-48 w-48 rounded-sm bg-[var(--warning)]/8 blur-3xl" />
      <GridNumbers />

      <div className="relative flex w-full max-w-sm flex-col px-4 py-6 sm:max-w-md sm:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
            <Grid3x3 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Sudoku Arena</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{locale === "pt-BR" ? "Treine. Compita. Evolua." : "Train. Compete. Evolve."}</p>
        </div>

        {/* Card */}
        <div className="rounded-md border border-border bg-card p-5 shadow-lg sm:p-6">
          <h2 className="mb-3 text-center text-base font-semibold">
            {mode === "signin" ? (locale === "pt-BR" ? "Entrar" : "Sign In") : (locale === "pt-BR" ? "Criar conta" : "Sign Up")}
          </h2>

          {/* Google */}
          <Button variant="outline" className="mb-3 w-full rounded-sm" onClick={handleGoogle} disabled={busy}>
            <Chrome className="mr-2 h-4 w-4" />
            {locale === "pt-BR" ? "Continuar com Google" : "Continue with Google"}
          </Button>

          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{locale === "pt-BR" ? "ou" : "or"}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {mode === "signin" ? (
              <div className="space-y-1">
                <Label htmlFor="loginId" className="text-xs">{locale === "pt-BR" ? "Nome de usuário ou email" : "Username or email"}</Label>
                <div className="relative">
                  <AtSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input id="loginId" value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} placeholder={locale === "pt-BR" ? "@usuario ou email" : "@username or email"} className="h-10 pl-8 text-sm rounded-sm" required />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs">{locale === "pt-BR" ? "Nome" : "Name"}</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={locale === "pt-BR" ? "Seu nome" : "Your name"} className="h-10 pl-8 text-sm rounded-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="username" className="text-xs">{locale === "pt-BR" ? "Nome de usuário" : "Username"}</Label>
                  <div className="relative">
                    <AtSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="username" value={username} onChange={(e) => { const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, ""); setUsernameState(val); if (val.length >= 3) checkUsername(val); else setUsernameStatus("invalid"); }} placeholder="username" maxLength={20} className={cn("h-10 pl-8 pr-8 text-sm rounded-sm", usernameStatus === "available" && "border-[var(--success)]", usernameStatus === "taken" && "border-[var(--destructive)]")} />
                    {usernameStatus === "checking" && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    {usernameStatus === "available" && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--success)]">{locale === "pt-BR" ? "OK" : "OK"}</span>}
                    {usernameStatus === "taken" && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[var(--destructive)]">{locale === "pt-BR" ? "Em uso" : "Taken"}</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="h-10 pl-8 text-sm rounded-sm" required />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs">{locale === "pt-BR" ? "Senha" : "Password"}</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-10 pl-8 pr-8 text-sm rounded-sm" required minLength={6} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-xs">{locale === "pt-BR" ? "Confirmar senha" : "Confirm password"}</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input id="confirmPassword" type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className={cn("h-10 pl-8 pr-8 text-sm rounded-sm", confirmPassword.length > 0 && password !== confirmPassword && "border-[var(--destructive)]", confirmPassword.length > 0 && password === confirmPassword && "border-[var(--success)]")} required minLength={6} />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                </div>
              </div>
            )}

            <Button type="submit" className="mt-3 h-10 w-full rounded-sm text-sm" disabled={busy || (mode === "signup" && (usernameStatus !== "available" || (confirmPassword.length > 0 && password !== confirmPassword)))}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? (locale === "pt-BR" ? "Entrar" : "Sign In") : (locale === "pt-BR" ? "Criar conta" : "Sign Up")}
            </Button>
          </form>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {mode === "signin" ? (locale === "pt-BR" ? "Não tem conta? " : "No account? ") : (locale === "pt-BR" ? "Já tem conta? " : "Already have an account? ")}
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setUsernameStatus("idle"); setPassword(""); setConfirmPassword(""); }} className="font-semibold text-primary hover:underline">{mode === "signin" ? (locale === "pt-BR" ? "Criar" : "Sign up") : (locale === "pt-BR" ? "Entrar" : "Sign in")}</button>
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
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 border border-border bg-card px-2 py-1 rounded-sm">
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 text-[10px] font-bold text-primary">{displayName.charAt(0).toUpperCase()}</div>
          <span className="hidden text-xs font-medium sm:inline">{displayName}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm" onClick={() => setShowLogoutConfirm(true)} aria-label="Sign out"><LogOut className="h-3.5 w-3.5" /></Button>
      </div>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowLogoutConfirm(false)}>
          <div className="relative w-full max-w-xs rounded-md border border-border bg-card p-5 shadow-2xl animate-float-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-sm bg-[var(--destructive)]/10"><LogOut className="h-6 w-6 text-[var(--destructive)]" /></div>
              <h3 className="text-base font-bold">{locale === "pt-BR" ? "Sair da conta?" : "Sign out?"}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{locale === "pt-BR" ? "Você precisará entrar novamente." : "You'll need to sign in again."}</p>
              <div className="mt-4 flex w-full gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-sm" onClick={() => setShowLogoutConfirm(false)}>{locale === "pt-BR" ? "Cancelar" : "Cancel"}</Button>
                <Button variant="destructive" size="sm" className="flex-1 gap-1 rounded-sm" onClick={() => { setShowLogoutConfirm(false); onSignOut(); }}><LogOut className="h-3.5 w-3.5" />{locale === "pt-BR" ? "Sair" : "Sign out"}</Button>
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
      setCells((prev) => prev.map((c) => {
        if (c.phase === "hidden") { if (Math.random() < 0.2) return { ...c, digit: Math.floor(Math.random() * 9) + 1, phase: "in" as const }; return c; }
        if (c.phase === "in") { if (c.opacity >= 0.1) return { ...c, phase: "hold" as const }; return { ...c, opacity: c.opacity + 0.02 }; }
        if (c.phase === "hold") { if (c.holdTime <= 0) return { ...c, phase: "out" as const }; return { ...c, holdTime: c.holdTime - 1 }; }
        if (c.phase === "out") { if (c.opacity <= 0) return { ...c, phase: "hidden" as const, opacity: 0 }; return { ...c, opacity: c.opacity - 0.02 }; }
        return c;
      }));
    }, 100);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {cells.map((c) => (
        <span key={c.id} className="absolute flex items-center justify-center font-bold tabular-nums text-muted-foreground transition-opacity duration-100" style={{ left: `${c.col * 32}px`, top: `${c.row * 32}px`, width: "32px", height: "32px", fontSize: "0.875rem", opacity: c.phase === "hidden" ? 0 : c.opacity }}>
          {c.phase !== "hidden" ? c.digit : ""}
        </span>
      ))}
    </div>
  );
}

interface GridCell { id: number; digit: number; col: number; row: number; opacity: number; phase: "hidden" | "in" | "hold" | "out"; holdTime: number; }
function generateGridCells(): GridCell[] {
  return Array.from({ length: 80 }, (_, i) => ({ id: i, digit: Math.floor(Math.random() * 9) + 1, col: Math.floor(Math.random() * 60), row: Math.floor(Math.random() * 40), opacity: 0, phase: (["hidden", "hidden", "hidden", "in"] as const)[Math.floor(Math.random() * 4)], holdTime: Math.floor(Math.random() * 40) + 10 }));
}
