/**
 * Orphaned storage sweep.
 *
 * The backstop behind every deletion path in the app. See
 * src/admin/data/storage.ts for why the read is a definer function and why
 * this page can never delete a photo someone can still see.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PageHeader,
  StatCard,
  SectionHeader,
  EmptyState,
  ErrorNote,
} from "../components/AdminKit";
import {
  deleteOrphans,
  fetchOrphanedStorage,
  formatBytes,
  type OrphanFile,
} from "../data/storage";

const BUCKET_LABEL: Record<string, string> = {
  "night-photos": "Night photos",
  avatars: "Avatars",
};

export default function AdminStorage() {
  const queryClient = useQueryClient();
  const [lastFailed, setLastFailed] = useState<OrphanFile[]>([]);

  const {
    data: orphans,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-orphaned-storage"],
    queryFn: fetchOrphanedStorage,
  });

  const files = useMemo(() => orphans ?? [], [orphans]);

  const totals = useMemo(() => {
    const byBucket = new Map<string, { count: number; bytes: number }>();
    for (const f of files) {
      const cur = byBucket.get(f.bucket) ?? { count: 0, bytes: 0 };
      byBucket.set(f.bucket, { count: cur.count + 1, bytes: cur.bytes + (f.bytes ?? 0) });
    }
    return {
      byBucket,
      bytes: files.reduce((sum, f) => sum + (f.bytes ?? 0), 0),
    };
  }, [files]);

  const sweep = useMutation({
    mutationFn: () => deleteOrphans(files),
    onSuccess: ({ removed, failed }) => {
      setLastFailed(failed);
      void queryClient.invalidateQueries({ queryKey: ["admin-orphaned-storage"] });
      if (failed.length === 0) {
        toast.success(removed === 1 ? "1 file deleted." : `${removed} files deleted.`);
      } else {
        // Never report a clean sweep when part of it failed — that is the same
        // false-success bug the report flow shipped with on 2026-08-09.
        toast.error(`${removed} deleted, ${failed.length} could not be removed.`);
      }
    },
    onError: () => toast.error("Couldn't sweep. Check that you're still signed in as an admin."),
  });

  return (
    <div>
      <PageHeader
        title="Storage"
        description="Files in the photo buckets that no row points at any more. Deleting a post or an account removes the rows; anything that slipped past the client cleanup lands here."
      />

      {error && (
        <ErrorNote>
          Couldn't load the orphan list. `list_orphaned_storage()` is admin-only — if you're
          signed in as an admin and still see this, the function may not be applied yet.
        </ErrorNote>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Orphaned files"
          value={isLoading ? "…" : files.length}
          tone={files.length > 0 ? "warn" : "default"}
          hint={files.length === 0 ? "Nothing to clean up." : "Nobody can reach these but you."}
        />
        <StatCard
          label="Wasted space"
          value={isLoading ? "…" : formatBytes(totals.bytes)}
        />
        <StatCard
          label="Buckets affected"
          value={isLoading ? "…" : totals.byBucket.size}
          hint={[...totals.byBucket.keys()].map((b) => BUCKET_LABEL[b] ?? b).join(", ") || "—"}
        />
      </div>

      <SectionHeader
        title="Orphans"
        description="Deletes are governed by a policy scoped to unreferenced paths, so a live photo cannot be removed from here."
        actions={
          files.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={sweep.isPending}>
                  {sweep.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-4 w-4" />
                  )}
                  Delete all {files.length}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {files.length} orphaned {files.length === 1 ? "file" : "files"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This frees {formatBytes(totals.bytes)}. These files belong to posts or
                    accounts that were already deleted, so nothing in the app renders them —
                    but the delete itself cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => sweep.mutate()}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      {lastFailed.length > 0 && (
        <div className="mb-3">
          <ErrorNote>
            {lastFailed.length} {lastFailed.length === 1 ? "file" : "files"} could not be
            deleted and {lastFailed.length === 1 ? "is" : "are"} still in the bucket. They stay
            listed below.
          </ErrorNote>
        </div>
      )}

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : files.length === 0 ? (
        <EmptyState title="No orphaned files" icon={HardDrive}>
          Every file in the photo buckets is still referenced by a row.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bucket</TableHead>
                <TableHead>Path</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => (
                <TableRow key={`${f.bucket}/${f.path}`}>
                  <TableCell className="whitespace-nowrap">
                    {BUCKET_LABEL[f.bucket] ?? f.bucket}
                  </TableCell>
                  <TableCell className="font-mono text-xs break-all">{f.path}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatBytes(f.bytes)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
