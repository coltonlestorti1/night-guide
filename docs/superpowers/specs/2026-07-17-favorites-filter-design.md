# Favorites Filter — Design Spec (2026-07-17)

## Summary
Add a **"Saved"** toggle to the Map filter row that narrows the map + list to the
venues a user has already bookmarked. Saving already exists and works
(`store/saved.ts`, a `persist`ed localStorage zustand store; bookmark toggle in
`VenuePreview`, `BarCard`, `VenueDetail`). The gap is that there is **no way to
view only your saved venues**. This spec fills that gap and nothing more.

## Decisions locked (with Colton, 2026-07-17)
- **Storage: device-local now, sync later.** The filter rides the existing
  `useSavedStore` (localStorage, key `endz-saved`). **No Supabase, no DDL, no
  auth requirement** — works signed-out. Cross-device sync + server
  personalization are an explicit **Phase 2** (see appendix), deferred.
- **Interaction: stacks / ANDs.** "Saved" is a chip in the existing filter row
  that intersects with every other active filter (category, happy-hour, crowd,
  music, search) — e.g. "my saved Bars with happy hour now." Same model as the
  existing 🥂 happy-hour chip.

## Scope (MVP)

### 1. The chip
- Add a `{ label: "Saved", value: "saved", Icon: Bookmark }` entry to
  `PRIMARY_FILTERS` in `src/pages/MapPage.tsx`, placed next to happy-hour.
- Active/inactive styling reuses the existing chip classes (filled
  `bg-primary` when active). Always visible — it advertises the save gesture.

### 2. Behavior (mirror the happy-hour chip)
- New local state in `MapPage`: `const [savedFilter, setSavedFilter] = useState(false)`
  (exactly like `hhFilter`).
- `FilterChips` gains two props — `savedActive`, `onSaved` — mirroring
  `hhActive` / `onHappyHour`. Wire `isActive("saved")` → `savedActive` and
  `handle("saved")` → `onSaved()` (a toggle).
- Extend `displayVenues`: today it is
  `hhFilter ? venues.filter(v => hhActiveIds.has(v.id)) : venues`.
  Add a saved-id narrow so both filters compose (AND):
  when `savedFilter` is on, keep only venues whose `id` is in
  `useSavedStore.getState().ids` (read reactively via the store hook).
- Applies to **both map pins and the list** automatically, because both already
  render from `displayVenues`.

### 3. "Clear filters" / active-filter accounting
- `savedFilter` counts as an active filter: include it in the `hasFilters`
  signal so the "Clear filters" affordance appears, and clearing filters turns
  `savedFilter` off. Match whatever the happy-hour chip already does for
  consistency (keep the two local chips behaving identically).

### 4. Empty states (the only net-new UI)
- **Zero saves ever** (`useSavedStore` ids is empty) and the Saved filter is on:
  show a tailored empty state in the list/map area —
  *"No saved spots yet — tap the 🔖 on any venue to add it here."*
- **Has saves, but none match the other active filters:** reuse the existing
  *"No spots match your filters."* copy (no new UI).

### 5. Save/remove UX — unchanged
- The bookmark toggle already works everywhere; no changes required.
- *Optional, low priority:* a subtle toast on save ("Saved"). Include only if it
  is trivial; not required for acceptance.

## Out of scope — Phase 2 (needs the deferred Supabase move)
Captured so the ideas are not lost; **not** built now:
- Move saves to a Supabase per-user table (RLS, auth) for **cross-device sync**.
- Server **personalization**: weight Weekend Favorites / "Find the move" toward
  saved venues; "your saved spot is packed right now" nudges.

## Acceptance criteria
1. A "Saved" chip appears in the Map filter row.
2. Toggling it on shows only saved venues **intersected with** other active
   filters, on **both** the map and the list.
3. Toggling it off restores the prior result.
4. With zero saved venues, turning it on shows the "how to save" empty state.
5. No backend/DDL/schema changes; the feature works while signed out.
6. `tsc -p tsconfig.app.json` clean, `npm run build` clean, no new console errors.

## Non-goals / constraints
- No change to `useVenues` or any Supabase query (the narrow is client-side, like
  happy-hour). Saved ids are local, so they cannot be pushed to the server query.
- No new dependency. Reuse `lucide-react`'s `Bookmark` icon already imported in
  card components.
