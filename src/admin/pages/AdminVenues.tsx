/**
 * Venue management — edit all 56 venues without touching code or SQL.
 *
 * Writes go through the admin UPDATE policy in
 * scripts/2026-07-28-admin-ddl.sql. Until that is pasted every save fails
 * loudly; that is intentional, because a silent no-op write is the exact bug
 * class this project already hit once.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, MapPin, Store, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState, ErrorNote } from "../components/AdminKit";
import { fetchAdminVenues, updateAdminVenue, type AdminVenueRow } from "../data/venues";
import VenueEditSheet from "../components/VenueEditSheet";
import BulkPhotoPanel from "../components/BulkPhotoPanel";
import { uploadVenuePhoto, deleteVenuePhotoByUrl } from "@/lib/venuePhotos";
import { PLACEHOLDER, hasRealPhoto } from "@/lib/venueImages";
import PhotoLightbox from "@/components/PhotoLightbox";

type ActiveFilter = "all" | "active" | "dormant" | "no photo";

// Mirrors the file input's `accept` attribute used elsewhere in admin — a
// drop isn't gated by the browser the way <input accept> is, so dropped
// files need the same filtering applied by hand.
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const AdminVenues = () => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [editing, setEditing] = useState<AdminVenueRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState("");
  // The row currently under a drag — highlighted so the drop target is
  // unmistakable before release, the main guard against a mis-drop onto the
  // wrong venue.
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  // Keyed by venue id, not a single boolean — multiple rows can each have a
  // drop-upload in flight at once.
  const [uploadingRowIds, setUploadingRowIds] = useState<Set<string>>(new Set());
  // True whenever a drag is somewhere over the table body, even between two
  // rows (dragleave on the old row and dragover on the new one can land in
  // separate renders) — see the table-level handlers below. Combined with
  // uploadingRowIds it drives `isFrozen`.
  const [tableDragActive, setTableDragActive] = useState(false);

  const configured = Boolean(getSupabase());

  // CRITICAL (C1): the venue under the cursor between `dragover` and `drop`
  // must never change, or a drop writes the photo to the WRONG venue. The
  // "no photo" filter workflow is: drop file 1 on row A, the upload takes
  // seconds, refetch() fires, row A now has a photo so the filter removes
  // it, every row below shifts up one slot — and if the admin is already
  // hovering row B with file 2, the element under the unmoved cursor is now
  // row C. The drop lands on C's venue, silently. refetchOnWindowFocus
  // (default true) is a second trigger for the same reorder on alt-tab.
  // Freezing the rendered list AND suppressing refetch for the same window
  // closes both paths at once.
  const isFrozen = tableDragActive || dragOverRowId !== null || uploadingRowIds.size > 0;

  // A refetch requested while frozen is deferred rather than dropped —
  // flushed once dragging/uploading is fully idle (see the effect below).
  const pendingRefetchRef = useRef(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-venues"],
    queryFn: fetchAdminVenues,
    enabled: configured,
    // Alt-tabbing back from Finder mid-drag is a second way to trigger the
    // same reorder-under-cursor bug as an in-flight upload's refetch — kill
    // focus refetching for the same window we're already freezing for.
    refetchOnWindowFocus: !isFrozen,
  });

  useEffect(() => {
    if (!isFrozen && pendingRefetchRef.current) {
      pendingRefetchRef.current = false;
      refetch();
    }
  }, [isFrozen, refetch]);

  // Use this instead of calling refetch() directly from any row-drop path —
  // it defers the fetch instead of letting it land mid-drag and reorder the
  // list under a still-moving cursor.
  const safeRefetch = () => {
    if (isFrozen) {
      pendingRefetchRef.current = true;
      return;
    }
    refetch();
  };

  const venues = useMemo(() => {
    const rows = data ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((v) => {
      if (activeFilter === "active" && !v.is_active) return false;
      if (activeFilter === "dormant" && v.is_active) return false;
      if (activeFilter === "no photo" && v.image_url) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.neighborhood ?? "").toLowerCase().includes(q) ||
        (v.music ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, activeFilter]);

  // The other half of C1: even with refetch suppressed, `venues` above is
  // still recomputed from whatever `data` currently is. Freeze the actual
  // rendered array too, so the DOM rows (and the venue objects the row
  // handlers close over) cannot move or change identity mid-drag. Only
  // re-sync the frozen copy once nothing is dragging or uploading.
  const frozenVenuesRef = useRef<AdminVenueRow[]>(venues);
  if (!isFrozen) {
    frozenVenuesRef.current = venues;
  }
  const displayVenues = isFrozen ? frozenVenuesRef.current : venues;

  const counts = useMemo(() => {
    const rows = data ?? [];
    return {
      all: rows.length,
      active: rows.filter((v) => v.is_active).length,
      dormant: rows.filter((v) => !v.is_active).length,
      "no photo": rows.filter((v) => !v.image_url).length,
    };
  }, [data]);

  // Fast path for photographing all 55+ venues: drop an image straight onto
  // a table row and it's uploaded and saved to THAT venue immediately, no
  // sheet, no Save step. Order below is non-negotiable — the row write must
  // land before the superseded photo is deleted, or a failed write 404s a
  // live photo.
  const handleRowDragOver = (e: React.DragEvent<HTMLTableRowElement>, venueId: string) => {
    // Without this the browser's default is to navigate to the dropped
    // image instead of firing onDrop.
    e.preventDefault();
    if (uploadingRowIds.has(venueId)) return;
    setDragOverRowId(venueId);
  };

  const handleRowDragLeave = (e: React.DragEvent<HTMLTableRowElement>, venueId: string) => {
    e.preventDefault();
    // Only clear if the pointer truly left the row, not just moved over a
    // child cell within it (which also fires dragleave on the row before
    // the child's own dragenter).
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragOverRowId((id) => (id === venueId ? null : id));
  };

  // Belt-and-suspenders for `isFrozen`: `dragOverRowId` alone can, in
  // principle, pass through a null in between "leave row A" and "enter row
  // B" if the browser ever delivers those as separate renders. Tracking
  // drag-over-the-table-as-a-whole means the frozen list stays frozen across
  // that gap too, not just while a specific row is highlighted.
  const handleTableDragOver = (e: React.DragEvent<HTMLTableSectionElement>) => {
    e.preventDefault();
    setTableDragActive(true);
  };

  const handleTableDragLeave = (e: React.DragEvent<HTMLTableSectionElement>) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setTableDragActive(false);
  };

  const handleRowDrop = (e: React.DragEvent<HTMLTableRowElement>, venue: AdminVenueRow) => {
    e.preventDefault();
    // A drop event never fires a click, so this can't and doesn't stop the
    // row's onClick — there's no click to stop. What it stops is this same
    // drop event bubbling to any ancestor drop handler (a page-level
    // catch-all, if one is ever added) and being processed a second time.
    e.stopPropagation();
    setDragOverRowId(null);
    setTableDragActive(false);
    if (uploadingRowIds.has(venue.id)) {
      toast.error(`${venue.name} is still uploading — try again once it finishes.`);
      return;
    }
    const dropped = Array.from(e.dataTransfer.files);
    const image = dropped.find((f) => ACCEPTED_IMAGE_TYPES.has(f.type));
    if (!image) {
      toast.error("Only JPEG, PNG, and WebP images can be dropped here.");
      return;
    }

    const previousUrl = venue.image_url;
    setUploadingRowIds((ids) => new Set(ids).add(venue.id));

    void (async () => {
      try {
        const url = await uploadVenuePhoto(image, venue.id);
        await updateAdminVenue(venue.id, { image_url: url });
        // Only now that the row points at the new URL — the reverse order
        // 404s the live photo if the write fails.
        if (previousUrl && previousUrl !== url) {
          if (!(await deleteVenuePhotoByUrl(previousUrl))) {
            toast.warning(
              `${venue.name}: the old photo could not be deleted and may still be publicly reachable at its old URL.`,
            );
          }
        }
        toast.success(`Photo set on ${venue.name}`, {
          action: {
            label: "Add source",
            // Must be the just-updated venue, not the one captured before
            // the upload (I2): that stale object still has the OLD
            // image_url, whose storage file this upload just superseded and
            // deleted. Opening the sheet on it renders a broken image, and
            // an admin who reads that as "the upload failed" can hit Remove
            // + Save and wipe the photo they just added.
            onClick: () => setEditing({ ...venue, image_url: url }),
          },
        });
        safeRefetch();
      } catch (err) {
        // Verbatim: the real cause is usually a missing storage/DB policy
        // and the raw Postgres/storage message names it.
        toast.error((err as Error).message);
      } finally {
        setUploadingRowIds((ids) => {
          const next = new Set(ids);
          next.delete(venue.id);
          return next;
        });
      }
    })();
  };

  return (
    <>
      <PageHeader
        title="Venues"
        description="Every column the app reads, editable here. Adding and removing venues stays a seed-file operation — those need research behind them."
      />

      {!configured && (
        <ErrorNote>
          Supabase isn&apos;t configured in this environment, so there are no venues
          to load. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </ErrorNote>
      )}

      {error && (
        <ErrorNote>
          Couldn&apos;t load venues: {(error as Error).message}
        </ErrorNote>
      )}

      {configured && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, neighborhood, music"
                className="pl-9"
              />
            </div>
            {(["all", "active", "dormant", "no photo"] as const).map((f) => (
              <Button
                key={f}
                variant={activeFilter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(f)}
                className="capitalize"
              >
                {f}
                <span className="ml-1.5 tabular-nums opacity-70">{counts[f]}</span>
              </Button>
            ))}
            <Button variant={bulkOpen ? "default" : "outline"} size="sm" onClick={() => setBulkOpen((b) => !b)}>
              Bulk photos
            </Button>
          </div>

          {bulkOpen && (
            <BulkPhotoPanel venues={data ?? []} onDone={() => safeRefetch()} />
          )}

          {isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Loading venues…
            </Card>
          ) : displayVenues.length === 0 ? (
            <EmptyState title="No venues match" icon={Store}>
              {counts.all === 0
                ? "The venues table came back empty. Check that the Supabase project is awake — the free tier pauses after 7 days of no traffic."
                : "Try a different search or filter."}
            </EmptyState>
          ) : (
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14"><span className="sr-only">Photo</span></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Music</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Traits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody onDragOver={handleTableDragOver} onDragLeave={handleTableDragLeave}>
                  {displayVenues.map((v) => (
                    <TableRow
                      key={v.id}
                      className={cn(
                        "cursor-pointer",
                        dragOverRowId === v.id &&
                          "bg-primary/10 outline outline-2 outline-dashed outline-primary outline-offset-[-2px]",
                      )}
                      onClick={() => setEditing(v)}
                      onDragOver={(e) => handleRowDragOver(e, v.id)}
                      onDragLeave={(e) => handleRowDragLeave(e, v.id)}
                      onDrop={(e) => handleRowDrop(e, v)}
                    >
                      <TableCell>
                        {uploadingRowIds.has(v.id) ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : hasRealPhoto(v) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              // The row's onClick opens the edit sheet.
                              e.stopPropagation();
                              setLightboxUrl(v.image_url!);
                              setLightboxAlt(v.name);
                            }}
                            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`View photo of ${v.name}`}
                          >
                            <img
                              src={v.image_url!}
                              alt=""
                              className="h-10 w-10 rounded object-cover"
                            />
                          </button>
                        ) : (
                          <img
                            src={PLACEHOLDER[v.type] || PLACEHOLDER.bar}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {v.name}
                          {(!Number.isFinite(v.lat) || (v.lat === 0 && v.lng === 0)) && (
                            <MapPin className="h-3.5 w-3.5 text-amber-600" />
                          )}
                        </div>
                        {v.neighborhood && (
                          <div className="text-xs text-muted-foreground">
                            {v.neighborhood}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">{v.type}</TableCell>
                      <TableCell>{v.price ?? "—"}</TableCell>
                      <TableCell className="max-w-[160px] truncate">
                        {v.music ?? "—"}
                      </TableCell>
                      <TableCell>{v.age_range ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {v.is_college_scene && <Badge variant="secondary">College</Badge>}
                          {v.has_rooftop && <Badge variant="secondary">Rooftop</Badge>}
                          {v.has_outdoor && <Badge variant="secondary">Outdoor</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.is_active ? "default" : "outline"}>
                          {v.is_active ? "Active" : "Dormant"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(v);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <VenueEditSheet
        venue={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          safeRefetch();
        }}
      />
      <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} alt={lightboxAlt} />
    </>
  );
};

export default AdminVenues;
