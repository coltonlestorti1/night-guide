/**
 * Orphaned storage — files no row points at any more.
 *
 * The backstop for deletion. Every client cleanup path is best-effort by
 * design (a storage failure must never block someone deleting their account),
 * and a crashed tab or a dropped connection leaves a file behind. Without a
 * sweep those files are PERMANENTLY undeletable: the only delete policies on
 * these buckets are "your own folder", and an account-deletion orphan has no
 * owner left to invoke them.
 *
 * Reads go through `list_orphaned_storage()`, a SECURITY DEFINER function
 * gated on is_admin(). It returns paths and sizes — never content, and never a
 * signed URL. An admin SELECT policy on night-photos would have made this page
 * trivial to build and would have handed the operator every friends-only photo
 * on the app; the deletes are instead governed by a policy scoped to paths that
 * are already unreferenced, so this screen cannot remove a live photo even if
 * it tried. See scripts/2026-08-09-deletion-retention-ddl.sql.
 */
import { getSupabase } from "@/lib/supabase";

export type OrphanFile = {
  bucket: string;
  path: string;
  createdAt: string;
  bytes: number | null;
};

type OrphanRow = {
  bucket: string;
  path: string;
  created_at: string;
  bytes: number | string | null;
};

export async function fetchOrphanedStorage(): Promise<OrphanFile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("list_orphaned_storage");
  if (error) throw error;

  return ((data ?? []) as OrphanRow[]).map((r) => ({
    bucket: r.bucket,
    path: r.path,
    createdAt: r.created_at,
    // bigint arrives as a string over PostgREST.
    bytes: r.bytes === null ? null : Number(r.bytes),
  }));
}

export type SweepResult = { removed: number; failed: OrphanFile[] };

/**
 * Delete the given files, one call per bucket.
 *
 * Reports what did NOT go rather than assuming success — the whole reason this
 * page exists is that the original code discarded the result of
 * `storage.remove()` and a failed delete was silent.
 */
export async function deleteOrphans(files: OrphanFile[]): Promise<SweepResult> {
  const supabase = getSupabase();
  if (!supabase || files.length === 0) return { removed: 0, failed: files };

  const byBucket = new Map<string, OrphanFile[]>();
  for (const f of files) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f]);

  let removed = 0;
  const failed: OrphanFile[] = [];

  for (const [bucket, group] of byBucket) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(group.map((f) => f.path));

    if (error) {
      // The error covers the whole call, so nothing in this bucket is
      // confirmed gone.
      failed.push(...group);
      continue;
    }

    const gone = new Set((data ?? []).map((o) => o.name));
    removed += group.filter((f) => gone.has(f.path)).length;
    failed.push(...group.filter((f) => !gone.has(f.path)));
  }

  return { removed, failed };
}

/** Human-readable size for a byte count that may be unknown. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
