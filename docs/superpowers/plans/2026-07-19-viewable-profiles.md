# Viewable Friend Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A viewable profile page at `/u/:username` (identity card + friendship action + out-tonight line) reachable by tapping people anywhere in the app, plus an editable 150-char bio.

**Architecture:** One new page (`UserProfile.tsx`) composed from the existing friends data layer (`src/lib/friends.ts` + `src/hooks/useFriends.ts` React Query) and the existing `AddButton` relationship button. Bio is a new nullable `profiles.bio` column; every fetch that selects it falls back to a bio-less select on Postgres error `42703` so the app works before Colton pastes the DDL (same graceful-degradation stance as the avatars bucket). Tap-throughs are added to the six person-rendering components.

**Tech Stack:** React 18 + TypeScript + Vite, react-router-dom, @tanstack/react-query, zustand, Supabase JS, shadcn/ui, Tailwind.

## Global Constraints

- **Approved scope only** (Decision Log 2026-07-19): identity card (avatar/name/@username/bio) + Add-friend/Requested/Friends action + out-tonight-at-X line. NO counts, NO activity history, NO usual spots, NO mutual friends, NO private-profile toggle, NO out-tonight text payload.
- **Three-layer visibility:** identity card visible to any signed-in user; liveness (out tonight) friends-only via the existing RLS feed — the UI never filters anyone in or out itself ("RLS is the only privacy boundary", `src/lib/friends.ts` header).
- **No Supabase policy changes.** The only DDL is `profiles.bio` (already recorded in `~/Documents/endz/endz-schema.sql`; Colton pastes it — code must not break before that).
- **No test runner exists in this repo** (no vitest/jest in package.json — verified). Per-task verification is `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op); full live verification is the final task. Do not add a test framework.
- Bio max length 150 chars, enforced in UI (`maxLength`) and DB (check constraint in the DDL).
- Work on branch `feat/viewable-profiles`. Never merge or push — Colton's explicit OK required.
- Match existing idiom: section cards `rounded-3xl border border-border bg-card`, page shell `container pt-6 pb-24 max-w-lg`, `animate-fade-in`, lucide icons, sonner toasts.

---

### Task 1: Data layer — bio field + profile-by-username fetch + hook

**Files:**
- Modify: `src/lib/friends.ts` (type at lines 19–24, add function after `suggestedProfiles` ~line 136)
- Modify: `src/hooks/useFriends.ts` (add hook after `useSuggestedProfiles` ~line 76)

**Interfaces:**
- Consumes: existing `PROFILE_COLS`, `getSupabase()`.
- Produces: `FriendProfile.bio?: string | null`; `getProfileByUsername(username: string): Promise<FriendProfile | null>`; `useProfileByUsername(username: string | undefined): UseQueryResult<FriendProfile | null>`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/viewable-profiles
```

- [ ] **Step 2: Add `bio` to `FriendProfile`**

In `src/lib/friends.ts`, change the type (lines 19–24) to:

```ts
export type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Present only on profile-page fetches (getProfileByUsername); list
   *  queries keep the lean PROFILE_COLS select. */
  bio?: string | null;
};
```

Do NOT add `bio` to `PROFILE_COLS` — that constant feeds every friendships
join and would break all friend queries until the DDL lands.

- [ ] **Step 3: Add `getProfileByUsername`**

In `src/lib/friends.ts`, after `suggestedProfiles`:

```ts
/**
 * Full identity card by handle (case-insensitive; leading @ ok). Null when
 * no such user. Selects bio but falls back to a bio-less select while the
 * profiles.bio column DDL is pending (Postgres 42703 = undefined column).
 */
export async function getProfileByUsername(username: string): Promise<FriendProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const handle = username.replace(/^@/, "").toLowerCase();
  if (!handle) return null;
  let { data, error } = await supabase
    .from("profiles")
    .select(`${PROFILE_COLS}, bio`)
    .eq("username", handle)
    .maybeSingle();
  if (error && error.code === "42703") {
    ({ data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .eq("username", handle)
      .maybeSingle());
  }
  if (error) throw error;
  return (data as FriendProfile | null) ?? null;
}
```

- [ ] **Step 4: Add the `useProfileByUsername` hook**

In `src/hooks/useFriends.ts`, add `getProfileByUsername` to the existing
`@/lib/friends` import list, then after `useSuggestedProfiles`:

```ts
export function useProfileByUsername(username: string | undefined) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<FriendProfile | null>({
    queryKey: ["profile-by-username", username?.toLowerCase()],
    enabled: !!userId && !!username,
    staleTime: 30_000,
    queryFn: () => getProfileByUsername(username!),
  });
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/friends.ts src/hooks/useFriends.ts
git commit -m "feat(profiles): bio field + profile-by-username fetch/hook"
```

---

### Task 2: Auth store — own bio in state, refresh, and updates

**Files:**
- Modify: `src/store/auth.ts` (type lines 5–11, `updateProfile` signature line 21, `refreshProfile` lines 54–70)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Profile.bio: string | null`; `updateProfile` accepts `bio` in its patch; `refreshProfile` populates `bio` (null while DDL pending).

- [ ] **Step 1: Extend the `Profile` type**

```ts
export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
  bio: string | null;
};
```

- [ ] **Step 2: Let `updateProfile` patch bio**

Change the interface line 21 to:

```ts
  updateProfile: (patch: Partial<Pick<Profile, "display_name" | "username" | "avatar_url" | "bio">>) => Promise<void>;
```

(The implementation is already generic over the patch — no body change.)

- [ ] **Step 3: Fetch bio in `refreshProfile` with the 42703 fallback**

Replace the select block in `refreshProfile` (lines 58–62) with:

```ts
    let { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, ghost_mode, bio")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error && error.code === "42703") {
      // profiles.bio DDL not pasted yet — degrade to the bio-less profile.
      ({ data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, ghost_mode")
        .eq("id", session.user.id)
        .maybeSingle());
      if (data) (data as Record<string, unknown>).bio = null;
    }
```

Keep the existing `if (error)` / `if (data)` handling below unchanged.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0. If other files construct `Profile` literals without `bio`
(search: `grep -rn "profile: {" src/` and PickUsername's insert), add
`bio: null` where the compiler complains — fix every error before moving on.

- [ ] **Step 5: Commit**

```bash
git add src/store/auth.ts
git commit -m "feat(profiles): bio in auth store profile + refresh fallback"
```

---

### Task 3: UserProfile page + `/u/:username` route

**Files:**
- Create: `src/pages/UserProfile.tsx`
- Modify: `src/App.tsx` (import block ~lines 8–20; routes lines 38–44)

**Interfaces:**
- Consumes: `useProfileByUsername` (Task 1), `useFriendsOutTonight` + `AddButton` + `ProfileAvatar` (existing), `useAuthStore`.
- Produces: route `/u/:username` inside `AppLayout`.

- [ ] **Step 1: Create `src/pages/UserProfile.tsx`**

```tsx
/**
 * Viewable profile — /u/:username. Three-layer visibility (Decision Log
 * 2026-07-19): identity card renders for any signed-in viewer; the
 * out-tonight line only ever has data for friends because it reads the
 * RLS-scoped friends-out-tonight feed — no client-side privacy filtering.
 */
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, UserX } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useFriendsOutTonight, useProfileByUsername } from "@/hooks/useFriends";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AddButton from "@/components/social/AddButton";
import ProfileAvatar from "@/components/social/ProfileAvatar";

const UserProfile = () => {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const myUsername = useAuthStore((s) => s.profile?.username);
  const handle = username.replace(/^@/, "").toLowerCase();
  const { data: profile, isLoading, isError } = useProfileByUsername(
    status === "signedIn" ? handle : undefined
  );
  const { data: out } = useFriendsOutTonight();

  // Own handle → the real profile page (edit lives there).
  if (myUsername && handle === myUsername) return <Navigate to="/profile" replace />;

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-4 -ml-2 rounded-xl text-muted-foreground"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/social"))}
    >
      <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
    </Button>
  );

  if (status !== "signedIn") {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <p className="font-display text-lg font-bold">Sign in to view profiles.</p>
          <Button className="mt-5 h-11 w-full rounded-xl" onClick={() => navigate("/profile")}>
            Sign in
          </Button>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-6 animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </section>
    );
  }

  if (isError || !profile) {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {back}
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <UserX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="font-display text-lg font-bold">
            {isError ? "Couldn't load that profile." : "No one by that handle."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isError ? "Give it another shot in a second." : `@${handle} doesn't exist — maybe they changed it.`}
          </p>
        </div>
      </section>
    );
  }

  const liveNow = (out ?? []).find((f) => f.profile.id === profile.id);

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}
      <div className="rounded-3xl border border-border bg-card p-6 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <ProfileAvatar profile={profile} className="h-24 w-24 ring-4 ring-card shadow-float" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
            {profile.display_name || `@${profile.username}`}
          </h1>
          {profile.display_name && (
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          )}
          {profile.bio && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground/80">{profile.bio}</p>
          )}
          <div className="mt-4">
            <AddButton profile={profile} />
          </div>
        </div>
      </div>

      {liveNow && (
        <Link
          to="/"
          state={{ venueId: liveNow.venueId }}
          className="mt-4 flex items-center gap-2.5 rounded-3xl border border-border bg-card px-4 py-3.5 animate-fade-in transition-colors hover:bg-secondary/60"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              Out tonight at {liveNow.venueName}
            </span>
            <span className="block text-xs text-muted-foreground">
              {timeAgo(liveNow.checkedInAt)}
            </span>
          </span>
        </Link>
      )}
    </section>
  );
};

export default UserProfile;
```

- [ ] **Step 2: Register the route**

In `src/App.tsx`, import `UserProfile` alongside the other pages and add
inside the `AppLayout` route group (after the `profile` route, line 43):

```tsx
                <Route path="u/:username" element={<UserProfile />} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0.

- [ ] **Step 4: Smoke-check in dev**

Run: `npm run dev` (already-running instance fine). Visit
`http://localhost:8080/u/<a-real-username>` and `http://localhost:8080/u/zzz-nobody`.
Expected: identity card renders for the real handle; "No one by that handle."
for the fake one. (Full E2E matrix is Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/UserProfile.tsx src/App.tsx
git commit -m "feat(profiles): viewable profile page at /u/:username"
```

---

### Task 4: Bio editing in EditProfileDialog

**Files:**
- Modify: `src/components/EditProfileDialog.tsx`

**Interfaces:**
- Consumes: `updateProfile` accepting `bio` (Task 2).
- Produces: nothing downstream.

- [ ] **Step 1: Add bio state, seeding, dirty tracking, and save**

In `src/components/EditProfileDialog.tsx`:

1. Add state next to the others (line 28): `const [bio, setBio] = useState("");`
2. Seed it in the existing open-transition effect (inside `if (p) {`):
   `setBio(p.bio ?? "");`
3. Add change tracking next to `nameChanged` (line 57):
   `const bioChanged = bio.trim() !== (profile.bio ?? "");`
   and extend: `const dirty = usernameChanged || nameChanged || bioChanged;`
4. Extend the save patch (lines 85–87):

```ts
    const patch: { display_name?: string | null; username?: string; bio?: string | null } = {};
    if (nameChanged) patch.display_name = displayName.trim() || null;
    if (usernameChanged) patch.username = username;
    if (bioChanged) patch.bio = bio.trim() || null;
```

5. In the `catch`, handle the pre-DDL column (alongside the existing 23505
   case):

```ts
      } else if (code === "42703") {
        toast.error("Bio isn't available yet — everything else saved next try.");
      } else {
```

- [ ] **Step 2: Add the bio field UI**

After the username block (after line 196), add:

```tsx
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="edit-bio" className="text-sm font-medium">
              Bio
            </label>
            <span className="text-xs text-muted-foreground">{bio.length}/150</span>
          </div>
          <Textarea
            id="edit-bio"
            value={bio}
            maxLength={150}
            rows={2}
            placeholder="One line about your nights out."
            onChange={(e) => setBio(e.target.value)}
            className="resize-none"
          />
        </div>
```

Add the import: `import { Textarea } from "@/components/ui/textarea";`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/EditProfileDialog.tsx
git commit -m "feat(profiles): bio field in edit-profile dialog (150 chars)"
```

---

### Task 5: Tap-throughs from every person surface

**Files:**
- Modify: `src/components/social/FriendRow.tsx`
- Modify: `src/components/social/RequestRow.tsx`
- Modify: `src/components/social/SuggestedList.tsx`
- Modify: `src/components/social/ProfileSearch.tsx`
- Modify: `src/components/social/OutTonightRow.tsx`
- Modify: `src/components/FriendsHereRow.tsx`

**Interfaces:**
- Consumes: route `/u/:username` (Task 3).
- Produces: nothing downstream.

HTML constraint driving every edit below: several rows are currently one big
`<button>`; nested buttons are invalid HTML, so each row becomes a `div`
holding sibling buttons.

- [ ] **Step 1: FriendRow — row opens profile, kebab opens manage drawer**

Replace the outer `<button>` block (lines 20–35) with:

```tsx
      <div className="flex items-center gap-3 py-2.5">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => navigate(`/u/${profile.username}`)}
          aria-label={`View @${profile.username}'s profile`}
        >
          <ProfileAvatar profile={profile} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">@{profile.username}</span>
            {profile.display_name && (
              <span className="block truncate text-xs text-muted-foreground">
                {profile.display_name}
              </span>
            )}
          </span>
        </button>
        <button
          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen(true)}
          aria-label={`Manage @${profile.username}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
```

Add `import { useNavigate } from "react-router-dom";` and
`const navigate = useNavigate();` inside the component. The drawer JSX is
unchanged.

- [ ] **Step 2: RequestRow — avatar+name area navigates**

Wrap the avatar + name block (lines 22–28) in a button; action buttons stay
siblings:

```tsx
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => navigate(`/u/${profile.username}`)}
        aria-label={`View @${profile.username}'s profile`}
      >
        <ProfileAvatar profile={profile} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">@{profile.username}</span>
          {profile.display_name && (
            <span className="block truncate text-xs text-muted-foreground">
              {profile.display_name}
            </span>
          )}
        </span>
      </button>
```

Add the `useNavigate` import + hook as in Step 1.

- [ ] **Step 3: SuggestedList — same avatar+name button** (lines 39–45),
keeping `AddButton` and the dismiss ✕ as siblings. Same pattern and imports
as Step 2.

- [ ] **Step 4: ProfileSearch — same avatar+name button** (lines 42–48),
keeping `AddButton` as a sibling. Same pattern and imports as Step 2.

- [ ] **Step 5: OutTonightRow — avatar opens profile, row still flies to venue**

Replace the single outer `<button>` with a `div` wrapping two buttons: the
avatar (→ profile) and the rest of the row (→ map, existing behavior):

```tsx
    <div className="flex w-full items-center gap-3 py-2.5">
      <button
        className="relative shrink-0 rounded-full"
        onClick={() => navigate(`/u/${friend.profile.username}`)}
        aria-label={`View @${friend.profile.username}'s profile`}
      >
        <ProfileAvatar profile={friend.profile} />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card"
          aria-hidden="true"
        />
      </button>
      <button
        onClick={() => navigate("/", { state: { venueId: friend.venueId } })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {firstName} <span className="font-normal text-muted-foreground">is at</span>{" "}
            {friend.venueName}
          </span>
          <span className="block text-xs text-muted-foreground">{timeAgo(friend.checkedInAt)}</span>
        </span>
        {friend.vibe && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-xs">
            {VIBE_LABELS[friend.vibe]}
          </span>
        )}
      </button>
    </div>
```

- [ ] **Step 6: FriendsHereRow — expanded names become profile links**

Replace the expanded plain-text names (lines 43–47) with tappable chips, and
convert the outer `<button>` to a `div` + inner expand button to keep HTML
valid. Full replacement for the component's return:

```tsx
  return (
    <div className="w-full mt-3 rounded-2xl border border-border bg-card animate-fade-in">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 rounded-2xl"
      >
        <AvatarCluster
          people={here.map((f) => ({
            id: f.profile.id,
            name: f.profile.display_name || f.profile.username,
            avatarUrl: f.profile.avatar_url,
          }))}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{label}</span>
        </span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
          {here.map((f) => (
            <Link
              key={f.profile.id}
              to={`/u/${f.profile.username}`}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary/70"
            >
              {f.profile.display_name || `@${f.profile.username}`}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
```

Add `import { Link } from "react-router-dom";`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/components/social/FriendRow.tsx src/components/social/RequestRow.tsx \
  src/components/social/SuggestedList.tsx src/components/social/ProfileSearch.tsx \
  src/components/social/OutTonightRow.tsx src/components/FriendsHereRow.tsx
git commit -m "feat(profiles): tap-throughs to /u/:username from all person surfaces"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build && npm run lint
```

Expected: all exit 0 (lint may emit pre-existing warnings only — nothing new
in touched files).

- [ ] **Step 2: Live verification on the dev server** (`npm run dev`,
`localhost:8080` — auth redirects require this origin; use the real signed-in
session and drive the browser)

Matrix — all must pass:
1. Social → Your friends → tap a friend row body → their profile renders
   (avatar, name, @handle); kebab still opens the Remove/Block drawer.
2. Profile page shows "Friends ✓" for a friend; a non-friend from search
   shows "Add", tap → flips to "Requested" and a friendships row appears.
3. `/u/<own-username>` redirects to `/profile`.
4. `/u/does-not-exist` shows "No one by that handle."
5. With the second account checked in somewhere: friend's profile shows
   "Out tonight at <venue>"; tapping it lands on the map with that venue
   selected. A non-friend's profile never shows the line.
6. Edit Profile → type a bio → counter ticks to /150 → Save → reopen dialog
   shows it; `/u/<own — via second account>` renders the bio.
   (Pre-DDL: expect the friendly "Bio isn't available yet" toast instead.)
7. Tap-throughs: search result row, suggested row, request row, out-tonight
   avatar, venue-sheet FriendsHereRow expanded name chip — each opens the
   right profile; the out-tonight row body still flies the map to the venue.
8. Back button returns to the surface you came from.

- [ ] **Step 3: Report results to Colton** — matrix outcomes, any deviations,
then stop. No merge, no push without his explicit OK.
