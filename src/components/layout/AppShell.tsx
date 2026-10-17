"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useI18n } from "@/lib/i18n/context";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-config";
import { Grid3x3, Menu, X, Sun, Moon, Globe, Wifi, WifiOff, Volume2, VolumeX, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/supabase/auth";
import { AuthDialog } from "@/components/layout/AuthDialog";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/translations";
import { levelFromXp } from "@/lib/progression/progression";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Grid3x3 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Sudoku Arena</p>
        <p className="text-[10px] text-muted-foreground">Treine. Compita. Evolua.</p>
      </div>
    </div>
  );
}

function LocalModeBadge() {
  return null;
}

function LevelBadge() {
  const profile = useAppStore((s) => s.profile);
  const level = useAppStore((s) => s.level);
  const info = levelFromXp(profile.totalXp);
  const pct = Math.min(100, Math.round((info.intoLevel / info.neededForLevel) * 100));

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <div className="flex items-center gap-2 rounded-full border bg-card px-2.5 py-1">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {level}
        </div>
        <div className="w-20">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

function SoundToggle() {
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);
  const setSettings = useAppStore((s) => s.setSettings);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setSettings({ soundEnabled: !soundEnabled })}
      aria-label={soundEnabled ? "Mute sounds" : "Unmute sounds"}
      title={soundEnabled ? "Som ligado" : "Som desligado"}
    >
      <Volume2 className={`h-4 w-4 transition-all ${soundEnabled ? "scale-100" : "scale-0 absolute"} text-primary`} />
      <VolumeX className={`absolute h-4 w-4 transition-all ${soundEnabled ? "scale-0" : "scale-100"} text-muted-foreground`} />
    </Button>
  );
}

function LanguageMenu() {
  const { locale, setLocale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Language">
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l as Locale)}
            className={cn(locale === l && "bg-primary/10")}
          >
            {LOCALE_LABELS[l as Locale]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const { t } = useI18n();

  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group) => {
        const items = NAV_ITEMS.filter((i) => i.group === group.id);
        if (items.length === 0) return null;
        return (
          <div key={group.id}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t(group.labelKey)}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setRoute(item.id);
                        onNavigate?.();
                      }}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{t(item.labelKey)}</span>
                      {item.online && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-500"
                          title={t("common.comingSoon")}
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);

  // Keyboard shortcut to cycle views with Alt + ArrowLeft/ArrowRight
  useEffect(() => {
    const NAV_ORDER = NAV_ITEMS.map((n) => n.id);
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (!e.altKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const currentIdx = NAV_ORDER.indexOf(route);
      if (currentIdx < 0) return;
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIdx = (currentIdx + delta + NAV_ORDER.length) % NAV_ORDER.length;
      setRoute(NAV_ORDER[nextIdx]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [route, setRoute]);

  // If not authenticated (and not in guest mode), show ONLY the login screen
  const { user: authUser, loading: authLoading, isGuest } = useAuth();
  if (!authUser && !authLoading && !isGuest) {
    return <AuthDialog />;
  }

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background bg-arena-grid">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <div className="scrollbar-thin h-[calc(100vh-3.5rem)] overflow-y-auto p-3">
                <NavList onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold capitalize">{t(`nav.${route}` as never)}</h1>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <AuthDialog />
            <LocalModeBadge />
            <LevelBadge />
            <LanguageMenu />
            <SoundToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar/50 lg:block">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-thin p-3">
            <div className="mb-4 px-3 pt-2">
              <Logo />
            </div>
            <NavList />
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>

      {/* Sticky footer */}
      <footer className="mt-auto border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>Sudoku Arena · v1.0.0</p>
        </div>
      </footer>
    </div>
  );
}
