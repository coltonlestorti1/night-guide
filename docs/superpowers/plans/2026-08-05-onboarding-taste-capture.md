# Onboarding Taste Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two onboarding screens between username and the location primer that capture birthday + gender, favorite ENDZ venues (written as real saves), and bars ENDZ does not yet carry (captured with a Google place ID).

**Architecture:** Pure logic lives in small tested modules (`src/lib/birthday.ts`, `src/lib/venueRequests.ts`); data access follows the thin-async-function pattern of `src/lib/saves.ts`; screens follow `src/pages/PickUsername.tsx`. Birthday and gender live in a self-only `profile_private` table, never in `profiles`. Google search is proxied by an edge function so the Places key stays server-side.

**Tech Stack:** React 18 + TypeScript, Vite, react-router-dom, Zustand (`src/store/auth.ts`), TanStack Query, Supabase JS, Deno edge functions, Vitest, Tailwind + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-08-05-onboarding-taste-capture-design.md`

## Global Constraints

- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc` is a silent no-op.
- DDL is never applied by an agent. Write the `.sql` file; Colton pastes it in the Supabase SQL editor. Record applied DDL in `~/Documents/endz/endz-schema.sql`.
- The Google Places API key must never reach the client bundle. It exists only in `.env.local` and edge-function secrets.
- Inputs must use `text-base md:text-sm`. iOS Safari force-zooms any focused field under 16px and the zoom persists after blur.
- Minimum age is **13** (COPPA data-protection floor). This is NOT an alcohol gate — no 18 or 21 restriction exists.
- Gender values are exactly `woman | man | nonbinary | prefer_not_to_say`. No self-describe free text.
- Favorite picks have **no minimum and no maximum**. A forced minimum poisons the signal.
- Nothing on these screens may trap a user mid-signup. Only the birthday write may block; everything else degrades and continues.
- Run `npm test` before any merge. Baseline is 215 passing.

---

### Task 1: DDL script for the three schema changes

**Files:**
- Create: `scripts/2026-08-05-onboarding-taste-ddl.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `profile_private (id uuid pk, birthday date not null, gender text)`, `venue_requests (id, user_id, google_place_id, name, address, created_at, fulfilled_venue_id)`, and column `venues.google_place_id text unique`.

- [ ] **Step 1: Write the DDL file**

```sql
-- ============================================================================
-- 2026-08-05 — onboarding taste capture
-- Additive and idempotent. Safe to run more than once.
-- Spec: docs/superpowers/specs/2026-08-05-onboarding-taste-capture-design.md
-- ============================================================================

-- ---------- 1. private profile fields ----------
-- NOT in `profiles`: that table's SELECT policy makes every column readable by
-- any signed-in user, and RLS is row-level so two columns cannot be exempted.
-- A sibling table with its own policy is the standard shape.
create table if not exists profile_private (
  id       uuid primary key references profiles (id) on delete cascade,
  birthday date not null,
  gender   text check (gender in ('woman','man','nonbinary','prefer_not_to_say'))
);

alter table profile_private enable row level security;

drop policy if exists "own private profile readable" on profile_private;
create policy "own private profile readable"
  on profile_private for select to authenticated using (auth.uid() = id);

drop policy if exists "own private profile insert" on profile_private;
create policy "own private profile insert"
  on profile_private for insert to authenticated with check (auth.uid() = id);

drop policy if exists "own private profile update" on profile_private;
create policy "own private profile update"
  on profile_private for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- 2. exact match key for venues ----------
-- Makes a future "we added your bar" an exact join instead of fuzzy strings.
alter table venues add column if not exists google_place_id text;
create unique index if not exists venues_google_place_id_idx
  on venues (google_place_id) where google_place_id is not null;

-- ---------- 3. requested venues ----------
create table if not exists venue_requests (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  google_place_id    text not null,
  name               text not null,
  address            text,
  created_at         timestamptz not null default now(),
  fulfilled_venue_id uuid references venues (id),
  unique (user_id, google_place_id)
);

create index if not exists venue_requests_place_idx on venue_requests (google_place_id);

alter table venue_requests enable row level security;

drop policy if exists "users read own requests" on venue_requests;
create policy "users read own requests"
  on venue_requests for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "users create own requests" on venue_requests;
create policy "users create own requests"
  on venue_requests for insert to authenticated
  with check (auth.uid() = user_id);

-- No client UPDATE or DELETE. fulfilled_venue_id is set by an operator.

-- ---------- verification ----------
select tablename, policyname, cmd, roles::text
  from pg_policies
 where schemaname = 'public' and tablename in ('profile_private','venue_requests')
 order by tablename, cmd;

-- Expect true, true.
select
  (select count(*) from information_schema.columns
    where table_name = 'venues' and column_name = 'google_place_id') = 1 as has_place_id,
  (select relrowsecurity from pg_class where relname = 'profile_private') as pp_rls;
```

- [ ] **Step 2: Verify it is syntactically parseable**

There is no local Postgres. Confirm balanced statements by eye and check the file has no unterminated string:

Run: `grep -c ";" scripts/2026-08-05-onboarding-taste-ddl.sql`
Expected: a count of at least 15.

- [ ] **Step 3: Commit**

```bash
git add scripts/2026-08-05-onboarding-taste-ddl.sql
git commit -m "feat(onboarding): DDL for profile_private, venue_requests, venues.google_place_id"
```

- [ ] **Step 4: STOP and hand the DDL to Colton**

Copy it to the clipboard and stop. Nothing after Task 4 works until this is applied.

```bash
pbcopy < scripts/2026-08-05-onboarding-taste-ddl.sql
```

Tell Colton: paste in the Supabase SQL editor, run the whole file, send back the two verification queries. Then record the DDL in `~/Documents/endz/endz-schema.sql`.

---

### Task 2: Birthday logic (pure, TDD)

**Files:**
- Create: `src/lib/birthday.ts`
- Create: `src/lib/birthday.test.ts`

**Interfaces:**
- Consumes: `AgeBand` from `src/lib/agePref.ts`.
- Produces: `MIN_AGE: 13`, `ageFromBirthday(iso: string, now?: Date): number | null`, `isUnderMinimum(iso: string, now?: Date): boolean`, `bandFromBirthday(iso: string, now?: Date): AgeBand | null`.

Note for the implementer: `ageAffinity()` in `src/lib/agePref.ts` already takes a raw age number. Feed it `ageFromBirthday()` directly. The bands start at `21-23` and there is deliberately no band below 21, so `bandFromBirthday` returns `null` for under-21s — it exists only for back-compat with the stored localStorage band.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ageFromBirthday, isUnderMinimum, bandFromBirthday, MIN_AGE } from "./birthday";

const NOW = new Date("2026-08-05T12:00:00Z");

describe("ageFromBirthday", () => {
  it("computes whole years", () => {
    expect(ageFromBirthday("2000-08-05", NOW)).toBe(26);
    expect(ageFromBirthday("2000-08-04", NOW)).toBe(26);
  });

  it("does not count a birthday that has not happened yet this year", () => {
    expect(ageFromBirthday("2000-08-06", NOW)).toBe(25);
    expect(ageFromBirthday("2000-12-31", NOW)).toBe(25);
  });

  it("handles a 29 Feb birthday in a non-leap year", () => {
    expect(ageFromBirthday("2004-02-29", NOW)).toBe(22);
  });

  it("returns null for an unparseable or future date", () => {
    expect(ageFromBirthday("not-a-date", NOW)).toBeNull();
    expect(ageFromBirthday("2030-01-01", NOW)).toBeNull();
  });
});

describe("isUnderMinimum", () => {
  it("is false on the 13th birthday and true the day before", () => {
    expect(MIN_AGE).toBe(13);
    expect(isUnderMinimum("2013-08-05", NOW)).toBe(false);
    expect(isUnderMinimum("2013-08-06", NOW)).toBe(true);
  });

  it("treats an unparseable date as under minimum, failing closed", () => {
    expect(isUnderMinimum("", NOW)).toBe(true);
  });

  it("does not gate on drinking age", () => {
    expect(isUnderMinimum("2008-01-01", NOW)).toBe(false); // 18
    expect(isUnderMinimum("2006-01-01", NOW)).toBe(false); // 20
  });
});

describe("bandFromBirthday", () => {
  it("maps ages onto the existing bands", () => {
    expect(bandFromBirthday("2004-01-01", NOW)).toBe("21-23");
    expect(bandFromBirthday("2001-01-01", NOW)).toBe("24-26");
    expect(bandFromBirthday("1997-01-01", NOW)).toBe("27-30");
    expect(bandFromBirthday("1980-01-01", NOW)).toBe("31+");
  });

  it("returns null under 21 — no band exists down there", () => {
    expect(bandFromBirthday("2008-01-01", NOW)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/birthday.test.ts`
Expected: FAIL — cannot resolve `./birthday`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Birthday maths for onboarding. Kept separate from agePref.ts because that
 * module is the on-device band store; this is the derivation from a real date.
 *
 * MIN_AGE is a COPPA data-protection floor for collecting a birthday and
 * gender, NOT an alcohol gate. ENDZ shows public information about bars and
 * deliberately does not restrict by drinking age (Colton, 2026-08-05).
 */
import type { AgeBand } from "@/lib/agePref";

export const MIN_AGE = 13;

/** Whole years old, or null if the date is unparseable or in the future. */
export function ageFromBirthday(iso: string, now: Date = new Date()): number | null {
  const b = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (b.getTime() > ref.getTime()) return null;
  let age = ref.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** Fails closed: anything we cannot read counts as under the minimum. */
export function isUnderMinimum(iso: string, now: Date = new Date()): boolean {
  const age = ageFromBirthday(iso, now);
  return age === null || age < MIN_AGE;
}

/**
 * Back-compat with the localStorage band. The bands start at 21, so under-21s
 * have no band — callers should prefer ageFromBirthday() with ageAffinity().
 */
export function bandFromBirthday(iso: string, now: Date = new Date()): AgeBand | null {
  const age = ageFromBirthday(iso, now);
  if (age === null || age < 21) return null;
  if (age <= 23) return "21-23";
  if (age <= 26) return "24-26";
  if (age <= 30) return "27-30";
  return "31+";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/birthday.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json
git add src/lib/birthday.ts src/lib/birthday.test.ts
git commit -m "feat(onboarding): birthday age derivation with a 13+ data floor"
```

---

### Task 3: profile_private data layer

**Files:**
- Create: `src/lib/profilePrivate.ts`

**Interfaces:**
- Consumes: `getSupabase` from `src/lib/supabase.ts`.
- Produces: `type Gender = "woman" | "man" | "nonbinary" | "prefer_not_to_say"`, `GENDERS: readonly Gender[]`, `savePrivateProfile(userId: string, birthday: string, gender: Gender | null): Promise<void>`, `getPrivateProfile(userId: string): Promise<{ birthday: string; gender: Gender | null } | null>`.

No unit test: this file is a thin Supabase wrapper with no branching logic worth pinning, matching how `src/lib/saves.ts` is structured. The logic that needed testing is in Task 2.

- [ ] **Step 1: Write the implementation**

```ts
/**
 * Birthday and gender. Deliberately NOT in `profiles` — that table's SELECT
 * policy exposes every column to any signed-in user, and RLS is row-level so
 * two columns cannot be exempted. profile_private carries its own self-only
 * policies (scripts/2026-08-05-onboarding-taste-ddl.sql).
 *
 * Nothing renders these fields. They exist for personalization only, and the
 * derived age — never the raw date — is what scoring consumes.
 */
import { getSupabase } from "@/lib/supabase";

export type Gender = "woman" | "man" | "nonbinary" | "prefer_not_to_say";

export const GENDERS: readonly Gender[] = [
  "woman",
  "man",
  "nonbinary",
  "prefer_not_to_say",
] as const;

export const GENDER_LABELS: Record<Gender, string> = {
  woman: "Woman",
  man: "Man",
  nonbinary: "Non-binary",
  prefer_not_to_say: "Prefer not to say",
};

export async function savePrivateProfile(
  userId: string,
  birthday: string,
  gender: Gender | null
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase
    .from("profile_private")
    .upsert({ id: userId, birthday, gender }, { onConflict: "id" });
  if (error) throw error;
}

export async function getPrivateProfile(
  userId: string
): Promise<{ birthday: string; gender: Gender | null } | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profile_private")
    .select("birthday, gender")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { birthday: string; gender: Gender | null } | null) ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/profilePrivate.ts
git commit -m "feat(onboarding): profile_private data layer for birthday and gender"
```

---

### Task 4: Screen A — /welcome/about

**Files:**
- Create: `src/pages/AboutYou.tsx`
- Modify: `src/App.tsx` (add route beside `welcome/location`)
- Modify: `src/pages/PickUsername.tsx:86` (redirect target)

**Interfaces:**
- Consumes: `savePrivateProfile`, `GENDERS`, `GENDER_LABELS`, `Gender` (Task 3); `isUnderMinimum`, `MIN_AGE` (Task 2); `useAuthStore`.
- Produces: route `/welcome/about`. Navigates to `/welcome/spots` on success.

- [ ] **Step 1: Write the screen**

```tsx
/**
 * Onboarding step 2 — birthday and gender.
 *
 * Birthday is required; it is the field this step exists for. Gender is
 * optional and skippable. The 13+ check is a COPPA data floor, not a drinking
 * gate — ENDZ deliberately does not restrict by drinking age.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isUnderMinimum, MIN_AGE } from "@/lib/birthday";
import { savePrivateProfile, GENDERS, GENDER_LABELS, type Gender } from "@/lib/profilePrivate";
import { logEvent } from "@/lib/analytics";

const AboutYou = () => {
  const navigate = useNavigate();
  const { status, session } = useAuthStore();
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  const tooYoung = birthday !== "" && isUnderMinimum(birthday);
  const canSubmit = birthday !== "" && !tooYoung && !submitting;

  const submit = async () => {
    if (!session || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await savePrivateProfile(session.user.id, birthday, gender);
      logEvent("onboarding_about_completed", { has_gender: gender !== null });
      navigate("/welcome/spots", { replace: true });
    } catch {
      setSubmitting(false);
      setError("Couldn't save that. Give it another shot.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 pt-24">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">A bit about you</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          So we can point you at the right rooms.
        </p>

        <label htmlFor="birthday" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Birthday
        </label>
        <Input
          id="birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="h-11 mt-1.5 text-base md:text-sm"
        />
        <p className={cn("text-xs mt-2 min-h-4", tooYoung ? "text-red-500" : "text-muted-foreground")}>
          {tooYoung ? `You need to be at least ${MIN_AGE} to use ENDZ.` : error}
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Gender <span className="normal-case font-normal">(optional)</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? null : g)}
                aria-pressed={gender === g}
                className={cn(
                  "h-11 rounded-xl border text-sm transition-colors",
                  gender === g
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {GENDER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={submit} disabled={!canSubmit} className="w-full h-11 rounded-xl mt-5">
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
};

export default AboutYou;
```

- [ ] **Step 2: Add the route**

In `src/App.tsx`, import beside the other page imports and add the route immediately before `welcome/location`:

```tsx
import AboutYou from "@/pages/AboutYou";
```

```tsx
<Route path="welcome/about" element={<AboutYou />} />
```

- [ ] **Step 3: Redirect the username screen to it**

In `src/pages/PickUsername.tsx`, change line 86 from `navigate("/welcome/location", { replace: true });` to:

```tsx
navigate("/welcome/about", { replace: true });
```

Update the comment above it: new users now get About → Spots → location, then the map.

- [ ] **Step 4: Typecheck, test, and verify in the browser**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: exit 0, 228 tests pass.

Run `npm run dev` and load `http://localhost:8080/welcome/about` while signed in. Confirm: a birthday of today's date minus 12 years shows the minimum-age message and disables Continue; a valid birthday enables it; gender chips toggle off when tapped twice.

- [ ] **Step 5: Commit**

```bash
git add src/pages/AboutYou.tsx src/App.tsx src/pages/PickUsername.tsx
git commit -m "feat(onboarding): About you step — birthday and optional gender"
```

---

### Task 5: venue_requests data layer (pure normalization, TDD)

**Files:**
- Create: `src/lib/venueRequests.ts`
- Create: `src/lib/venueRequests.test.ts`

**Interfaces:**
- Consumes: `getSupabase`.
- Produces: `type PlaceHit = { placeId: string; name: string; address?: string }`, `dedupeHits(hits: PlaceHit[], alreadyPicked: string[]): PlaceHit[]`, `addVenueRequests(userId: string, hits: PlaceHit[]): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { dedupeHits, type PlaceHit } from "./venueRequests";

const hit = (placeId: string, name = "Bar"): PlaceHit => ({ placeId, name });

describe("dedupeHits", () => {
  it("drops repeats within the list, keeping the first", () => {
    const out = dedupeHits([hit("a", "First"), hit("b"), hit("a", "Second")], []);
    expect(out.map((h) => h.placeId)).toEqual(["a", "b"]);
    expect(out[0].name).toBe("First");
  });

  it("drops anything already in the ENDZ venue set", () => {
    expect(dedupeHits([hit("a"), hit("b")], ["b"]).map((h) => h.placeId)).toEqual(["a"]);
  });

  it("drops entries with no place id", () => {
    expect(dedupeHits([{ placeId: "", name: "x" }, hit("a")], [])).toHaveLength(1);
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeHits([], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/venueRequests.test.ts`
Expected: FAIL — cannot resolve `./venueRequests`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Bars a user wants that ENDZ does not carry yet.
 *
 * A Google place id is stored alongside the name so a future "we added your
 * bar" is an exact join against venues.google_place_id, not fuzzy string
 * matching forever. Insert-only from the client; fulfilled_venue_id is set by
 * an operator.
 */
import { getSupabase } from "@/lib/supabase";

export type PlaceHit = { placeId: string; name: string; address?: string };

/** First occurrence wins. Anything already an ENDZ venue is not a request. */
export function dedupeHits(hits: PlaceHit[], alreadyPicked: string[]): PlaceHit[] {
  const seen = new Set(alreadyPicked);
  const out: PlaceHit[] = [];
  for (const h of hits) {
    if (!h.placeId || seen.has(h.placeId)) continue;
    seen.add(h.placeId);
    out.push(h);
  }
  return out;
}

/**
 * Upsert, not insert: the unique (user_id, google_place_id) makes a repeat
 * submission a 23505 otherwise, and a duplicate request is a no-op.
 */
export async function addVenueRequests(userId: string, hits: PlaceHit[]): Promise<void> {
  if (hits.length === 0) return;
  const supabase = getSupabase();
  if (!supabase) throw new Error("Backend not configured");
  const { error } = await supabase.from("venue_requests").upsert(
    hits.map((h) => ({
      user_id: userId,
      google_place_id: h.placeId,
      name: h.name,
      address: h.address ?? null,
    })),
    { onConflict: "user_id,google_place_id" }
  );
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/venueRequests.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit -p tsconfig.app.json
git add src/lib/venueRequests.ts src/lib/venueRequests.test.ts
git commit -m "feat(onboarding): venue_requests data layer with place-id dedup"
```

---

### Task 6: places-search edge function

**Files:**
- Create: `supabase/functions/places-search/index.ts`
- Create: `docs/plans/2026-08-05-places-search-deploy-runbook.md`

**Interfaces:**
- Consumes: env `GOOGLE_PLACES_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- Produces: `POST /places-search` with body `{ query: string }` returning `{ results: PlaceHit[] }` matching Task 5's `PlaceHit`.

Unlike `plan-guest`, this function is deployed **with** JWT verification. Without it, it is an open proxy pointed at Colton's Google quota.

- [ ] **Step 1: Write the function**

```ts
/**
 * places-search — autocomplete proxy for the onboarding "somewhere we're
 * missing?" field (§11 onboarding taste capture).
 *
 * Exists solely so GOOGLE_PLACES_API_KEY stays server-side. The key is absent
 * from the production bundle (verified in the 2026-08-05 pre-launch check) and
 * must remain so.
 *
 * Deployed WITH jwt verification — unlike plan-guest, there is no guest case
 * here, and an unauthenticated proxy is a free ride on Colton's Places quota.
 * Returns placeId/name/address only; nothing else is needed or stored.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_QUERY = 120;
const MAX_RESULTS = 6;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) return json(500, { error: "not configured" });

  let query = "";
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query.trim() : "";
  } catch {
    return json(400, { error: "bad request" });
  }
  if (query.length < 2) return json(200, { results: [] });
  if (query.length > MAX_QUERY) return json(400, { error: "query too long" });

  // Bias to the East Village beachhead so "Mona's" resolves locally.
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: MAX_RESULTS,
      locationBias: {
        circle: {
          center: { latitude: 40.7265, longitude: -73.9815 },
          radius: 2000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("places-search upstream", res.status, await res.text());
    return json(502, { error: "search unavailable" });
  }

  const data = await res.json();
  const results = (data.places ?? []).map((p: Record<string, unknown>) => ({
    placeId: p.id,
    name: (p.displayName as { text?: string } | undefined)?.text ?? "",
    address: p.formattedAddress ?? undefined,
  }));

  return json(200, { results });
});
```

- [ ] **Step 2: Write the deploy runbook**

```markdown
# places-search deploy runbook (2026-08-05)

1. Set the secret (never commit it):
   `supabase secrets set GOOGLE_PLACES_API_KEY=<key from .env.local>`
2. Deploy WITH jwt verification — this is the difference from plan-guest:
   `supabase functions deploy places-search`
3. Verify it rejects an unauthenticated call:
   `curl -s -X POST "$URL/functions/v1/places-search" -H "Content-Type: application/json" -d '{"query":"monas"}'`
   Expect 401.
4. Verify it works with a signed-in JWT and returns placeId/name/address only.
5. Confirm the key is still absent from the bundle:
   `npm run build && grep -c "$GOOGLE_PLACES_API_KEY" dist/assets/*.js` -> 0
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/places-search/index.ts docs/plans/2026-08-05-places-search-deploy-runbook.md
git commit -m "feat(onboarding): places-search edge function keeping the Places key server-side"
```

- [ ] **Step 4: STOP — deployment is Colton's**

Hand him the runbook. Task 7's search section degrades gracefully without it, so Task 7 is not blocked.

---

### Task 7: Screen B — /welcome/spots

**Files:**
- Create: `src/pages/PickSpots.tsx`
- Create: `src/hooks/usePlacesSearch.ts`
- Modify: `src/App.tsx` (add route)

**Interfaces:**
- Consumes: `addSave` from `src/lib/saves.ts`; `addVenueRequests`, `dedupeHits`, `PlaceHit` (Task 5); `resolveDataSource` from `src/data/resolver.ts`; `useAuthStore`.
- Produces: route `/welcome/spots`. Navigates to `/welcome/location`.

- [ ] **Step 1: Write the search hook**

```ts
/**
 * Debounced venue search through the places-search edge function. Returns an
 * `unavailable` flag rather than throwing: the whole section degrades to
 * disabled if the function is not deployed, and the rest of the screen still
 * submits.
 */
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { PlaceHit } from "@/lib/venueRequests";

export function usePlacesSearch(query: string) {
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) { setUnavailable(true); setLoading(false); }
        return;
      }
      const { data, error } = await supabase.functions.invoke("places-search", {
        body: { query: q },
      });
      if (cancelled) return;
      if (error) {
        setUnavailable(true);
        setResults([]);
      } else {
        setUnavailable(false);
        setResults((data?.results ?? []) as PlaceHit[]);
      }
      setLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return { results, loading, unavailable };
}
```

- [ ] **Step 2: Write the screen**

```tsx
/**
 * Onboarding step 3 — favorite spots.
 *
 * Picks are written as real saves, so the friend facepile and Saved Spots are
 * non-empty on day one. Framing is present/aspirational ("your spots"), not
 * past-tense: the autumn beachhead is students new to the East Village, and
 * "pick your favorites" collects nothing from them.
 *
 * No minimum and no maximum — a forced minimum produces random taps.
 * Everything here is skippable and nothing may block signup.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { resolveDataSource } from "@/data/resolver";
import { addSave, getSaveVisibility } from "@/lib/saves";
import { addVenueRequests, dedupeHits, type PlaceHit } from "@/lib/venueRequests";
import { usePlacesSearch } from "@/hooks/usePlacesSearch";
import { logEvent } from "@/lib/analytics";

const PickSpots = () => {
  const navigate = useNavigate();
  const { status, session } = useAuthStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [requests, setRequests] = useState<PlaceHit[]>([]);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { results, loading, unavailable } = usePlacesSearch(query);

  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

  // getVenues, not listVenues — see src/data/sources/DataSource.ts:5. An empty
  // query returns the full active set, which is what this grid wants.
  const { data: venues = [] } = useQuery({
    queryKey: ["venues", "onboarding"],
    queryFn: ({ signal }) => resolveDataSource().getVenues({}, signal),
  });

  const fresh = useMemo(
    () => dedupeHits(results, requests.map((r) => r.placeId)),
    [results, requests]
  );

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /**
   * Never blocks. A failed save is retried on next app open; getting the user
   * to the map matters more than a complete first batch.
   */
  const finish = async () => {
    setSubmitting(true);
    if (session) {
      try {
        const visibility = await getSaveVisibility(session.user.id);
        await Promise.allSettled(picked.map((id) => addSave(session.user.id, id, visibility)));
        if (requests.length) await addVenueRequests(session.user.id, requests);
      } catch {
        // Intentionally swallowed — see the comment above.
      }
    }
    logEvent("onboarding_spots_completed", { picked: picked.length, requested: requests.length });
    navigate("/welcome/location", { replace: true });
  };

  const skip = () => {
    logEvent("onboarding_spots_skipped", {});
    navigate("/welcome/location", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">Which of these are your spots?</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Places you love or want to try. Pick a few — we'll save them for you.
        </p>

        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {venues.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.id)}
              aria-pressed={picked.includes(v.id)}
              className={cn(
                "h-11 rounded-xl border px-2 text-xs text-left truncate transition-colors",
                picked.includes(v.id)
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              )}
            >
              {v.title}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-2 min-h-4">
          {picked.length === 0
            ? "Three or so is plenty."
            : `${picked.length} saved.`}
        </p>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Somewhere we're missing?
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any bar"
            disabled={unavailable}
            className="h-11 text-base md:text-sm"
          />
          {unavailable && (
            <p className="text-xs text-muted-foreground mt-2">
              Search unavailable — you can add spots later.
            </p>
          )}
          {loading && <p className="text-xs text-muted-foreground mt-2">Searching…</p>}
          {fresh.map((h) => (
            <button
              key={h.placeId}
              type="button"
              onClick={() => {
                setRequests((r) => [...r, h]);
                setQuery("");
              }}
              className="w-full text-left mt-2 rounded-xl border border-border px-3 py-2"
            >
              <span className="text-sm">{h.name}</span>
              {h.address && <span className="block text-xs text-muted-foreground">{h.address}</span>}
            </button>
          ))}
          {requests.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Added: {requests.map((r) => r.name).join(", ")}
            </p>
          )}
        </div>

        <Button onClick={finish} disabled={submitting} className="w-full h-11 rounded-xl mt-5">
          {submitting ? "Saving…" : "Done"}
        </Button>
        <button
          type="button"
          onClick={skip}
          className="w-full text-center text-sm text-muted-foreground mt-3"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default PickSpots;
```

- [ ] **Step 3: Add the route**

```tsx
import PickSpots from "@/pages/PickSpots";
```

```tsx
<Route path="welcome/spots" element={<PickSpots />} />
```

- [ ] **Step 4: Typecheck, test, verify in the browser**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`
Expected: exit 0, 228 tests pass.

Run `npm run dev`, sign in, walk `/welcome` → `/welcome/about` → `/welcome/spots`. Confirm: venue chips toggle; "Skip for now" reaches the location step; with the edge function undeployed the search input is disabled with the fallback copy and "Done" still works.

- [ ] **Step 5: Commit**

```bash
git add src/pages/PickSpots.tsx src/hooks/usePlacesSearch.ts src/App.tsx
git commit -m "feat(onboarding): Your spots step — favorite picks as saves plus off-menu requests"
```

---

### Task 8: Backfill venues.google_place_id

**Files:**
- Create: `scripts/2026-08-05-place-id-backfill.sql`

**Interfaces:**
- Consumes: `scripts/place-ids.json`, `venues.google_place_id` (Task 1).
- Produces: SQL for Colton to paste.

- [ ] **Step 1: Generate the SQL from place-ids.json**

```bash
node -e '
const ids = require("./scripts/place-ids.json");
const esc = (s) => s.replace(/'"'"'/g, "'"'"''"'"'");
const lines = Object.entries(ids)
  .filter(([, v]) => v && v.placeId)
  .map(([title, v]) =>
    `update venues set google_place_id = '"'"'${v.placeId}'"'"' where name = '"'"'${esc(title)}'"'"' and google_place_id is null;`);
console.log("-- 2026-08-05 place-id backfill (gap-only, idempotent)");
console.log("-- Source: scripts/place-ids.json. Enables the exact venue_requests join.");
console.log(lines.join("\n"));
console.log("\nselect count(*) filter (where google_place_id is not null) as filled, count(*) from venues;");
' > scripts/2026-08-05-place-id-backfill.sql
wc -l scripts/2026-08-05-place-id-backfill.sql
```

Expected: about 59 lines.

- [ ] **Step 2: Sanity-check the output**

Run: `head -5 scripts/2026-08-05-place-id-backfill.sql`
Expected: comment lines then `update venues set google_place_id = 'ChIJ...' where name = '96 Tears' and google_place_id is null;`

Confirm names with apostrophes are doubled: `grep "Mona" scripts/2026-08-05-place-id-backfill.sql` should show `'Mona''s'`.

- [ ] **Step 3: Commit and hand to Colton**

```bash
git add scripts/2026-08-05-place-id-backfill.sql
git commit -m "chore(venues): place-id backfill enabling the venue_requests join"
pbcopy < scripts/2026-08-05-place-id-backfill.sql
```

Expect `filled = 56` of 57 (Cienfuegos is not in place-ids.json).

---

### Task 9: Privacy policy update

**Files:**
- Modify: the privacy policy page (find with `grep -rln "Privacy" src/pages/`)

**Interfaces:**
- Consumes: nothing.
- Produces: disclosure covering birthday and gender.

This is not optional. Birthday and gender are new personal data, the policy was revised 2026-08-05 for the App Store, and the privacy nutrition label must match what is collected.

- [ ] **Step 1: Locate the policy**

Run: `grep -rln "privacy\|Privacy" src/pages/ | head`

- [ ] **Step 2: Add the disclosure**

Add a paragraph covering, in the voice of the surrounding document:
- Birthday is collected at signup, used to tailor recommendations, visible only to the user, and never shown to anyone else.
- Gender is optional, used for the same purpose, and equally private.
- Saved spots picked during onboarding follow the existing saved-spots visibility setting, which defaults to friends.
- Bars a user asks for are stored so they can be told if that bar is added.
- ENDZ does not sell or share any of it.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(privacy): disclose birthday, gender, and requested venues"
```

- [ ] **Step 4: Tell Colton to update the App Store nutrition label**

The submission's declared data types must now include date of birth and gender.

---

## Test coverage against the spec

The spec lists six tests. Three are unit-testable and three are not — this repo
has **no component-testing setup** (no `@testing-library`, no jsdom/happy-dom;
Vitest here runs pure-logic tests only). Do not add one for this feature; that
is its own decision. The three are covered by the manual walk-through instead.

| Spec test | Covered by |
|---|---|
| Age derivation across boundaries (leap day, birthday today/tomorrow) | Task 2, unit |
| Under-13 rejection at the exact boundary | Task 2, unit |
| `venue_requests` dedup on resubmission | Task 5, unit |
| Save-batch partial failure leaves onboarding completable | Manual — `Promise.allSettled` in Task 7, verified by the walk-through |
| Both skip paths leave a valid profile | Manual — Task 7 Step 4 |
| Gender check constraint rejects unknown values | Enforced by the DB constraint in Task 1; not reachable from a unit test |

## Verification

After all tasks:

```bash
npx tsc --noEmit -p tsconfig.app.json   # exit 0
npm test                                 # 228 passing (215 baseline + 13)
npm run build                            # succeeds
grep -c "$GOOGLE_PLACES_API_KEY" dist/assets/*.js   # 0 — key must not ship
```

Manual walk-through, signed in as a new account: `/welcome` → `/welcome/about` → `/welcome/spots` → `/welcome/location` → map. Then confirm the picked venues appear in Saved Spots.
