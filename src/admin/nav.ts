/**
 * Admin navigation.
 *
 * Deferred sections are listed, not hidden. Each one names the thing it is
 * actually blocked on, so the information architecture is visible without
 * pretending the feature exists. See the v1 design spec for why each is
 * deferred (short version: no table, no users, or both).
 */
import {
  LayoutDashboard,
  Store,
  ClipboardCheck,
  HardDrive,
  Flag,
  CalendarDays,
  Wine,
  ToggleLeft,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Present = section is a stub. Copy explains what it waits on. */
  blockedOn?: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/venues", label: "Venues", icon: Store },
  { to: "/admin/quality", label: "Data quality", icon: ClipboardCheck },
  { to: "/admin/storage", label: "Storage", icon: HardDrive },
];

export const ADMIN_NAV_DEFERRED: AdminNavItem[] = [
  {
    to: "/admin/moderation",
    label: "Moderation",
    icon: Flag,
    // The reports table has existed since 2026-08-05 (App Store Guideline 1.2)
    // and triage runs through the Supabase dashboard on the service role, which
    // is why there is still no screen here.
    blockedOn:
      "Reports exist but have no client-side triage policy — they are worked from the Supabase dashboard. No strangers can sign in yet either.",
  },
  {
    to: "/admin/events",
    label: "Bar events",
    icon: CalendarDays,
    blockedOn:
      "The events table is the analytics sink, not bar listings. Bar events live in src/data/activity/events.json.",
  },
  {
    to: "/admin/happy-hours",
    label: "Happy hours",
    icon: Wine,
    blockedOn:
      "Happy hours come from Google enrichment JSON, not rows. Needs a table before it can be edited here.",
  },
  {
    to: "/admin/flags",
    label: "Feature flags",
    icon: ToggleLeft,
    blockedOn: "No flags table. Nothing currently reads a flag.",
  },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    blockedOn:
      "Waiting on open sign-in. Google OAuth is still in testing mode, so there is effectively one user.",
  },
];
