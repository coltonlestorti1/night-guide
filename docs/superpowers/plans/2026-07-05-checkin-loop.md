# Check-In Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the core product loop — one-tap check-in/out with optional vibe, anonymous live venue-activity counts on pins and cards, and ~2-second cross-client updates.

**Architecture:** One SQL snippet (user-run) fixes a view-RLS bypass, adds an update policy, and creates a `venue_activity()` aggregate function. A new data layer (`src/lib/checkins.ts` + `src/hooks/useCheckIns.ts`) wraps check-in writes, activity reads, and a Supabase Realtime broadcast "poke" that invalidates the activity query everywhere. A shared `CheckInCard` component renders every auth/check-in state in the map drawer and venue detail page; `Map.tsx` gains an `activity` prop that drives pin tiers/badges; `BarCard` shows "N here now". A shared `VenueStatTiles` component replaces both remaining hardcoded dash-grids.

**Tech Stack:** Supabase (RPC, Realtime broadcast, RLS), TanStack Query (optimistic updates), React/Vite/TypeScript, shadcn/ui.

## Global Constraints

- Type-check command is `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc --noEmit` is a silent no-op in this repo — never trust it.
- No test runner exists; verification is tsc + `npm run build` + live browser checks (some user-assisted — checking in requires the signed-in owner).
- Check-in is optimistic: UI flips the frame after the tap, no spinner on the golden path; revert + inline error on failure.
- No fabricated data: activity UI renders only when count > 0; never placeholder dashes for absent data.
- Copy tone: direct, casual, human ("3 here now", "You're here"). Banned: corporate/AI phrases.
- Vibe values are exactly the schema enum: `chill` | `building` | `packed`, displayed as 😌 Chill / 📈 Building / 🔥 Packed.
- Check-ins rely on schema defaults for `visibility` ('friends') and `expires_at` (now()+3h) — the client never sets them in this plan.
- `.env.local` (gitignored) has real Supabase credentials; never commit or print it.
- npm cache workaround if EACCES: append `--cache /private/tmp/claude-501/-Users-colton-lestorti/522064c6-5c08-483f-aa54-dbdee21aecb1/scratchpad/npm-cache`.

---

### Task 1: Database changes (user-executed — controller coordinates, do NOT dispatch a code subagent)

Manual dashboard work only the project owner can run. Controller delivers SQL via clipboard, verifies via curl.

**Files:** none in this repo.

**Interfaces:**
- Produces: RPC `venue_activity()` returning rows of `{ venue_id: uuid, active_count: bigint, latest_vibe: vibe_level | null }`, executable by `anon` and `authenticated` (Task 2's `useVenueActivity` calls it); UPDATE policy on `check_ins` for own rows (Task 2's `setVibe` needs it); `active_check_ins` view respecting RLS (`security_invoker = on`).

- [ ] **Step 1: User runs this in the Supabase SQL editor**

```sql
-- (a) SECURITY FIX: the view currently executes with its owner's
-- privileges and bypasses check_ins RLS.
alter view active_check_ins set (security_invoker = on);

-- (b) Let users change the vibe on their own check-in.
create policy "users update own checkins"
  on check_ins for update
  using (auth.uid() = user_id);

-- (c) Privacy-safe public activity counts (aggregate-only, so
-- security definer is deliberate). Counts + latest vibe, never identities.
create or replace function venue_activity()
returns table (venue_id uuid, active_count bigint, latest_vibe vibe_level)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.venue_id,
    count(*)::bigint as active_count,
    (array_agg(c.vibe order by c.created_at desc) filter (where c.vibe is not null))[1] as latest_vibe
  from check_ins c
  where c.expires_at > now()
  group by c.venue_id
$$;

grant execute on function venue_activity() to anon, authenticated;
```

Expected: "Success. No rows returned".

- [ ] **Step 2: Controller verifies anonymously via curl**

```bash
KEY=$(grep VITE_SUPABASE_PUBLISHABLE_KEY /Users/colton.lestorti/Documents/night-guide/.env.local | cut -d= -f2)
curl -s -w "\nHTTP %{http_code}\n" -X POST "https://nqafzgryzjbtwpvzjagr.supabase.co/rest/v1/rpc/venue_activity" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'
curl -s -w "\nHTTP %{http_code}\n" "https://nqafzgryzjbtwpvzjagr.supabase.co/rest/v1/active_check_ins?select=*" -H "apikey: $KEY"
```

Expected: both HTTP 200 with `[]` (no active check-ins exist yet; the view now applies RLS for the anonymous caller).

- [ ] **Step 3: Record completion in the progress ledger** (no commit — no repo changes).

---

### Task 2: Check-in data layer

**Files:**
- Create: `src/lib/checkins.ts`
- Create: `src/hooks/useCheckIns.ts`
- Modify: `src/layouts/AppLayout.tsx` (mount the realtime subscription)

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase`; `useAuthStore` from `@/store/auth` (session); RPC `venue_activity()` (Task 1).
- Produces (Tasks 3-4 depend on exact names):
  - from `@/lib/checkins`: `type Vibe = "chill" | "building" | "packed"`; `type MyCheckIn = { id: string; venue_id: string; vibe: Vibe | null; expires_at: string }`; `checkIn(userId: string, venueId: string): Promise<void>`; `checkOut(userId: string): Promise<void>`; `setVibe(checkInId: string, vibe: Vibe): Promise<void>`; `subscribeActivity(onChanged: () => void): () => void`; `pokeActivity(): void`
  - from `@/hooks/useCheckIns`: `useMyCheckIn(): UseQueryResult<MyCheckIn | null>`; `useVenueActivity(): UseQueryResult<Record<string, { count: number; vibe: Vibe | null }>>`; query keys `["my-check-in", userId]` and `["venue-activity"]`

- [ ] **Step 1: Create `src/lib/checkins.ts`**

```ts
/**
 * Check-in writes and the venue-activity realtime poke.
 * Reads happen through src/hooks/useCheckIns.ts (React Query).
 *
 * The poke is a content-free broadcast: clients only learn "counts
 * changed, refetch" — no identities travel over the channel, so RLS
 * visibility rules are never bypassed.
 */
import { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Vibe = "chill" | "building" | "packed";

export type MyCheckIn = {
  id: string;
  venue_id: string;
  vibe: Vibe | null;
  expires_at: string;
};

/** One place at a time: end any active check-in, then create the new one. */
export async function checkIn(userId: string, venueId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error: endError } = await supabase
    .from("check_ins")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (endError) throw endError;
  const { error } = await supabase.from("check_ins").insert({ user_id: userId, venue_id: venueId });
  if (error) throw error;
}

export async function checkOut(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("check_ins")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
}

export async function setVibe(checkInId: string, vibe: Vibe): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("check_ins").update({ vibe }).eq("id", checkInId);
  if (error) throw error;
}

/**
 * Shared broadcast channel: subscribed once (AppLayout), reused for sends.
 * supabase-js requires a joined channel before send(), so the module keeps
 * the singleton created by subscribeActivity().
 */
let channel: RealtimeChannel | null = null;

export function subscribeActivity(onChanged: () => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  channel = supabase.channel("venue-activity");
  channel.on("broadcast", { event: "changed" }, onChanged).subscribe();
  return () => {
    if (channel) supabase.removeChannel(channel);
    channel = null;
  };
}

export function pokeActivity(): void {
  channel?.send({ type: "broadcast", event: "changed", payload: {} });
}
```

- [ ] **Step 2: Create `src/hooks/useCheckIns.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { MyCheckIn, Vibe } from "@/lib/checkins";

/** The caller's active check-in, or null. */
export function useMyCheckIn() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<MyCheckIn | null>({
    queryKey: ["my-check-in", userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase || !userId) return null;
      const { data, error } = await supabase
        .from("active_check_ins")
        .select("id, venue_id, vibe, expires_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as MyCheckIn) ?? null;
    },
  });
}

export type VenueActivity = Record<string, { count: number; vibe: Vibe | null }>;

/** Anonymous per-venue activity counts. Polls as the realtime fallback. */
export function useVenueActivity() {
  return useQuery<VenueActivity>({
    queryKey: ["venue-activity"],
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const supabase = getSupabase();
      if (!supabase) return {};
      const { data, error } = await supabase.rpc("venue_activity");
      if (error) throw error;
      const map: VenueActivity = {};
      for (const row of data as { venue_id: string; active_count: number; latest_vibe: Vibe | null }[]) {
        map[row.venue_id] = { count: Number(row.active_count), vibe: row.latest_vibe };
      }
      return map;
    },
  });
}
```

- [ ] **Step 3: Mount the realtime subscription in `src/layouts/AppLayout.tsx`**

Replace the file with:

```tsx
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import BottomTabs from "@/components/layout/BottomTabs";
import { useAuthStore } from "@/store/auth";
import { subscribeActivity } from "@/lib/checkins";

const AppLayout = () => {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // First sign-in with no profile row yet -> finish onboarding before anything else
  useEffect(() => {
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  // Live venue activity: any client's check-in/out pokes this channel and
  // every open map refetches counts within ~2s.
  useEffect(() => {
    return subscribeActivity(() => {
      queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
    });
  }, [queryClient]);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <main className="pb-[110px]" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
        <Outlet />
      </main>
      <BottomTabs />
    </div>
  );
};

export default AppLayout;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expected: no errors.
Run: `npm run build` — expected: success.
Run: `npm run dev -- --port 8099`, load `http://localhost:8099/`, browser console shows no errors (the subscription connects silently; websocket to `realtime/v1` visible in the network tab). Kill the server after.

- [ ] **Step 5: Commit**

```bash
git add src/lib/checkins.ts src/hooks/useCheckIns.ts src/layouts/AppLayout.tsx
git commit -m "feat: add check-in data layer with live activity poke"
```

---

### Task 3: CheckInCard + shared stat tiles, wired into drawer and detail page

**Files:**
- Create: `src/components/CheckInCard.tsx`
- Create: `src/components/VenueStatTiles.tsx`
- Modify: `src/pages/VenueDetail.tsx` (use shared tiles, add CheckInCard, drop local statTiles)
- Modify: `src/pages/MapPage.tsx:319-343` (drawer: shared tiles + CheckInCard)

**Interfaces:**
- Consumes: everything Task 2 produces; `useAuthStore`; shadcn `Button`; `cn`.
- Produces: `<CheckInCard venueId={string} />` and `<VenueStatTiles venue={Venue} compact? />` (Task 4 does not consume these; no later dependencies).

- [ ] **Step 1: Create `src/components/VenueStatTiles.tsx`**

```tsx
/**
 * Stat tiles render only for data the venue actually has — no permanent
 * "—" placeholders. Buzz/Cover slots resurface automatically once real
 * check-in data starts populating those fields.
 */
import { Venue } from "@/data/types";
import { Music2, Ticket, DollarSign, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

const tilesFor = (v: Venue) => {
  const tiles: { label: string; icon: React.ReactNode; value: string; accent?: boolean }[] = [];
  if (v.buzz_score != null) tiles.push({ label: "Buzz", icon: <Zap className="h-3 w-3" />, value: String(v.buzz_score), accent: true });
  if (v.music_type) tiles.push({ label: "Music", icon: <Music2 className="h-3 w-3" />, value: v.music_type });
  if (v.avg_price_level) tiles.push({ label: "Price", icon: <DollarSign className="h-3 w-3" />, value: "$".repeat(v.avg_price_level) });
  if (v.age_range_min && v.age_range_max) tiles.push({ label: "Ages", icon: <Users className="h-3 w-3" />, value: `${v.age_range_min}–${v.age_range_max}` });
  if (v.cover_charge) tiles.push({ label: "Cover", icon: <Ticket className="h-3 w-3" />, value: v.cover_charge });
  return tiles;
};

export default function VenueStatTiles({ venue, compact }: { venue: Venue; compact?: boolean }) {
  const tiles = tilesFor(venue);
  if (tiles.length === 0) return null;
  return (
    <div className={cn("grid gap-2", GRID_COLS[Math.min(tiles.length, 3)])}>
      {tiles.map((t) => (
        <div key={t.label} className={cn("rounded-xl bg-secondary/60 text-center", compact ? "p-2.5" : "p-3")}>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
            {t.icon} {t.label}
          </div>
          <div className={cn("text-xs font-medium mt-0.5 truncate", t.accent && "text-base font-bold text-primary")}>
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/CheckInCard.tsx`**

```tsx
/**
 * The core-loop control: every auth/check-in state for one venue.
 * Optimistic — the UI flips on tap; failures revert with an inline note.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { useMyCheckIn, useVenueActivity } from "@/hooks/useCheckIns";
import { checkIn, checkOut, setVibe, pokeActivity, Vibe } from "@/lib/checkins";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIBES: { value: Vibe; label: string }[] = [
  { value: "chill", label: "😌 Chill" },
  { value: "building", label: "📈 Building" },
  { value: "packed", label: "🔥 Packed" },
];

export default function CheckInCard({ venueId }: { venueId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: mine } = useMyCheckIn();
  const { data: activity } = useVenueActivity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hereCount = activity?.[venueId]?.count ?? 0;
  const hereVibe = activity?.[venueId]?.vibe ?? null;
  const checkedInHere = mine?.venue_id === venueId;
  const checkedInElsewhere = !!mine && !checkedInHere;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["my-check-in"] });
    queryClient.invalidateQueries({ queryKey: ["venue-activity"] });
  };

  const doCheckIn = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    // Optimistic: flip both caches immediately
    queryClient.setQueryData(["my-check-in", userId], {
      id: "optimistic",
      venue_id: venueId,
      vibe: null,
      expires_at: new Date(Date.now() + 3 * 3600_000).toISOString(),
    });
    try {
      await checkIn(userId, venueId);
      pokeActivity();
    } catch {
      setError("That didn't go through — try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  const doCheckOut = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    queryClient.setQueryData(["my-check-in", userId], null);
    try {
      await checkOut(userId);
      pokeActivity();
    } catch {
      setError("That didn't go through — try again.");
    } finally {
      refresh();
      setBusy(false);
    }
  };

  const doVibe = async (vibe: Vibe) => {
    if (!mine || mine.id === "optimistic" || busy) return;
    setError("");
    try {
      await setVibe(mine.id, vibe);
      pokeActivity();
    } catch {
      setError("Vibe didn't save — try again.");
    } finally {
      refresh();
    }
  };

  const untilLabel = mine?.expires_at
    ? new Date(mine.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className="mt-4 min-h-[88px]">
      {hereCount > 0 && (
        <p className="text-sm font-medium text-primary mb-2">
          {hereCount} here now{hereVibe ? ` · ${VIBES.find((v) => v.value === hereVibe)?.label}` : ""}
        </p>
      )}

      {status !== "signedIn" ? (
        <Button className="w-full h-12 rounded-xl" onClick={() => navigate("/profile")}>
          Sign in to check in
        </Button>
      ) : checkedInHere ? (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="font-semibold">You're here ✓ <span className="text-xs text-muted-foreground font-normal">until ~{untilLabel}</span></p>
            <button onClick={doCheckOut} className="text-xs text-muted-foreground underline hover:text-foreground">
              Check out
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {VIBES.map((v) => (
              <button
                key={v.value}
                onClick={() => doVibe(v.value)}
                className={cn(
                  "flex-1 text-xs px-2 py-2 rounded-xl border transition-colors",
                  mine?.vibe === v.value
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-secondary/60 border-border hover:bg-secondary"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Button className="w-full h-12 rounded-xl" disabled={busy} onClick={doCheckIn}>
          {checkedInElsewhere ? "Check in here instead" : "Check in"}
        </Button>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Rework `src/pages/VenueDetail.tsx`**

Remove the local `statTiles`/`GRID_COLS` definitions and the now-unused `Music2, Ticket, DollarSign, Users, Zap` imports and `Venue` import added with them; add imports:

```tsx
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";
```

Replace the stat-tiles block inside the body (`{statTiles(data).length > 0 && ( ... )}`) with:

```tsx
            <VenueStatTiles venue={data} />
            <CheckInCard venueId={data.id} />
```

(Both directly inside the `<div className="container pt-5 space-y-5 max-w-2xl">`, before the About block.)

- [ ] **Step 4: Rework the drawer in `src/pages/MapPage.tsx`**

Add imports:

```tsx
import VenueStatTiles from "@/components/VenueStatTiles";
import CheckInCard from "@/components/CheckInCard";
```

Replace the drawer's `{/* Stats grid */}` block (the `<div className="grid grid-cols-3 gap-2 mt-3">` containing the Music/Buzz/Cover tiles with `?? "—"`) with:

```tsx
              {/* Stats */}
              <div className="mt-3">
                <VenueStatTiles venue={selected} compact />
              </div>
              <CheckInCard venueId={selected.id} />
```

(The `{/* Actions */}` grid below stays unchanged.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json` — no errors. `npm run build` — success.
Live (`npm run dev -- --port 8099`, signed-out browser): venue drawer and detail page show real stat tiles (no dashes) and a "Sign in to check in" button; no "here now" line anywhere (no active check-ins). Kill the server.

- [ ] **Step 6: Commit**

```bash
git add src/components/CheckInCard.tsx src/components/VenueStatTiles.tsx src/pages/VenueDetail.tsx src/pages/MapPage.tsx
git commit -m "feat: add check-in card and shared stat tiles to drawer and detail"
```

---

### Task 4: Live pins and card badges

**Files:**
- Modify: `src/components/Map.tsx` (activity prop, tier rendering)
- Modify: `src/pages/MapPage.tsx` (fetch activity, pass to Map)
- Modify: `src/components/BarCard.tsx` ("N here now" badge)

**Interfaces:**
- Consumes: `useVenueActivity()` from `@/hooks/useCheckIns` (Task 2).
- Produces: `MapProps` gains `activity?: Record<string, number>` — final task, nothing consumes it later.

- [ ] **Step 1: Add the `activity` prop and tier rendering to `src/components/Map.tsx`**

In `MapProps`, add:

```tsx
  /** venueId -> active check-in count; drives pin tiers and badges */
  activity?: Record<string, number>;
```

In the component signature, destructure `activity`:

```tsx
const Map: React.FC<MapProps> = ({ venues, selectedId, onSelect, onViewportChanged, activity }) => {
```

Inside `addMarkers`, after `const isSelected = v.id === selectedId;`, add:

```tsx
      const count = activity?.[v.id] ?? 0;
      // Activity tiers: 0 = as-is, 1-2 = badge, 3-5 = badge + bigger, 6+ = badge + bigger + glow
      const scale = count >= 3 ? 1.15 : 1;
      const hot = count >= 6;
```

Change the `pin.style.boxShadow` assignment to include the hot tier:

```tsx
      pin.style.boxShadow = isSelected
        ? `0 0 18px ${color}, 0 4px 10px rgba(0,0,0,0.5)`
        : hot
        ? `0 0 14px ${color}, 0 3px 8px rgba(0,0,0,0.45)`
        : "0 3px 8px rgba(0,0,0,0.45)";
```

After `wrapper.appendChild(pin);`, add the scale + badge:

```tsx
      if (scale !== 1) pin.style.transform = `scale(${scale})`;

      if (count > 0) {
        const badge = document.createElement("div");
        badge.textContent = String(count);
        badge.style.position = "absolute";
        badge.style.top = "-4px";
        badge.style.right = "-4px";
        badge.style.minWidth = "16px";
        badge.style.height = "16px";
        badge.style.padding = "0 4px";
        badge.style.borderRadius = "8px";
        badge.style.background = "hsl(var(--primary))";
        badge.style.color = "hsl(var(--primary-foreground))";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "700";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.border = "1.5px solid rgba(255,255,255,0.85)";
        badge.style.zIndex = "2";
        wrapper.appendChild(badge);
      }
```

**Interaction note:** the existing hover handlers set `pin.style.transform = "scale(1.12)"` / `"scale(1)"` — update them so hover composes with the tier scale instead of clobbering it:

```tsx
      wrapper.addEventListener("mouseenter", () => { pin.style.transform = `scale(${scale * 1.12})`; });
      wrapper.addEventListener("mouseleave", () => { pin.style.transform = scale !== 1 ? `scale(${scale})` : "scale(1)"; });
```

Finally, `addMarkers`'s `useCallback` dependency array gains `activity`:

```tsx
  }, [venues, selectedId, onSelect, clearMarkers, activity]);
```

- [ ] **Step 2: Fetch and pass activity in `src/pages/MapPage.tsx`**

Add import:

```tsx
import { useVenueActivity } from "@/hooks/useCheckIns";
```

Inside `MapPage` (after the `useVenues` call), add:

```tsx
  const { data: activityData } = useVenueActivity();
  const activityCounts = activityData
    ? Object.fromEntries(Object.entries(activityData).map(([id, a]) => [id, a.count]))
    : undefined;
```

Pass it to the map:

```tsx
          <Map
            venues={venues}
            activity={activityCounts}
            selectedId={selected?.id}
            ...
```

- [ ] **Step 3: "N here now" on `src/components/BarCard.tsx`**

Add import:

```tsx
import { useVenueActivity } from "@/hooks/useCheckIns";
```

Inside the component (after `const saved = ...`):

```tsx
  const { data: activity } = useVenueActivity();
  const hereCount = activity?.[venue.id]?.count ?? 0;
```

In the meta row (`<div className="mt-1.5 text-xs text-muted-foreground ...">`), add as the FIRST child, before the music span:

```tsx
            {hereCount > 0 && (
              <span className="text-primary font-semibold">{hereCount} here now</span>
            )}
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.app.json` — no errors. `npm run build` — success.

- [ ] **Step 5: End-to-end live verification (user-assisted — the grand finale)**

With `npm run dev` on port 8080 and the user signed in:
1. User taps **Check in** at a venue in the drawer → button flips to "You're here ✓ · until ~[time]" the same frame; vibe row appears; no layout jump.
2. Pin for that venue gains a "1" badge; its BarCard shows "1 here now"; venue detail shows the same.
3. A second browser context (signed out, e.g. incognito) sees the "1" badge/count within ~2 seconds without reloading — and cannot see who checked in (`/rest/v1/active_check_ins` returns `[]` for it).
4. User taps a vibe → chip highlights; "1 here now · 🔥 Packed" (or chosen vibe) appears on cards.
5. User checks in at a different venue → badge moves (old venue 0, new venue 1).
6. User taps **Check out** → all counts clear everywhere.

- [ ] **Step 6: Commit**

```bash
git add src/components/Map.tsx src/pages/MapPage.tsx src/components/BarCard.tsx
git commit -m "feat: live activity tiers on map pins and here-now card badges"
```
