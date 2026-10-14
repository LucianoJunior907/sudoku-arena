"use client";

import { useAppStore } from "@/lib/store/app-store";
import { AppShell } from "@/components/layout/AppShell";
import { LobbyView } from "@/components/views/LobbyView";
import { SettingsView } from "@/components/views/SettingsView";
import { SoloView } from "@/components/views/SoloView";
import { ProfileView } from "@/components/views/ProfileView";
import { HistoryView } from "@/components/views/HistoryView";
import { GuideView } from "@/components/views/GuideView";
import { DailyView } from "@/components/views/DailyView";
import { DuoView } from "@/components/views/DuoView";
import { RankedView } from "@/components/views/RankedView";
import { FriendsView } from "@/components/views/FriendsView";
import { LeaderboardView } from "@/components/views/LeaderboardView";
import { AchievementsView } from "@/components/views/AchievementsView";
import { OverviewView } from "@/components/views/OverviewView";
import { RecordsView } from "@/components/views/RecordsView";

export default function Home() {
  const route = useAppStore((s) => s.route);

  return (
    <AppShell>
      {route === "lobby" && <LobbyView />}
      {route === "settings" && <SettingsView />}
      {route === "solo" && <SoloView />}
      {route === "guide" && <GuideView />}
      {route === "daily" && <DailyView />}
      {route === "duo" && <DuoView />}
      {route === "ranked" && <RankedView />}
      {route === "friends" && <FriendsView />}
      {route === "history" && <HistoryView />}
      {route === "leaderboard" && <LeaderboardView />}
      {route === "achievements" && <AchievementsView />}
      {route === "overview" && <OverviewView />}
      {route === "records" && <RecordsView />}
      {route === "profile" && <ProfileView />}
    </AppShell>
  );
}
