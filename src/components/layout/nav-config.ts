import {
  LayoutGrid,
  User,
  Users,
  Swords,
  GraduationCap,
  CalendarDays,
  UserCircle,
  UserPlus,
  History,
  BarChart3,
  Settings,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { RouteId } from "@/lib/store/app-store";
import type { TranslationKey } from "@/lib/i18n/translations";

export interface NavItem {
  id: RouteId;
  labelKey: TranslationKey;
  icon: LucideIcon;
  group: "play" | "learn" | "community" | "account";
  online?: boolean; // marks modes that will need backend
}

export const NAV_GROUPS: { id: "play" | "learn" | "community" | "account"; labelKey: TranslationKey }[] = [
  { id: "play", labelKey: "nav.group.play" },
  { id: "learn", labelKey: "nav.group.learn" },
  { id: "community", labelKey: "nav.group.community" },
  { id: "account", labelKey: "nav.group.account" },
];

export const NAV_ITEMS: NavItem[] = [
  { id: "lobby", labelKey: "nav.lobby", icon: LayoutGrid, group: "play" },
  { id: "solo", labelKey: "nav.solo", icon: User, group: "play" },
  { id: "duo", labelKey: "nav.duo", icon: Users, group: "play", online: true },
  { id: "ranked", labelKey: "nav.ranked", icon: Swords, group: "play", online: true },
  { id: "guide", labelKey: "nav.guide", icon: GraduationCap, group: "learn" },
  { id: "daily", labelKey: "nav.daily", icon: CalendarDays, group: "learn" },
  { id: "leaderboard", labelKey: "nav.leaderboard", icon: BarChart3, group: "community", online: true },
  { id: "friends", labelKey: "nav.friends", icon: UserPlus, group: "community", online: true },
  { id: "achievements", labelKey: "nav.achievements", icon: Award, group: "account" },
  { id: "history", labelKey: "nav.history", icon: History, group: "account" },
  { id: "profile", labelKey: "nav.profile", icon: UserCircle, group: "account" },
  { id: "settings", labelKey: "nav.settings", icon: Settings, group: "account" },
];
