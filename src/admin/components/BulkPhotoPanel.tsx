/**
 * Bulk venue photos: drop a folder, review every match, then write.
 *
 * Lives in /admin rather than scripts/ for two reasons, both checked:
 * only the publishable (anon) key exists on disk, so a CLI script could not
 * satisfy is_admin() without introducing an RLS-bypassing service-role key;
 * and the canvas re-encode is browser-only. In the browser Colton is already
 * an authenticated admin, so the existing policy does the authorising and no
 * new secret exists anywhere.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { matchFileToVenues, type PhotoMatch } from "../data/photoMatch";
import { updateAdminVenue, type AdminVenueRow } from "../data/venues";
import { uploadVenuePhoto } from "@/lib/venuePhotos";

const UNASSIGNED = "__none__";

type Staged = PhotoMatch & { file: File; previewUrl: string };

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
  const fileInput = useRef<HTMLInputElement>(null);

  const stage = (files: FileList | null) => {
    if (!files) return;
    // Revoke any previously staged previews before replacing the list —
    // otherwise re-choosing a batch (or choosing again after an earlier
    // batch) leaks one object URL per discarded file.
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged(
      Array.from(files).map((file) => ({
        ...matchFileToVenues(file.name, venues),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    );
  };

  const clear = () => {
    staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setStaged([]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const assign = (fileName: string, venueId: string) =>
    setStaged((s) =>
      s.map((item) =>
        item.fileName === fileName
          ? {
              ...item,
              venueId: venueId === UNASSIGNED ? null : venueId,
              confidence: venueId === UNASSIGNED ? "none" : "exact",
            }
          : item,
      ),
    );

  const ready = staged.filter((s) => s.venueId);

  const run = async () => {
    setRunning(true);
    let ok = 0;
    const failed: string[] = [];
    for (const item of ready) {
      try {
        const url = await uploadVenuePhoto(item.file, item.venueId!);
        await updateAdminVenue(item.venueId!, {
          image_url: url,
          ...(source.trim() ? { image_source: source.trim() } : {}),
        });
        ok++;
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
    onDone();
  };

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => stage(e.target.files)}
        />
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Choose photos
        </Button>
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source for this batch, e.g. venue Instagram"
          className="min-w-[240px] flex-1"
        />
        <span className="text-xs text-muted-foreground">
          Name each file after the venue: <code>amor-y-amargo.jpg</code>
        </span>
      </div>

      {staged.length > 0 && (
        <>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {staged.map((item) => (
              <div key={item.fileName} className="flex items-center gap-3 rounded border border-border p-2">
                <img src={item.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm">{item.fileName}</span>
                {item.confidence === "exact" ? (
                  <span className="text-sm">
                    {venues.find((v) => v.id === item.venueId)?.name}
                  </span>
                ) : (
                  <Select
                    value={item.venueId ?? UNASSIGNED}
                    onValueChange={(v) => assign(item.fileName, v)}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Pick a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Skip this file</SelectItem>
                      {(item.confidence === "ambiguous"
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
              </div>
            ))}
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
