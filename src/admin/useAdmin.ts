/**
 * Admin role resolution.
 *
 * Reads profiles.role for the signed-in user. The column does not exist until
 * scripts/2026-07-28-admin-ddl.sql is pasted, so a missing-column error
 * (Postgres 42703) resolves to "not an admin" rather than an error state —
 * the same degrade-gracefully pattern store/auth.ts uses for bio and
 * college_slug. That is what lets this ship ahead of the DDL without
 * white-screening anything.
 */
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

export type AdminRole = "user" | "admin" | "super_admin";

export type AdminState = {
  /** Undefined until the first resolution settles. */
  role: AdminRole | undefined;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  /** True when the DDL has not been applied yet. Drives the setup hint. */
  schemaMissing: boolean;
};

/** Postgres: column does not exist. */
const UNDEFINED_COLUMN = "42703";

export function useAdmin(): AdminState {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const [role, setRole] = useState<AdminRole | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (!userId) {
      setRole(undefined);
      setSchemaMissing(false);
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setRole(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Missing column = DDL not pasted yet. Any other error is also
          // treated as "not admin": failing closed is the only safe default
          // for a permission check.
          setSchemaMissing(error.code === UNDEFINED_COLUMN);
          setRole(undefined);
        } else {
          setSchemaMissing(false);
          setRole(((data as { role?: AdminRole } | null)?.role ?? "user") as AdminRole);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  return {
    role,
    isAdmin: role === "admin" || role === "super_admin",
    isSuperAdmin: role === "super_admin",
    loading,
    schemaMissing,
  };
}
