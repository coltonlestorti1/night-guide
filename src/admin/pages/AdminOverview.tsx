/**
 * Overview. Deliberately thin.
 *
 * Only surfaces that have real data behind them today. There is no DAU, WAU,
 * retention, or growth chart, because Google OAuth is still in testing mode —
 * strangers cannot sign in, so those would all be flat lines at zero, and a
 * flat line at zero teaches nothing while looking like a working dashboard.
 * When the launch gate clears, they become worth building.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import {
  fetchOverview,
  fetchEventCounts,
  fetchEventsDaily,
  fillDailyGaps,
  SetupIncompleteError,
} from "../data/overview";
import {
  PageHeader,
  StatCard,
  SectionHeader,
  EmptyState,
  ErrorNote,
} from "../components/AdminKit";
import EventsBarChart from "../components/EventsBarChart";

const WINDOW_DAYS = 14;

const AdminOverview = () => {
  const configured = Boolean(getSupabase());
  const since = useMemo(
    () => new Date(Date.now() - WINDOW_DAYS * 86_400_000),
    [],
  );

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchOverview,
    enabled: configured,
    retry: false,
  });

  const counts = useQuery({
    queryKey: ["admin-event-counts", since.toISOString()],
    queryFn: () => fetchEventCounts(since),
    enabled: configured && overview.isSuccess,
    retry: false,
  });

  const daily = useQuery({
    queryKey: ["admin-events-daily", since.toISOString()],
    queryFn: () => fetchEventsDaily(since),
    enabled: configured && overview.isSuccess,
    retry: false,
  });

  const series = useMemo(
    () => (daily.data ? fillDailyGaps(daily.data, since) : []),
    [daily.data, since],
  );

  const setupIncomplete = overview.error instanceof SetupIncompleteError;
  const o = overview.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Only what real data supports today. Growth and retention charts are deliberately absent until sign-in is open."
      />

      {!configured && (
        <ErrorNote>
          Supabase isn&apos;t configured in this environment. Set{" "}
          <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </ErrorNote>
      )}

      {setupIncomplete && (
        <ErrorNote>
          <span className="font-medium">Setup incomplete.</span> The admin RPCs
          aren&apos;t installed. Paste{" "}
          <code>scripts/2026-07-28-admin-ddl.sql</code> in the Supabase SQL
          editor, then reload this page.
        </ErrorNote>
      )}

      {overview.error && !setupIncomplete && (
        <ErrorNote>{(overview.error as Error).message}</ErrorNote>
      )}

      {overview.isLoading && configured && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading…
        </Card>
      )}

      {o && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Venues"
              value={o.venues_total}
              hint={`${o.venues_active} active · ${o.venues_total - o.venues_active} dormant`}
            />
            <StatCard
              label="Profiles"
              value={o.profiles_total}
              hint={
                o.profiles_total <= 5
                  ? "Sign-in is still OAuth-testing-mode only."
                  : undefined
              }
              tone={o.profiles_total <= 5 ? "muted" : "default"}
            />
            <StatCard
              label="Check-ins"
              value={o.check_ins_total}
              hint={`${o.check_ins_active} live right now`}
            />
            <StatCard
              label="Waitlist"
              value={o.waitlist_total}
              hint="Signups from /join and the QR code."
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatCard label="Plans made" value={o.plans_total} />
            <StatCard
              label="Events logged"
              value={o.events_total}
              hint={`${o.events_last_7d} in the last 7 days`}
            />
            <StatCard
              label="Last event"
              value={
                o.last_event_at
                  ? new Date(o.last_event_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"
              }
              hint={
                o.first_event_at
                  ? `Logging since ${new Date(o.first_event_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                  : "Nothing logged yet."
              }
            />
          </div>

          <SectionHeader
            title={`Events per day · last ${WINDOW_DAYS} days`}
            description="Every instrumented action, from src/lib/analytics.ts. Zero-days are real zeros, not gaps."
          />
          <Card className="mb-6 p-4">
            {daily.isLoading ? (
              <div className="h-40 animate-pulse rounded bg-muted" />
            ) : series.some((d) => d.total > 0) ? (
              <EventsBarChart data={series} />
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No events in the last {WINDOW_DAYS} days.{" "}
                {o.events_total > 0
                  ? "There are older ones — the app just hasn't been used recently."
                  : "Nothing has been logged yet."}
              </div>
            )}
          </Card>

          <SectionHeader
            title={`Top actions · last ${WINDOW_DAYS} days`}
            description="What people actually do, ranked."
          />
          {counts.isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading…
            </Card>
          ) : (counts.data ?? []).length === 0 ? (
            <EmptyState title="No actions recorded in this window" icon={Activity}>
              Analytics land in the <code>events</code> table via{" "}
              <code>logEvent()</code>. An empty window here is expected while
              sign-in is closed — it isn&apos;t a broken pipeline.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-border">
              {(counts.data ?? []).map((c) => {
                const top = Number(counts.data![0].total) || 1;
                return (
                  <div
                    key={c.event_name}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <code className="min-w-0 flex-1 truncate text-sm">
                      {c.event_name}
                    </code>
                    <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(Number(c.total) / top) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-medium tabular-nums">
                      {c.total}
                    </span>
                  </div>
                );
              })}
            </Card>
          )}
        </>
      )}
    </>
  );
};

export default AdminOverview;
