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
import { PLACEHOLDER } from "@/lib/venueImages";

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
  // The photo the venue had when the sheet opened. If the draft now points
  // somewhere else, this file is superseded and gets deleted after a
  // successful save — never before.
  const supersededUrl = venue.image_url;

  useEffect(() => setDraft(venue), [venue]);

  if (!venue || !draft) return null;

  const set = <K extends keyof AdminVenueRow>(key: K, value: AdminVenueRow[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("image_url", await uploadVenuePhoto(file, venue.id));
    } catch (e) {
      // Verbatim: while the bucket is missing, the Postgres/storage message
      // names the real cause and a friendly rewrite would hide it.
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
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
      if (supersededUrl && supersededUrl !== draft.image_url) {
        await deleteVenuePhotoByUrl(supersededUrl);
      }
      toast.success(`Saved ${draft.name}.`);
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
    <Sheet open onOpenChange={(open) => !open && onClose()}>
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
              <img
                src={draft.image_url || PLACEHOLDER[draft.type] || PLACEHOLDER.bar}
                alt=""
                className="h-20 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
              />
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
                    onClick={() => set("image_url", null)}
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
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VenueEditSheet;
