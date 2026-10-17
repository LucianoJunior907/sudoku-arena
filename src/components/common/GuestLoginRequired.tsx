"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ghost, LogIn } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/supabase/auth";

interface GuestLoginRequiredProps {
  /** Feature name, e.g. "Multiplayer Duo" or "Ranked" */
  featureName?: string;
  /** Optional description of what the user is missing */
  description?: string;
}

/**
 * Shown when a guest user tries to access an online-only feature.
 * Prompts them to sign in or create an account.
 */
export function GuestLoginRequired({ featureName, description }: GuestLoginRequiredProps) {
  const { t, locale } = useI18n();
  const { exitGuestMode } = useAuth();

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Ghost className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">
          {featureName ?? (locale === "pt-BR" ? "Recurso online" : "Online feature")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description ?? (locale === "pt-BR"
            ? "Este recurso precisa de uma conta para funcionar. Crie uma conta gratuita ou entre para competir online, salvar seu progresso e jogar com amigos."
            : "This feature needs an account to work. Create a free account or sign in to compete online, sync your progress, and play with friends.")}
        </p>
        <div className="mt-6 space-y-2">
          <Button className="w-full gap-2" size="lg" onClick={exitGuestMode}>
            <LogIn className="h-4 w-4" />
            {locale === "pt-BR" ? "Entrar ou criar conta" : "Sign in or create account"}
          </Button>
          <p className="text-[11px] text-muted-foreground/60">
            {locale === "pt-BR"
              ? "Você pode continuar explorando o modo solo e o guia como visitante."
              : "You can keep exploring solo mode and the guide as a guest."}
          </p>
        </div>
      </Card>
    </div>
  );
}
