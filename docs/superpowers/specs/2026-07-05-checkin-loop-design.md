# ENDZ — The Check-In Loop

**Date:** 2026-07-05
**Status:** Approved
**Scope:** The core product loop: one-tap check-in/check-out with optional vibe, live venue activity on map pins and venue cards, privacy-safe public counts, and near-realtime updates across open clients. Plus one security fix to the existing schema discovered during design.

---

## Context

Everything else exists to serve this: *"Open app → see where it's active → check in → you become the live data for the next person."* The backend (Supabase, auth, profiles) and live venue data are done and user-verified. The `check_ins` table, `vibe_level` enum, `active_check_ins` view, and auto-expiry (`expires_at` default now()+3h) already exist in the schema. North-star metric: unprompted check-ins per active user per night.

## Product decisions (locked with user)

1. **No GPS gate.** One tap, trust-based. Validation-phase users are friends; gaming isn't a real risk yet, and a failed check-in at the bar is the worst possible first impression. Proximity checks can come later if abuse appears. (Explicitly rejected: passive "phones pinging" density — impossible for third-party phones, empty at our scale for own users, and against the project's own privacy principles. The consented check-in IS the ping.)
2. **One place at a time.** A new check-in automatically ends the user's previous active one.
3. **Anonymous public counts.** Everyone (including signed-out) sees *how many* are at each venue; *who* remains protected by the existing RLS visibility rules (default `friends`).
4. **Vibe is a skippable afterthought, not a gate.** Check-in completes on the first tap; a vibe row (😌 Chill / 📈 Building / 🔥 Packed) appears afterward for one optional tap.

## Design

### 1. Database changes (one SQL snippet, user runs in dashboard — delivered via clipboard)

```sql
-- (a) SECURITY FIX for the existing schema: Postgres views default to
-- security_invoker = off, so active_check_ins currently executes with its
-- owner's privileges and BYPASSES the check_ins RLS policies — any
-- authenticated user could read everyone's check-ins through the view.
alter view active_check_ins set (security_invoker = on);

-- (b) Allow users to set/change the vibe on their own check-in
-- (schema has insert/delete/select policies but no update).
create policy "users update own checkins"
  on check_ins for update
  using (auth.uid() = user_id);

-- (c) Privacy-safe public activity counts: aggregate-only, so it may
-- deliberately bypass RLS (security definer). Exposes counts + latest
-- vibe per venue — never identities.
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

Verification: anonymous REST call to `/rest/v1/rpc/venue_activity` returns `[]` (no check-ins yet) with HTTP 200; anonymous select on `/rest/v1/active_check_ins` returns `[]` (RLS now applies through the view).

### 2. Check-in data layer — `src/lib/checkins.ts` (new) + hooks

- `checkIn(venueId, vibe?)`: delete caller's active check-ins (`user_id = auth.uid() and expires_at > now()`), then insert `{ user_id, venue_id, vibe }` — visibility and expiry come from schema defaults (`friends`, +3h). Two sequential calls; acceptable at MVP scale.
- `checkOut()`: delete caller's active check-ins.
- `setVibe(checkInId, vibe)`: update own row (enabled by the new RLS policy).
- `useMyCheckIn()` (React Query): caller's active check-in (id, venue_id, vibe, expires_at) from `active_check_ins`; null when signed out.
- `useVenueActivity()` (React Query): `rpc('venue_activity')` → `Record<venueId, { count, vibe? }>`. `staleTime` ~15s, `refetchInterval` 60s, `refetchOnWindowFocus` — the polling safety net.
- **Realtime poke:** one shared Supabase Realtime *broadcast* channel (`venue-activity`, event `changed`, empty payload). After any successful check-in/out/vibe change, the client sends the poke; every subscribed client invalidates the activity query. Content-free by design — works for all viewers regardless of RLS, leaks nothing. Subscription lives in a small hook mounted once (e.g. in `AppLayout`).

### 3. Check-in UI

**Where:** the venue drawer on the map (`MapPage.tsx`) and the venue detail page (`VenueDetail.tsx`) — a full-width primary button in both.

**States (both surfaces identical):**
- Signed out → button reads "Sign in to check in" → navigates to `/profile`.
- Signed in, not checked in here → **"Check in"**. Tap → optimistic flip to checked-in state (write in background; on failure, revert + inline error).
- Just checked in → button area shows *"You're here"* + a one-tap vibe row (😌 Chill / 📈 Building / 🔥 Packed) that highlights the selection and stays until the drawer/page closes; plus a subtle **Check out** text button.
- Checked in at a *different* venue → button reads "Check in here instead" — tap moves the check-in (decision #2).
- Checked in here (returning) → checked-in state with current vibe selected + Check out.

**Copy tone:** per the approved bank — direct, casual. E.g. empty-activity venue card line stays as-is; active: "3 here now".

### 4. Live pins and cards

- `Map.tsx` gains an optional `activity?: Record<string, { count: number }>` prop. Marker rendering by tier: `0/undefined` = current dim pin; `1-2` = full-opacity pin + small count badge; `3-5` = scaled ~1.15× + badge; `6+` = scaled + glow (existing selected-pin glow style) + count badge. The existing selected-pin pulse remains reserved for selection.
- `MapPage.tsx` fetches `useVenueActivity()` and passes it to `Map`, the drawer, and list cards.
- `BarCard` and `VenueDetail` show "**N here now**" (+ latest vibe emoji when present) when `N > 0`; show nothing when 0 — no fabricated placeholders, consistent with the no-fake-data rule.

### 5. UX quality bar (binding, same as prior specs)

- Check-in is optimistic: the state flips the frame after the tap; no spinner on the golden path.
- Activity updates propagate to other open clients in ~2s via the broadcast poke (60s polling as fallback).
- Map render never blocks on the activity query (pins appear, then light up).
- No layout shift when a vibe row appears (reserve the space inside the drawer/CTA card).

## Out of scope (next plans)

- Who's-there list on venue cards (needs the friends layer to be meaningful)
- Per-check-in visibility picker and ghost-mode toggle UI (ships with friends; default `friends` visibility meanwhile)
- Friends/friendships UI entirely
- Streaks/badges/gamification (explicitly deferred in project docs)
- Proximity-based check-in prompts (native/Capacitor phase)
- Adding more venues or neighborhoods (beachhead locked; venue additions are trivial SQL whenever wanted)

## Verification approach

No test runner. `npx tsc --noEmit -p tsconfig.app.json` (bare tsc is a no-op here), `npm run build`, plus live browser checks: sign in → check in from the drawer → pin gains badge/tier and card shows "1 here now"; vibe tap persists; second browser (or incognito, signed out) sees the count within ~2s without refresh and cannot see who; check in at a second venue moves the check-in; check out clears it; anonymous REST probes confirm the RLS fix (view returns only permitted rows) and the counts function works signed-out.
