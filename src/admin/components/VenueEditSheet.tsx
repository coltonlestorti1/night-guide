/**
 * Edit drawer for one venue. Covers every editable `venues` column.
 *
 * Only changed fields are sent, so two admins editing different fields don't
 * clobber each other, and a save that changes nothing is a no-op rather than a
 * full-row rewrite.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ImagePlus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldRow } from "./AdminKit";
import {
  updateAdminVenue,
  EDITABLE_FIELDS,
  type AdminVenueRow,
  type VenuePatch,
} from "../data/venues";
import { uploadVenuePhoto, deleteVenuePhotoByUrl } from "@/lib/venuePhotos";
import { PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
import PhotoLightbox from "@/components/PhotoLightbox";

type Props = {
  venue: AdminVenueRow | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Sentinel for "no price set". Radix Select rejects an empty-string value. */
const NO_PRICE = "__none__";

const VenueEditSheet = ({ venue, onClose, onSaved }: Props) => {
  const [draft, setDraft] = useState<AdminVenueRow | null>(venue);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // A photo uploaded during this open session that hasn't yet been committed
  // by a successful save. Cleaned up on close (Cancel/X) or, if it wasn't
  // the value that ended up saved, right after save — so a Cancel, a second
  // pick before saving, or a pick-then-Remove never orphans a bucket file.
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // The venue this mounted sheet instance is currently showing, kept fresh
  // every render. VenueEditSheet is never remounted between venues — the
  // parent just swaps the `venue` prop — so an upload's async continuation
  // needs a way to notice the sheet moved on to someone else while it was
  // in flight. A plain closure over `venue` can't do that; a ref that's
  // reassigned on every render can.
  const latestVenueId = useRef<string | null>(null);

  useEffect(() => {
    setDraft(venue);
    setLightboxUrl(null);
  }, [venue]);

  // Hooks above run unconditionally; everything below may read `venue`.
  if (!venue || !draft) return null;

  latestVenueId.current = venue.id;

  // The photo the venue had when the sheet opened. If the draft now points
  // somewhere else, this file is superseded and gets deleted after a
  // successful save — never before.
  const supersededUrl = venue.image_url;

  const set = <K extends keyof AdminVenueRow>(key: K, value: AdminVenueRow[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const pickedForVenueId = venue.id;
    setUploading(true);
    try {
      const url = await uploadVenuePhoto(file, pickedForVenueId);
      if (latestVenueId.current !== pickedForVenueId) {
        // The sheet has since moved on to a different venue. Closing
        // mid-upload is blocked below, so this needs another path to have
        // happened — treat it as possible anyway: the upload belongs to
        // nobody's draft now, so delete it and touch no state, rather than
        // writing venue A's photo into venue B's draft via the functional
        // setDraft updater below (which reads whatever draft is current,
        // not whatever draft was current when this closure was created).
        void deleteVenuePhotoByUrl(url);
        return;
      }
      // Picking again before ever saving orphans the previous pick — clean
      // it up now rather than waiting for close. Best-effort; never awaited
      // so a slow delete can't stall the new upload from landing.
      if (pendingUploadUrl) void deleteVenuePhotoByUrl(pendingUploadUrl);
      setPendingUploadUrl(url);
      set("image_url", url);
    } catch (e) {
      // Verbatim: while the bucket is missing, the Postgres/storage message
      // names the real cause and a friendly rewrite would hide it.
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // Cancel and the sheet's own close (X / Escape / overlay click) both land
  // here. Blocked while an upload is in flight — closing mid-upload is
  // exactly what lets a later-resolving upload get attributed to whatever
  // venue the admin opens next, so it's refused outright rather than raced
  // against. Any photo uploaded this session that never made it into a
  // saved row is deleted — fire-and-forget, so a slow or failed delete
  // can't block the sheet from closing.
  const handleClose = () => {
    if (uploading) return;
    if (pendingUploadUrl) void deleteVenuePhotoByUrl(pendingUploadUrl);
    setPendingUploadUrl(null);
    onClose();
  };

  const changed: VenuePatch = {};
  for (const field of EDITABLE_FIELDS) {
    if (draft[field] !== venue[field]) {
      (changed as Record<string, unknown>)[field] = draft[field];
    }
  }
  const dirty = Object.keys(changed).length > 0;

  const coordsInvalid =
    !Number.isFinite(draft.lat) ||
    !Number.isFinite(draft.lng) ||
    Math.abs(draft.lat) > 90 ||
    Math.abs(draft.lng) > 180;

  const save = async () => {
    if (!dirty || coordsInvalid) return;
    setSaving(true);
    try {
      await updateAdminVenue(venue.id, changed);
      // Only now that the row points at the new URL. The reverse order 404s
      // the live photo if the write fails.
      let staleFileRemains = false;
      if (supersededUrl && supersededUrl !== draft.image_url) {
        if (!(await deleteVenuePhotoByUrl(supersededUrl))) staleFileRemains = true;
      }
      // A photo uploaded this session that isn't the value just saved (e.g.
      // picked, then Removed, before hitting Save) is orphaned the same way.
      if (pendingUploadUrl && pendingUploadUrl !== draft.image_url) {
        if (!(await deleteVenuePhotoByUrl(pendingUploadUrl))) staleFileRemains = true;
      }
      setPendingUploadUrl(null);
      toast.success(`Saved ${draft.name}.`);
      // Separate toast, never folded into the success one above: the save
      // itself worked, but the old photo file is still sitting in the
      // public bucket and may still be reachable at its old URL.
      if (staleFileRemains) {
        toast.warning(
          "The old photo could not be deleted and may still be publicly reachable at its old URL.",
        );
      }
      onSaved();
    } catch (e) {
      // Verbatim, not a friendly rewrite: the likely cause is the missing
      // admin UPDATE policy, and the Postgres message says so.
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pb-4">
          <SheetTitle>{venue.name}</SheetTitle>
          <SheetDescription>
            Editing the live <code>venues</code> row. Changes hit the app
            immediately.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 pb-4">
          <FieldRow
            label="Photo"
            hint="Venue-owned photos only (their Instagram or site). Not Google Maps, not press sites."
          >
            <div className="flex gap-3">
              {hasRealPhoto(draft) ? (
                <button
                  type="button"
                  onClick={() => setLightboxUrl(draft.image_url!)}
                  className="flex-shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View photo of ${draft.name}`}
                >
                  <img
                    src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-border object-cover"
                  />
                </button>
              ) : (
                <img
                  src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                  alt=""
                  className="h-20 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
                />
              )}
              <div className="flex flex-col justify-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  {draft.image_url ? "Replace" : "Add photo"}
                </Button>
                {draft.image_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading}
                    onClick={() => {
                      // Clear both — leaving image_source behind points
                      // provenance at a photo that no longer exists.
                      set("image_url", null);
                      set("image_source", null);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </FieldRow>

          <FieldRow
            label="Photo source"
            hint="Where it came from. Makes a takedown a 30-second edit."
          >
            <Input
              value={draft.image_source ?? ""}
              onChange={(e) => set("image_source", e.target.value)}
              placeholder="instagram.com/venuehandle"
            />
          </FieldRow>

          <FieldRow label="Name">
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Type">
              <Select
                value={draft.type}
                onValueChange={(v) => set("type", v as AdminVenueRow["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="club">Club</SelectItem>
                  <SelectItem value="lounge">Lounge</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Price">
              <Select
                value={draft.price ?? NO_PRICE}
                onValueChange={(v) =>
                  set("price", v === NO_PRICE ? null : (v as AdminVenueRow["price"]))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRICE}>Not set</SelectItem>
                  <SelectItem value="$">$</SelectItem>
                  <SelectItem value="$$">$$</SelectItem>
                  <SelectItem value="$$$">$$$</SelectItem>
                  <SelectItem value="$$$$">$$$$</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          <FieldRow
            label="Description"
            hint="College-aged but professional. Lead with what's distinctive. No hours or crowd claims."
          >
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Music" hint="e.g. hip-hop, house, mixed">
              <Input
                value={draft.music ?? ""}
                onChange={(e) => set("music", e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Age range" hint="Format: 21-25">
              <Input
                value={draft.age_range ?? ""}
                onChange={(e) => set("age_range", e.target.value)}
                placeholder="21-25"
              />
            </FieldRow>
          </div>

          <FieldRow label="Neighborhood">
            <Input
              value={draft.neighborhood ?? ""}
              onChange={(e) => set("neighborhood", e.target.value)}
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Latitude">
              <Input
                type="number"
                step="0.000001"
                value={Number.isFinite(draft.lat) ? draft.lat : ""}
                onChange={(e) => set("lat", Number(e.target.value))}
              />
            </FieldRow>
            <FieldRow label="Longitude">
              <Input
                type="number"
                step="0.000001"
                value={Number.isFinite(draft.lng) ? draft.lng : ""}
                onChange={(e) => set("lng", Number(e.target.value))}
              />
            </FieldRow>
          </div>
          {coordsInvalid && (
            <p className="text-xs text-destructive">
              Coordinates are out of range. The pin won&apos;t render.
            </p>
          )}

          <div className="space-y-3 rounded-lg border border-border p-3">
            {(
              [
                ["is_college_scene", "College scene"],
                ["has_rooftop", "Rooftop"],
                ["has_outdoor", "Outdoor seating"],
                ["is_active", "Active (visible in the app)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={draft[key]}
                  onCheckedChange={(v) => set(key, v)}
                />
              </div>
            ))}
          </div>

          <PhotoLightbox
            url={lightboxUrl}
            onClose={() => setLightboxUrl(null)}
            alt={draft.name}
          />
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background py-3">
          <Button
            onClick={save}
            disabled={!dirty || saving || uploading || coordsInvalid}
            className="flex-1"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dirty ? `Save ${Object.keys(changed).length} change${Object.keys(changed).length === 1 ? "" : "s"}` : "No changes"}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={saving || uploading}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VenueEditSheet;
