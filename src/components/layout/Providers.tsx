"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { OnboardingDialog } from "@/components/layout/OnboardingDialog";
import { LevelUpToast } from "@/components/layout/LevelUpToast";
import { AchievementToast } from "@/components/layout/AchievementToast";
import { GuidedTour } from "@/components/layout/GuidedTour";
import { AuthProvider, useAuth } from "@/lib/supabase/auth";

/**
 * Renders the tour and toasts only when the user is authenticated.
 * This prevents the GuidedTour's full-screen overlay (z-50, fixed
 * inset-0, pointer-events: auto) from blocking clicks on the login
 * form (which lives in AuthDialog at z-200). Before this guard, the
 * tour appeared behind the login screen and its overlay captured all
 * clicks — inputs/buttons were unclickable until the user entered
 * guest mode (which dismissed the login and let the tour show).
 */
function AuthedOverlays() {
  const hydrated = useAppStore((s) => s.hydrated);
  const onboarding = useAppStore((s) => s.onboarding);
  const completeTour = useAppStore((s) => s.completeTour);
  const { user, isGuest } = useAuth();

  const isAuthenticated = Boolean(user) || isGuest;
  const showTour = hydrated && onboarding.completed && !onboarding.tourSeen && isAuthenticated;

  return (
    <>
      {showTour && <GuidedTour open={showTour} onComplete={completeTour} />}
      {hydrated && isAuthenticated && <LevelUpToast />}
      {hydrated && isAuthenticated && <AchievementToast />}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const onboarding = useAppStore((s) => s.onboarding);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        {children}
        {hydrated && !onboarding.completed && <OnboardingDialog />}
        <AuthedOverlays />
      </AuthProvider>
    </ThemeProvider>
  );
}
