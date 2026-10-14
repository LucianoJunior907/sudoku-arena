"use client";

import { useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useI18n } from "@/lib/i18n/context";
import { useAppStore } from "@/lib/store/app-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid3x3, Mail, Lock, User, Chrome, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AuthDialog() {
  const { t, locale } = useI18n();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut } = useAuth();
  const setRoute = useAppStore((s) => s.setRoute);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await signUpWithEmail(email, password, name || "Player");
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(locale === "pt-BR" ? "Conta criada! Verifique seu email." : "Account created! Check your email.");
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

  // If user is signed in, show a small profile card instead of the form
  if (user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm font-medium sm:inline">{user.displayName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Grid3x3 className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {mode === "signin"
              ? locale === "pt-BR" ? "Entrar" : "Sign In"
              : locale === "pt-BR" ? "Criar conta" : "Sign Up"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {locale === "pt-BR"
              ? "Entre para competir online, salvar seu progresso na nuvem e jogar com amigos."
              : "Sign in to compete online, sync your progress, and play with friends."}
          </DialogDescription>
        </DialogHeader>

        {/* Google OAuth */}
        <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
          <Chrome className="mr-2 h-4 w-4" />
          {locale === "pt-BR" ? "Continuar com Google" : "Continue with Google"}
        </Button>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{locale === "pt-BR" ? "ou" : "or"}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
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

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin"
              ? locale === "pt-BR" ? "Entrar" : "Sign In"
              : locale === "pt-BR" ? "Criar conta" : "Sign Up"}
          </Button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-xs text-muted-foreground">
          {mode === "signin"
            ? (locale === "pt-BR" ? "Não tem conta? " : "No account? ")
            : (locale === "pt-BR" ? "Já tem conta? " : "Already have an account? ")}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary hover:underline"
          >
            {mode === "signin"
              ? (locale === "pt-BR" ? "Criar" : "Sign up")
              : (locale === "pt-BR" ? "Entrar" : "Sign in")}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
