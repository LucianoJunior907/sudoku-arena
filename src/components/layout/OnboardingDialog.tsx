"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { useAppStore } from "@/lib/store/app-store";
import { Grid3x3, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function OnboardingDialog() {
  const [selected, setSelected] = useState<Locale>("pt-BR");
  const complete = useAppStore((s) => s.completeOnboarding);

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Grid3x3 className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl">Sudoku Arena</DialogTitle>
          <DialogDescription className="text-center">
            {LOCALE_LABELS["pt-BR"] === "Português (Brasil)"
              ? "Escolha seu idioma para começar / Choose your language to start"
              : "Choose your language to start"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => setSelected(l)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                selected === l
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <span className="font-medium">{LOCALE_LABELS[l]}</span>
              {selected === l && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>

        <Button className="mt-4 w-full" size="lg" onClick={() => complete(selected)}>
          {selected === "pt-BR" ? "Continuar" : "Continue"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
