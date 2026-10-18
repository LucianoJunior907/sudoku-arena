"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { OnboardingDialog } from "@/components/layout/OnboardingDialog";
import { LevelUpToast } from "@/components/layout/LevelUpToast";
import { AchievementToast } from "@/components/layout/AchievementToast";
import { GuidedTour } from "@/components/layout/GuidedTour";
import { AuthProvider } from "@/lib/supabase/auth";

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const onboarding = useAppStore((s) => s.onboarding);
  const completeTour = useAppStore((s) => s.completeTour);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Show the guided tour after onboarding completes (but only once).
  // resetTour() in Settings flips tourSeen → false, which re-shows the tour.
  const showTour = hydrated && onboarding.completed && !onboarding.tourSeen;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        {hydrated && !onboarding.completed && <OnboardingDialog />}
        {showTour && <GuidedTour open={showTour} onComplete={completeTour} />}
        {hydrated && <LevelUpToast />}
        {hydrated && <AchievementToast />}
      </AuthProvider>
    </ThemeProvider>
  );
}
