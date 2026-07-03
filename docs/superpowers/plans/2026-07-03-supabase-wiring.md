# Supabase Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the app to the live Supabase backend: shared client, real venue data replacing the demo dataset, Google sign-in, and first-login profile creation with a pick-a-username screen.

**Architecture:** A single client module (`src/lib/supabase.ts`) is the only place a Supabase client is constructed; the data layer (`SupabaseDataSource` + resolver) and a new auth store (`src/store/auth.ts`) both consume it. Venues become publicly readable via an RLS change (dashboard step); auth state drives the reworked Profile tab and a new `/welcome` username screen. The static demo dataset remains only as the no-config fallback.

**Tech Stack:** `@supabase/supabase-js` v2, Zustand, TanStack Query (existing), shadcn/ui, React Router v6.

## Global Constraints

- Type-check command is `npx tsc --noEmit -p tsconfig.app.json`. Bare `npx tsc --noEmit` is a silent no-op in this repo (root tsconfig has `"files": []`) — never trust it.
- No test runner exists; verification is tsc + `npm run build` + live browser checks.
- No fabricated venue data: mapped venues must leave `buzz_score`, `hot_tonight`, `editors_pick`, `venue_stats`, `open_now`, `cover_charge`, `image_url` undefined.
- UX quality bar (binding, from spec): no flash of wrong auth state (skeleton while `status === 'loading'`); username availability feedback inline and debounced (~400ms), no submit-and-see-error round trips; map render never blocks on venue data; sign-in button shows immediate loading state.
- Copy tone: direct, casual, human. Banned: "seamless experience", "unlock the power of", corporate/AI voice. Approved bank includes "Find out where your friends are tonight."
- Secrets: `.env.local` is gitignored and already contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never commit real keys; `.env.example` gets placeholders only.
- The publishable key is public by design (RLS is the security boundary) — it is NOT a secret, do not treat its presence in client code as a finding.

---

### Task 1: Supabase client module

**Files:**
- Modify: `package.json` (via `npm install @supabase/supabase-js`)
- Create: `src/lib/supabase.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `useConfigStore` from `@/store/config` (existing: `supabaseUrl?: string; supabaseAnonKey?: string` fields).
- Produces: `getSupabase(): SupabaseClient | null` from `@/lib/supabase` — Tasks 3, 4, 6 import exactly this. Returns `null` when neither env vars nor config-store values are set.

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`
Expected: success; `@supabase/supabase-js` appears in `package.json` dependencies at `^2.x`.

- [ ] **Step 2: Create `src/lib/supabase.ts`**

```ts
/**
 * Single shared Supabase client. Everything (data sources, auth) goes
 * through getSupabase() — nothing else constructs clients.
 *
 * Config precedence: build-time env vars (what production uses) first,
 * then the Profile-tab config store as a manual fallback. Returns null
 * when neither is set, so callers can fall back to demo behavior.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useConfigStore } from "@/store/config";

let client: SupabaseClient | null = null;
let clientCacheKey = "";

export function getSupabase(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = useConfigStore.getState();
  const url = import.meta.env.VITE_SUPABASE_URL || supabaseUrl;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || supabaseAnonKey;
  if (!url || !key) return null;

  const cacheKey = `${url}|${key}`;
  if (!client || clientCacheKey !== cacheKey) {
    client = createClient(url, key);
    clientCacheKey = cacheKey;
  }
  return client;
}
```

- [ ] **Step 3: Declare the env vars in `src/vite-env.d.ts`**

Replace the full contents with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Add placeholders to `.env.example`**

Append to the existing file:

```
# Supabase project (Settings > Data API for the URL, Settings > API Keys
# for the publishable key). The publishable key is safe in front-end code —
# Row Level Security is the security boundary.
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/vite-env.d.ts .env.example
git commit -m "feat: add shared Supabase client module"
```

---

### Task 2: Backend dashboard changes (user-executed — controller coordinates, do NOT dispatch a code subagent)

This task is manual dashboard work only the project owner can perform. The controller hands the SQL to the user (clipboard) and verifies the result with curl.

**Files:** none in this repo.

**Interfaces:**
- Produces: venues publicly readable via REST (Task 3's live verification depends on it); OAuth redirects to `http://localhost:8080/*` allowed (Task 5's sign-in round trip depends on it).

- [ ] **Step 1: User runs the RLS change in the Supabase SQL editor**

```sql
drop policy "venues readable by authenticated" on venues;

create policy "venues readable by everyone"
  on venues for select
  using (true);
```

Expected: "Success. No rows returned". Profiles, check_ins, and friendships policies are untouched.

- [ ] **Step 2: Verify anonymously via curl**

Run:
```bash
curl -s "https://nqafzgryzjbtwpvzjagr.supabase.co/rest/v1/venues?select=name&limit=25" \
  -H "apikey: $(grep VITE_SUPABASE_PUBLISHABLE_KEY /Users/colton.lestorti/Documents/night-guide/.env.local | cut -d= -f2)" | python3 -c "import json,sys; print(len(json.load(sys.stdin)), 'venues')"
```
Expected: `19 venues` (was `0` before the policy change).

- [ ] **Step 3: User adds redirect URLs in the Supabase dashboard**

Authentication → URL Configuration:
- **Site URL:** `http://localhost:8080`
- **Additional redirect URLs:** `http://localhost:8080/profile`

(Production Vercel URLs get added at deploy time — out of scope here.)

- [ ] **Step 4: Record completion**

No commit (no repo changes). Controller notes completion in the progress ledger.

---

### Task 3: Implement SupabaseDataSource and flip the resolver

**Files:**
- Modify: `src/data/sources/DemoDataSource.ts:5` (export `filterVenues`)
- Modify: `src/data/sources/SupabaseDataSource.ts` (full replacement)
- Modify: `src/data/resolver.ts` (full replacement)

**Interfaces:**
- Consumes: `getSupabase(): SupabaseClient | null` from `@/lib/supabase` (Task 1); `filterVenues(venues: Venue[], q: VenueQuery): Venue[]` (exported in this task); existing types `Venue`, `VenueQuery`, `VenueCategory` from `@/data/types`.
- Produces: working `SupabaseDataSource` with `kind: "supabase"`, `getVenues(q, signal?): Promise<Venue[]>`, `getVenue(id, signal?): Promise<Venue | null>`; exported `mapVenueRow(row: VenueRow): Venue` (exported for reviewability, not consumed elsewhere).

**Design note (parity):** only the bbox filter runs server-side (`lat`/`lng` map 1:1 to DB columns, no mapping distortion). Category, search, price, music, age, and crowd filters run client-side through the same `filterVenues` the demo source uses — guaranteeing identical filter semantics. Server-side `type in (...)` would diverge: a future `college_spot` row maps to category `"bar"` client-side but would be excluded server-side. 19 rows make client-side filtering free.

- [ ] **Step 1: Export `filterVenues` from `src/data/sources/DemoDataSource.ts`**

Change line 5 from:

```ts
function filterVenues(venues: Venue[], q: VenueQuery): Venue[] {
```

to:

```ts
export function filterVenues(venues: Venue[], q: VenueQuery): Venue[] {
```

- [ ] **Step 2: Replace `src/data/sources/SupabaseDataSource.ts` entirely**

```ts
import { DataSource } from "./DataSource";
import { Venue, VenueQuery, VenueCategory } from "@/data/types";
import { getSupabase } from "@/lib/supabase";
import { filterVenues } from "./DemoDataSource";

/** Shape of a public.venues row (see endz-schema.sql). */
type VenueRow = {
  id: string;
  name: string;
  type: string;
  price: "$" | "$$" | "$$$" | "$$$$" | null;
  description: string | null;
  music: string | null;
  age_range: string | null;
  lat: number;
  lng: number;
};

const PRICE_LEVEL: Record<string, 1 | 2 | 3 | 4> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
const CATEGORIES: readonly string[] = ["bar", "club", "lounge"];

function titleCaseMusic(music: string): string {
  return music
    .split("/")
    .map((part) => part.trim().replace(/^./, (c) => c.toUpperCase()))
    .join(" / ");
}

function parseAgeRange(range: string | null): { min?: number; max?: number } {
  const m = range?.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return {};
  return { min: Number(m[1]), max: Number(m[2]) };
}

/**
 * DB row -> app Venue, same rules as the seed transcription. Unknown
 * activity fields (buzz, crowd, hours, cover, images) stay undefined —
 * live data comes from real check-ins later, never invented here.
 */
export function mapVenueRow(row: VenueRow): Venue {
  const age = parseAgeRange(row.age_range);
  const venue: Venue = {
    id: row.id,
    title: row.name,
    latitude: row.lat,
    longitude: row.lng,
    serves_alcohol: true,
    category: (CATEGORIES.includes(row.type) ? row.type : "bar") as VenueCategory,
  };
  if (row.description) venue.description = row.description;
  if (row.price) venue.avg_price_level = PRICE_LEVEL[row.price];
  if (row.music && row.music.toLowerCase() !== "none") venue.music_type = titleCaseMusic(row.music);
  if (age.min !== undefined) venue.age_range_min = age.min;
  if (age.max !== undefined) venue.age_range_max = age.max;
  return venue;
}

export class SupabaseDataSource implements DataSource {
  kind = "supabase" as const;

  async getVenues(q: VenueQuery, _signal?: AbortSignal): Promise<Venue[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    let query = supabase.from("venues").select("*");
    if (q.bbox) {
      const [west, south, east, north] = q.bbox;
      query = query.gte("lng", west).lte("lng", east).gte("lat", south).lte("lat", north);
    }
    const { data, error } = await query;
    if (error) throw error;
    return filterVenues((data as VenueRow[]).map(mapVenueRow), q);
  }

  async getVenue(id: string, _signal?: AbortSignal): Promise<Venue | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data, error } = await supabase.from("venues").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapVenueRow(data as VenueRow) : null;
  }
}
```

- [ ] **Step 3: Replace `src/data/resolver.ts` entirely**

```ts
import { useConfigStore } from "@/store/config";
import { ApiDataSource } from "./sources/ApiDataSource";
import { SupabaseDataSource } from "./sources/SupabaseDataSource";
import { DemoDataSource } from "./sources/DemoDataSource";
import { DataSource } from "./sources/DataSource";
import { getSupabase } from "@/lib/supabase";

export function resolveDataSource(): DataSource {
  const { apiBaseUrl } = useConfigStore.getState();
  if (apiBaseUrl) return new ApiDataSource(apiBaseUrl);
  // Live backend whenever the Supabase client is configured (env vars or Profile tab)
  if (getSupabase()) return new SupabaseDataSource();
  // Demo dataset only as the no-config fallback
  return new DemoDataSource();
}
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Live browser verification**

Run `npm run dev`, open `http://localhost:8080/discover` in a browser (Playwright fine).
Expected: 19 venue cards — The Grafton, Standings, International Bar, Coyote Ugly Saloon, Niagara Bar, Paul's Cocktail Lounge, Lucy's Bar, Doc Holliday's, Cienfuegos, The Library, Manitoba's, Death & Co, The Summit Bar, Alphabet City Beer Co, The Bourgeois Pig, KGB Bar, McSorley's Old Ale House, Angel's Share, Beauty Bar — served from the network (`/rest/v1/venues` request visible), not the demo module. Cards show the gradient image fallback (no photos). List view shows skeletons during load.

- [ ] **Step 6: Commit**

```bash
git add src/data/sources/DemoDataSource.ts src/data/sources/SupabaseDataSource.ts src/data/resolver.ts
git commit -m "feat: serve live venues from Supabase, demo data as fallback"
```

---

### Task 4: Auth store

**Files:**
- Create: `src/store/auth.ts`
- Modify: `src/App.tsx` (init hook)

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase` (Task 1).
- Produces (Tasks 5 and 6 depend on these exact names):
  - `useAuthStore` (Zustand) with state `{ status: AuthStatus; session: Session | null; profile: Profile | null }` and actions `init(): void`, `refreshProfile(): Promise<void>`, `signInWithGoogle(): Promise<void>`, `signOut(): Promise<void>`
  - `type AuthStatus = "loading" | "signedOut" | "signedIn" | "needsUsername"`
  - `type Profile = { id: string; username: string; display_name: string | null; avatar_url: string | null; ghost_mode: boolean }`

- [ ] **Step 1: Create `src/store/auth.ts`**

```ts
import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
};

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "needsUsername";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  init: () => void;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,

  init: () => {
    if (initialized) return;
    initialized = true;
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: "signedOut" });
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session });
      if (session) get().refreshProfile();
      else set({ status: "signedOut" });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) get().refreshProfile();
      else set({ status: "signedOut", profile: null });
    });
  },

  refreshProfile: async () => {
    const supabase = getSupabase();
    const session = get().session;
    if (!supabase || !session) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, ghost_mode")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      // Can't tell if a profile exists — treat as signed in, retry on next auth event
      set({ status: "signedIn", profile: null });
      return;
    }
    if (data) set({ status: "signedIn", profile: data as Profile });
    else set({ status: "needsUsername", profile: null });
  },

  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/profile` },
    });
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ status: "signedOut", session: null, profile: null });
  },
}));
```

- [ ] **Step 2: Initialize the store once in `src/App.tsx`**

Replace the whole file with:

```tsx
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/layouts/AppLayout";
import MapPage from "@/pages/MapPage";
import Discover from "@/pages/Discover";
import Social from "@/pages/Social";
import Profile from "@/pages/Profile";
import VenueDetail from "@/pages/VenueDetail";
import NotFound from "./pages/NotFound";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<MapPage />} />
              <Route path="discover" element={<Discover />} />
              <Route path="venue/:id" element={<VenueDetail />} />
              <Route path="social" element={<Social />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
```

(The `/welcome` route is added in Task 6, not here.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/store/auth.ts src/App.tsx
git commit -m "feat: add auth store with Google sign-in and profile status"
```

---

### Task 5: Profile tab rework

**Files:**
- Modify: `src/pages/Profile.tsx` (full replacement)

**Interfaces:**
- Consumes: `useAuthStore` (`status`, `session`, `profile`, `signInWithGoogle`, `signOut`) from `@/store/auth` (Task 4); `useConfigStore` from `@/store/config` (existing); shadcn `Avatar`, `Button`, `Input`, `Skeleton`, `Collapsible` components (all already in `src/components/ui/`).
- Produces: nothing consumed by later tasks (Task 6 is independent of this file).

- [ ] **Step 1: Replace `src/pages/Profile.tsx` entirely**

```tsx
import { useState } from "react";
import { useConfigStore } from "@/store/config";
import { useAuthStore } from "@/store/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/** Developer-only config (Mapbox token, API base URL, Supabase overrides). */
const DevSettings = () => {
  const { apiBaseUrl, mapboxToken, supabaseUrl, supabaseAnonKey, setConfig } = useConfigStore();
  const [api, setApi] = useState(apiBaseUrl ?? "");
  const [token, setToken] = useState(mapboxToken ?? "");
  const [sUrl, setSUrl] = useState(supabaseUrl ?? "");
  const [sAnon, setSAnon] = useState(supabaseAnonKey ?? "");
  const [open, setOpen] = useState(false);

  const save = () =>
    setConfig({
      apiBaseUrl: api || undefined,
      mapboxToken: token || undefined,
      supabaseUrl: sUrl || undefined,
      supabaseAnonKey: sAnon || undefined,
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-10">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        Developer settings
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-4 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">Public API Base URL</label>
          <Input placeholder="https://api.yourdomain.com" value={api} onChange={(e) => setApi(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mapbox Public Token</label>
          <Input placeholder="pk.***" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase URL</label>
          <Input placeholder="https://xyzcompany.supabase.co" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase Publishable Key</label>
          <Input placeholder="sb_publishable_..." value={sAnon} onChange={(e) => setSAnon(e.target.value)} />
        </div>
        <div>
          <Button onClick={save} variant="secondary" size="sm">Save</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Profile = () => {
  const { status, session, profile, signInWithGoogle, signOut } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    await signInWithGoogle();
    // OAuth redirects away; if it didn't (config missing), release the button
    setTimeout(() => setSigningIn(false), 4000);
  };

  const meta = session?.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string } | undefined;
  const displayName = profile?.display_name || meta?.full_name || meta?.name || "";
  const avatarUrl = profile?.avatar_url || meta?.avatar_url || meta?.picture || "";

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </header>

      {status === "loading" ? (
        <div className="glass rounded-3xl p-6 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ) : status === "signedOut" ? (
        <div className="glass rounded-3xl p-6 text-center animate-fade-in">
          <h2 className="text-lg font-semibold">Find out where your friends are tonight.</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5">
            Sign in to check in, add friends, and show up on the map.
          </p>
          <Button onClick={handleSignIn} disabled={signingIn} className="w-full h-11 rounded-xl">
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </Button>
        </div>
      ) : (
        <div className="glass rounded-3xl p-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback>{(displayName || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold truncate">{displayName || "You"}</div>
              {profile?.username && (
                <div className="text-sm text-muted-foreground truncate">@{profile.username}</div>
              )}
            </div>
          </div>
          <Button onClick={signOut} variant="secondary" className="w-full h-11 rounded-xl mt-5">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      )}

      <DevSettings />
    </section>
  );
};

export default Profile;
```

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Live browser verification (signed-out states)**

Run `npm run dev`, open `http://localhost:8080/profile`.
Expected: brief skeleton (no signed-out flash before session restore resolves), then the signed-out card with "Find out where your friends are tonight." and a "Continue with Google" button. Clicking the button immediately shows "Opening Google…" and navigates to Google's login page (do NOT complete login in this step — that's user-assisted verification below). "Developer settings" is collapsed at the bottom; expanding shows the four config fields.

- [ ] **Step 4: User-assisted verification (full OAuth round trip)**

The user (an allowlisted Google test user) completes sign-in. Expected: redirected back to `http://localhost:8080/profile`; the card shows their Google name and photo (no username yet — that's Task 6); Sign out returns the tab to the signed-out card without a page reload.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: rework Profile tab into account screen with Google sign-in"
```

---

### Task 6: Pick-a-username onboarding screen

**Files:**
- Create: `src/pages/PickUsername.tsx`
- Modify: `src/App.tsx` (add `/welcome` route)
- Modify: `src/layouts/AppLayout.tsx` (needsUsername redirect)

**Interfaces:**
- Consumes: `useAuthStore` (`status`, `session`, `refreshProfile`) from `@/store/auth` (Task 4); `getSupabase()` from `@/lib/supabase` (Task 1).
- Produces: route `/welcome` rendering `PickUsername`; automatic redirect to it whenever `status === "needsUsername"`.

- [ ] **Step 1: Create `src/pages/PickUsername.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { getSupabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** email local-part -> lowercase, non [a-z0-9_] -> _, collapse _, trim _ */
export function suggestUsername(email: string | undefined | null): string {
  if (!email) return "";
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

type Availability = "idle" | "invalid" | "checking" | "available" | "taken";

const PickUsername = () => {
  const navigate = useNavigate();
  const { status, session, refreshProfile } = useAuthStore();
  const [username, setUsername] = useState(() => suggestUsername(useAuthStore.getState().session?.user.email));
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Only makes sense mid-onboarding; bounce anyone else
  useEffect(() => {
    if (status === "signedOut") navigate("/profile");
    if (status === "signedIn") navigate("/");
  }, [status, navigate]);

  // Debounced availability check
  useEffect(() => {
    setError("");
    if (!username) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const t = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
      setAvailability(data ? "taken" : "available");
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const claim = async () => {
    const supabase = getSupabase();
    if (!supabase || !session || availability !== "available") return;
    setSubmitting(true);
    setError("");
    const meta = session.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
    const { error: insertError } = await supabase.from("profiles").insert({
      id: session.user.id,
      username,
      display_name: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || meta.picture || null,
    });
    if (insertError) {
      setSubmitting(false);
      if (insertError.code === "23505") {
        setAvailability("taken");
        setError("Someone just grabbed that one — try another.");
      } else {
        setError("Couldn't save that. Give it another shot.");
      }
      return;
    }
    await refreshProfile(); // flips status to signedIn -> effect above navigates to "/"
  };

  const hint =
    availability === "invalid"
      ? "3-20 characters: lowercase letters, numbers, underscores."
      : availability === "taken"
      ? error || "That one's taken."
      : error;

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 pt-24">
      <div className="w-full max-w-sm glass rounded-3xl p-6 animate-fade-in">
        <h1 className="text-xl font-bold tracking-tight">Pick your username</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          It's how friends find you. You can't hide from a good handle.
        </p>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
          <Input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === "Enter" && claim()}
            className="pl-8 pr-9 h-11"
            aria-label="Username"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {availability === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {availability === "available" && <Check className="h-4 w-4 text-green-500" />}
            {(availability === "taken" || availability === "invalid") && <X className="h-4 w-4 text-red-500" />}
          </span>
        </div>

        <p className={cn("text-xs mt-2 min-h-4", availability === "available" ? "text-green-500" : "text-muted-foreground")}>
          {availability === "available" ? "It's yours if you want it." : hint}
        </p>

        <Button
          onClick={claim}
          disabled={availability !== "available" || submitting}
          className="w-full h-11 rounded-xl mt-4"
        >
          {submitting ? "Claiming…" : "Claim it"}
        </Button>
      </div>
    </div>
  );
};

export default PickUsername;
```

- [ ] **Step 2: Add the `/welcome` route to `src/App.tsx`**

Add the import:

```tsx
import PickUsername from "@/pages/PickUsername";
```

and add this route between the `</Route>` closing the `AppLayout` group and the catch-all:

```tsx
            <Route path="welcome" element={<PickUsername />} />
```

(Outside `AppLayout` on purpose — no bottom tabs during onboarding, full focus on the one field.)

- [ ] **Step 3: Add the needsUsername redirect to `src/layouts/AppLayout.tsx`**

Replace the file with:

```tsx
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import BottomTabs from "@/components/layout/BottomTabs";
import { useAuthStore } from "@/store/auth";

const AppLayout = () => {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();

  // First sign-in with no profile row yet -> finish onboarding before anything else
  useEffect(() => {
    if (status === "needsUsername") navigate("/welcome");
  }, [status, navigate]);

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

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: User-assisted live verification (full first-login flow)**

With the user signed out and their `profiles` row absent (fresh test user, or delete the row in the Supabase table editor):
1. Profile tab → Continue with Google → complete login (user does this)
2. Expected: land back in the app, get redirected to `/welcome`; field pre-filled from email; typing an invalid value shows the ✗ + hint inline; a valid unique value shows ✓ "It's yours if you want it." within ~a second of pausing
3. Claim it → Expected: land on the map; Profile tab now shows name, photo, and `@username`; the `profiles` row exists in the Supabase table editor with `ghost_mode = false`
4. Sign out → signed-out card returns without reload

- [ ] **Step 6: Commit**

```bash
git add src/pages/PickUsername.tsx src/App.tsx src/layouts/AppLayout.tsx
git commit -m "feat: add pick-a-username onboarding for first sign-in"
```
