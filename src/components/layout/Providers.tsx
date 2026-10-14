"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { OnboardingDialog } from "@/components/layout/OnboardingDialog";
import { LevelUpToast } from "@/components/layout/LevelUpToast";

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const onboarding = useAppStore((s) => s.onboarding);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      {hydrated && !onboarding.completed && <OnboardingDialog />}
      {hydrated && <LevelUpToast />}
    </ThemeProvider>
  );
}
