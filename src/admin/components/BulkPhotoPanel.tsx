/**
 * Bulk venue photos: choose multiple photo files at once (via the file
 * picker or by dragging a selection of files onto the panel), review every
 * match, then write. (Folder drops are not supported — only a selection of
 * files.)
 *
 * Lives in /admin rather than scripts/ for two reasons, both checked:
 * only the publishable (anon) key exists on disk, so a CLI script could not
 * satisfy is_admin() without introducing an RLS-bypassing service-role key;
 * and the canvas re-encode is browser-only. In the browser Colton is already
 * an authenticated admin, so the existing policy does the authorising and no
 * new secret exists anywhere.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { matchFileToVenues } from "../data/photoMatch";
import { updateAdminVenue, type AdminVenueRow } from "../data/venues";
import {
  uploadVenuePhoto,
  deleteVenuePhotoByUrl,
  isAcceptedImage,
  describeFileType,
  PHOTO_ACCEPT_ATTR,
} from "@/lib/venuePhotos";

const UNASSIGNED = "__none__";

// `id` — not `fileName` — is the identity used for the React key and for
// assign(): two dropped files can share a name ("IMG_0001.jpg" is the
// entire reason this panel exists), and matching on fileName made picking a
// venue for one row silently overwrite the other.
//
// `confidence` and `candidates` are the ORIGINAL match result and are never
// mutated after staging — only `venueId` (the user's current selection)
// changes. That keeps an ambiguous file's dropdown narrowed to its real
// candidates even after Colton picks "Skip this file" and reopens it.
// `source` is per-row: it is seeded from the batch field at stage() time,
// then edited in place. Editing the batch field afterwards DOES reach back
// into already-staged rows (I3) — but only rows whose source still equals
// the batch field's previous value, i.e. rows nobody has hand-typed into.
// A row the user has edited by hand is left alone. See handleSourceChange
// below for the exact rule.
type Staged = {
  id: number;
  fileName: string;
  confidence: "exact" | "ambiguous" | "none";
  candidates: string[];
  venueId: string | null;
  file: File;
  previewUrl: string;
  source: string;
};

const BulkPhotoPanel = ({
  venues,
  onDone,
}: {
  venues: AdminVenueRow[];
  onDone: () => void;
}) => {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [source, setSource] = useState("");
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  // The batch field's value as of the last time it changed (or "" at
  // mount). Used by handleSourceChange (I3) to tell "a row whose source
  // still matches the old batch value" — i.e. never hand-edited — from a
  // row Colton typed into on purpose.
  const prevSourceRef = useRef("");

  // Kept in sync every render so the unmount-only effect below can revoke
  // whatever is staged at the moment of unmount, not whatever was staged
  // when the effect was first attached (an empty-deps effect closure would
  // otherwise capture staged = [] forever).
  const stagedRef = useRef<Staged[]>(staged);
  stagedRef.current = staged;

  // Toggling the "Bulk photos" button off unmounts this panel directly —
  // that is a third leak path alongside Clear and re-stage, since neither
  // of those handlers runs on unmount.
  useEffect(() => {
    return () => {
      stagedRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    };
  }, []);

  // Shared by both the file input and drag-and-drop — the FileList vs File[]
  // difference is just where the files came from, and both must go through
  // the same match-then-id pipeline.
  //
  // APPENDS rather than replaces (M7): the natural workflow here is several
  // small drops, typing a source after each. Earlier this replaced the
  // whole list on every stage() call, which silently threw away every
  // hand-typed source the moment a second batch of files was dropped.
  // Existing rows (and their preview URLs) are left untouched — nothing
  // displayed is revoked here, only Clear/run/unmount do that — and `id`
  // keeps coming from the same monotonic counter, so ids stay unique across
  // every stage() call for the life of the panel.
  const stage = (files: FileList | File[] | null) => {
    if (!files) return;
    setStaged((prev) => [
      ...prev,
      ...Array.from(files).map((file) => {
        const match = matchFileToVenues(file.name, venues);
        return {
          id: nextId.current++,
          fileName: match.fileName,
          confidence: match.confidence,
          candidates: match.candidates,
          venueId: match.venueId,
          file,
          previewUrl: URL.createObjectURL(file),
          // Seeded from the batch field as it stands at stage time, then
          // independent of it until handleSourceChange (I3) decides this
          // row still matches the old batch value.
          source,
        };
      }),
    ]);
    // So re-picking the same filename in a later batch still fires
    // onChange — matches the reset already done after Clear and run().
    if (fileInput.current) fileInput.current.value = "";
  };

  const clear = () => {
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const assign = (id: number, venueId: string) =>
    setStaged((s) =>
      s.map((item) =>
        item.id === id
          ? { ...item, venueId: venueId === UNASSIGNED ? null : venueId }
          : item,
      ),
    );

  const setRowSource = (id: number, value: string) =>
    setStaged((s) =>
      s.map((item) => (item.id === id ? { ...item, source: value } : item)),
    );

  // I3: the batch field only did something at stage() time — typing into it
  // after files were already staged (drag-then-type is the natural order
  // here) silently went nowhere, so the takedown-mitigation field ended up
  // empty on every row in practice. Propagate the new value only to rows
  // whose source still equals the PREVIOUS batch value: that's the signal a
  // row was never hand-edited (setRowSource would have changed it away from
  // that value). Rows Colton typed into by hand keep whatever he typed.
  const handleSourceChange = (value: string) => {
    const prev = prevSourceRef.current;
    setStaged((s) =>
      s.map((item) => (item.source === prev ? { ...item, source: value } : item)),
    );
    prevSourceRef.current = value;
    setSource(value);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Without this the browser's default is to navigate to/open the
    // dropped file instead of firing onDrop.
    e.preventDefault();
    if (running) return;
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Only clear if the pointer truly left the drop zone, not just moved
    // over a child element within it (which also fires dragleave on the
    // parent before the child's own dragenter) — matches VenueEditSheet /
    // AdminVenues; without this the highlight flickered on every child
    // boundary crossed.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (running) {
      toast.error("Still uploading this batch — try again once it finishes.");
      return;
    }
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length === 0) return;
    const images = dropped.filter((f) => isAcceptedImage(f));
    if (images.length === 0) {
      toast.error(`${describeFileType(dropped[0])} isn't an image — drop photo files instead.`);
      return;
    }
    stage(images);
  };

  const ready = staged.filter((s) => s.venueId);

  // Two staged rows can resolve to the same venue (baseName strips a
  // download counter, so "grafton.jpg" and "grafton (1).jpg" both hit "The
  // Grafton" exactly) and the run would silently let the second write win.
  // Flag it in the preview rather than block — the human decides.
  const venueHitCounts = new Map<string, number>();
  staged.forEach((s) => {
    if (s.venueId) venueHitCounts.set(s.venueId, (venueHitCounts.get(s.venueId) ?? 0) + 1);
  });
  const duplicateVenueIds = new Set(
    [...venueHitCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );

  const run = async () => {
    setRunning(true);
    let ok = 0;
    const failed: string[] = [];
    const staleFiles: string[] = [];
    const venueById = new Map(venues.map((v) => [v.id, v]));
    for (const item of ready) {
      try {
        const previousUrl = venueById.get(item.venueId!)?.image_url ?? null;
        const url = await uploadVenuePhoto(item.file, item.venueId!);
        await updateAdminVenue(item.venueId!, {
          image_url: url,
          ...(item.source.trim() ? { image_source: item.source.trim() } : {}),
        });
        ok++;
        // Keep the local snapshot current: if a second staged row targets
        // this same venue (the F3b duplicate case — flagged in the preview,
        // not blocked), its own "previous photo" lookup must see the URL
        // this row just wrote, not the stale pre-run value, or the file
        // this row just uploaded becomes an orphan nobody ever deletes.
        venueById.set(item.venueId!, { ...venueById.get(item.venueId!)!, image_url: url });
        // Only now that the row points at the new URL — mirrors
        // VenueEditSheet's save order so a failed write never 404s a live
        // photo. Re-running a batch without this accrues public orphans.
        if (previousUrl && previousUrl !== url) {
          if (!(await deleteVenuePhotoByUrl(previousUrl))) {
            staleFiles.push(venueById.get(item.venueId!)?.name ?? item.fileName);
          }
        }
      } catch (e) {
        failed.push(`${item.fileName}: ${(e as Error).message}`);
      }
    }
    setRunning(false);
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    if (fileInput.current) fileInput.current.value = "";
    toast[failed.length ? "warning" : "success"](
      `${ok} photo${ok === 1 ? "" : "s"} set${failed.length ? `, ${failed.length} failed` : ""}.`,
    );
    // Verbatim, one toast each: a bulk run that hides its failures behind a
    // count is how you end up believing 56 venues have photos when 9 do not.
    failed.forEach((f) => toast.error(f));
    // Separate from both toasts above: the save itself succeeded, but the
    // superseded file is still sitting in the public bucket.
    staleFiles.forEach((name) =>
      toast.warning(
        `${name}: the old photo could not be deleted and may still be publicly reachable at its old URL.`,
      ),
    );
    onDone();
  };

  return (
    <Card
      className={cn(
        "mb-4 p-4 transition-colors",
        dragOver && "border-dashed border-primary bg-primary/5",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={PHOTO_ACCEPT_ATTR}
          className="hidden"
          disabled={running}
          onChange={(e) => stage(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={running}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Choose photos
        </Button>
        <Input
          value={source}
          onChange={(e) => handleSourceChange(e.target.value)}
          placeholder="Default source for new files, e.g. venue Instagram"
          disabled={running}
          className="min-w-[240px] flex-1"
        />
        <span className="text-xs text-muted-foreground">
          Name each file after the venue (<code>amor-y-amargo.jpg</code>), or
          drag files onto this panel.
        </span>
      </div>

      {staged.length > 0 && (
        <>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {staged.map((item) => {
              const isDuplicateTarget = item.venueId != null && duplicateVenueIds.has(item.venueId);
              return (
                <div key={item.id} className="rounded border border-border p-2">
                  <div className="flex items-center gap-3">
                    <img src={item.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{item.fileName}</span>
                    {item.confidence === "exact" ? (
                      <span className="text-sm">
                        {venues.find((v) => v.id === item.venueId)?.name}
                      </span>
                    ) : (
                      <Select
                        value={item.venueId ?? UNASSIGNED}
                        onValueChange={(v) => assign(item.id, v)}
                        disabled={running}
                      >
                        <SelectTrigger className="w-[240px]">
                          <SelectValue placeholder="Pick a venue" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Skip this file</SelectItem>
                          {(item.candidates.length > 0
                            ? venues.filter((v) => item.candidates.includes(v.id))
                            : venues
                          ).map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                              {v.neighborhood ? ` — ${v.neighborhood}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      value={item.source}
                      onChange={(e) => setRowSource(item.id, e.target.value)}
                      placeholder="Source"
                      disabled={running}
                      className="w-[160px] flex-shrink-0"
                    />
                  </div>
                  {isDuplicateTarget && (
                    <p className="mt-1.5 flex items-center gap-1.5 pl-[60px] text-xs font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      Same venue as another staged file — last write wins if you continue.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button onClick={run} disabled={running || ready.length === 0}>
              {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload {ready.length} photo{ready.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={clear} disabled={running}>
              Clear
            </Button>
            {staged.length !== ready.length && (
              <span className="text-xs text-muted-foreground">
                {staged.length - ready.length} unmatched — assign or they&apos;re skipped.
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

export default BulkPhotoPanel;
