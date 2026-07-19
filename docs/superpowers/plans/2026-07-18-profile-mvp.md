# Profile MVP (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the barebones Profile page into the identity + settings hub approved in §14 (Decision Log 2026-07-18): edit profile (display name / username / photo upload), saved spots, age preference, privacy and account sections.

**Architecture:** Extend the zustand auth store with an `updateProfile` action; add a small avatar-upload lib (client-side downscale → Supabase Storage `avatars` bucket); extract shared username validation out of PickUsername; rebuild `Profile.tsx` as a sectioned settings page with an Edit Profile dialog. No `profiles` schema change; the only Supabase change is the avatars bucket (DDL already recorded in `endz-schema.sql`, Colton pastes).

**Tech Stack:** Vite + React + TS, zustand, shadcn/ui (Dialog, Input, Switch), Supabase JS (Storage), Tailwind. No test runner exists in this repo — each task's verify cycle is `npx tsc --noEmit -p tsconfig.app.json` (bare `npx tsc` is a silent no-op) plus live verification on the dev server at the end.

## Global Constraints

- Branch: `feat/profile-mvp`, merged to main `--no-ff` after review (Colton pre-authorized push to main this session).
- Copy rules: direct, casual, human; no banned marketing phrases (see `~/Documents/endz/CLAUDE.md`).
- Legal contact for delete/report mailtos: `clsneaks01@gmail.com` (Decision Log 2026-07-17).
- Username rules: `/^[a-z0-9_]{3,20}$/`, uniqueness via `profiles.username` unique constraint (error code `23505`), changeable freely.
- Avatar uploads: bucket `avatars`, path `<uid>/avatar-<timestamp>.jpg`, client downscales to ≤512px JPEG. Upload must fail with a friendly toast (not a crash) while the bucket doesn't exist yet.
- Postponed (do NOT build): bio, viewable-by-friends profile, notification settings, granular visibility, connected accounts, username cooldowns, self-serve deletion.

---

### Task 1: `updateProfile` store action + shared username lib

**Files:**
- Modify: `src/store/auth.ts`
- Create: `src/lib/username.ts`
- Modify: `src/pages/PickUsername.tsx` (import from the new lib instead of defining locally)

**Interfaces:**
- Produces: `updateProfile(patch: Partial<Pick<Profile, "display_name" | "username" | "avatar_url">>): Promise<void>` on the auth store (optimistic, reverts + rethrows on error).
- Produces: `USERNAME_RE`, `suggestUsername(email)` from `src/lib/username.ts`.

- [ ] **Step 1: Create `src/lib/username.ts`** — move `USERNAME_RE` and `suggestUsername` verbatim from `PickUsername.tsx`:

```ts
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

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
```

- [ ] **Step 2: Point `PickUsername.tsx` at the lib** — delete its local `USERNAME_RE` const and `suggestUsername` export, add `import { USERNAME_RE, suggestUsername } from "@/lib/username";`. Check nothing else imported `suggestUsername` from the page (`grep -rn "from \"@/pages/PickUsername\"" src`).

- [ ] **Step 3: Add `updateProfile` to `src/store/auth.ts`** — add to the `AuthState` interface: `updateProfile: (patch: Partial<Pick<Profile, "display_name" | "username" | "avatar_url">>) => Promise<void>;` and implement following the `setGhostMode` optimistic pattern:

```ts
updateProfile: async (patch) => {
  const supabase = getSupabase();
  const { session, profile } = get();
  if (!supabase || !session || !profile) throw new Error("Not signed in");
  const prev = profile;
  set({ profile: { ...profile, ...patch } });
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", session.user.id);
  if (error) {
    set({ profile: prev });
    throw error;
  }
},
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit -p tsconfig.app.json` → 0 errors.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(profile): updateProfile store action + shared username lib"`

### Task 2: Avatar upload lib

**Files:**
- Create: `src/lib/avatarUpload.ts`

**Interfaces:**
- Consumes: `getSupabase()` from `@/lib/supabase`.
- Produces: `uploadAvatar(file: File, userId: string): Promise<string>` — downscales, uploads, deletes older avatar files, returns the public URL. Throws on any failure (caller toasts).

- [ ] **Step 1: Write `src/lib/avatarUpload.ts`:**

```ts
import { getSupabase } from "@/lib/supabase";

const MAX_EDGE = 512;

/** Downscale to ≤512px JPEG so we never store multi-MB originals. */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      0.85,
    ),
  );
}

/**
 * Upload a new avatar to avatars/<uid>/avatar-<ts>.jpg, remove older files in
 * the user's folder (timestamped names dodge CDN caching), return public URL.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Not connected");
  const blob = await downscale(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (upErr) throw upErr;
  // Best-effort cleanup of previous avatars; never fail the upload over it.
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const stale = (files ?? [])
      .filter((f) => `${userId}/${f.name}` !== path)
      .map((f) => `${userId}/${f.name}`);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } catch {
    /* ignore */
  }
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit -p tsconfig.app.json` → 0 errors.
- [ ] **Step 3: Commit** — `git commit -am "feat(profile): avatar upload lib (downscale + storage + cleanup)"`

### Task 3: Edit Profile dialog

**Files:**
- Create: `src/components/EditProfileDialog.tsx`

**Interfaces:**
- Consumes: `updateProfile` (Task 1), `uploadAvatar` (Task 2), `USERNAME_RE` (Task 1), shadcn `Dialog`/`Input`/`Button`/`Avatar`, `toast` from sonner.
- Produces: `<EditProfileDialog open onOpenChange />` — controlled dialog editing display name, username (debounced availability, skipped when unchanged), and photo.

- [ ] **Step 1: Write the component.** Behavior spec:
  - Fields initialized from `profile` when the dialog opens (`useEffect` on `open`).
  - Username: lowercase-forced input; availability states `idle | invalid | checking | available | taken` copied from PickUsername's debounced pattern (400ms), except a value equal to the current `profile.username` is always `idle`/valid and never checked.
  - Photo: avatar preview + hidden `<input type="file" accept="image/*">`; picking a file uploads immediately via `uploadAvatar` then `updateProfile({ avatar_url })`, with a busy spinner and `toast.error("Couldn't upload that photo. Try again.")` on failure (covers bucket-not-created-yet).
  - Save: only sends changed fields; on `23505` sets the taken state with "Someone just grabbed that one — try another."; other errors `toast.error`. Success closes the dialog + `toast.success("Profile updated.")`.
  - Save disabled while checking/taken/invalid or nothing changed.

- [ ] **Step 2: Verify** — tsc clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(profile): edit-profile dialog (name, username, photo)"`

### Task 4: Saved spots section

**Files:**
- Create: `src/components/SavedSpotsList.tsx`

**Interfaces:**
- Consumes: `useSavedStore` (`ids: string[]`), `useVenues({})` (`Venue[]` with `id/title/neighborhood/image_url/category`), `useNavigate`.
- Produces: `<SavedSpotsList />` — self-contained section body listing saved venues; rows navigate to `/venue/:id`; empty state when no saves.

- [ ] **Step 1: Write the component.** Filter `useVenues({}).data` to `ids` (preserve save order: map ids → venue). Row = 44px thumb (`image_url` with category-icon fallback), title, neighborhood, chevron. Empty state: bookmark icon + "No saved spots yet." + "Tap the bookmark on any venue to save it for later."
- [ ] **Step 2: Verify** — tsc clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(profile): saved spots list"`

### Task 5: Profile page rework (sections)

**Files:**
- Modify: `src/pages/Profile.tsx`

**Interfaces:**
- Consumes: Tasks 3–4 components, `AGE_BANDS/getStoredAgeBand/storeAgeBand` from `@/lib/agePref`.

- [ ] **Step 1: Restructure the signed-in view** into sections, keeping the existing glass identity card + cover band and the signed-out/loading states as-is:
  1. **Identity card** (existing) + "Edit Profile" button → opens `EditProfileDialog`.
  2. **Saved spots** — section header + `<SavedSpotsList />`.
  3. **Preferences** — "Your age range · sharpens your picks" + `AGE_BANDS` chip row (selected = stored band; tap = `storeAgeBand`, local state for immediate paint).
  4. **Privacy** — ghost-mode tile (existing markup moves here) + Privacy/Terms links.
  5. **Account & support** — "Report a problem" (`mailto:clsneaks01@gmail.com?subject=ENDZ%20problem%20report`), "Delete my account" (`mailto:clsneaks01@gmail.com?subject=Delete%20my%20ENDZ%20account`, destructive styling, sublabel "We'll confirm by email and remove your data."), Sign out.
  6. `DevSettings` stays at the bottom, unchanged.
  - Section style: match existing glass/rounded-2xl/3xl vocabulary and the app's uppercase-tracking section labels; big tap targets.
- [ ] **Step 2: Verify** — tsc clean + `npm run build` succeeds.
- [ ] **Step 3: Commit** — `git commit -am "feat(profile): sectioned profile hub (saved, prefs, privacy, account)"`

### Task 6: Live verification + review + merge + push

- [ ] **Step 1:** Dev server (`npm run dev`, port 8080 — OAuth redirects target localhost:8080) and live-verify signed-in flows with the real session: edit display name persists after reload; username change (to a new handle + revert) with availability UI, duplicate rejected; photo upload → appears on Profile (bucket pending → verify friendly toast path instead); saved spots list matches map Saved filter, tap navigates; age chip persists + reflected in Weekend Favorites "Tuned for" pill; ghost toggle still works in new location; mailtos open prefilled; sign out/in.
- [ ] **Step 2:** Mobile-width pass (390px) — no overflow, tap targets ≥44px.
- [ ] **Step 3:** `/code-review` on the branch diff; fix findings.
- [ ] **Step 4:** Merge `feat/profile-mvp` → main `--no-ff`, push (pre-authorized), update tracker (§14 → SHIPPED phase 1 + Decision Log) + session handoff.
