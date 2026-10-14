"use client";

import { useAppStore } from "@/lib/store/app-store";
import { AppShell } from "@/components/layout/AppShell";
import { ViewTransition } from "@/components/layout/ViewTransition";
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
import { ArchiveView } from "@/components/views/ArchiveView";

function renderView(route: string) {
  switch (route) {
    case "lobby": return <LobbyView />;
    case "settings": return <SettingsView />;
    case "solo": return <SoloView />;
    case "guide": return <GuideView />;
    case "daily": return <DailyView />;
    case "duo": return <DuoView />;
    case "ranked": return <RankedView />;
    case "friends": return <FriendsView />;
    case "history": return <HistoryView />;
    case "leaderboard": return <LeaderboardView />;
    case "achievements": return <AchievementsView />;
    case "overview": return <OverviewView />;
    case "records": return <RecordsView />;
    case "archive": return <ArchiveView />;
    case "profile": return <ProfileView />;
    default: return <LobbyView />;
  }
}

export default function Home() {
  const route = useAppStore((s) => s.route);

  return (
    <AppShell>
      <ViewTransition routeKey={route}>
        {renderView(route)}
      </ViewTransition>
    </AppShell>
  );
}
