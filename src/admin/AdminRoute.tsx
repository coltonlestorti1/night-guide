/**
 * Route guard for /admin/*.
 *
 * Three distinct outcomes on purpose, so a failure is diagnosable:
 *   signed out            -> bounced to the map
 *   signed in, not admin  -> "not authorized" screen (NOT a 404)
 *   DDL not applied yet   -> "not authorized" plus the setup hint
 *
 * A 404 here would be indistinguishable from a routing bug, which is exactly
 * the wrong thing when the most likely cause is un-pasted SQL.
 */
import { Navigate, Outlet } from "react-router-dom";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useAdmin } from "./useAdmin";

const AdminRoute = () => {
  const status = useAuthStore((s) => s.status);
  const { isAdmin, loading, schemaMissing } = useAdmin();

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "signedOut") return <Navigate to="/" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-3 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-xl font-semibold">Not authorized</h1>
          <p className="text-sm text-muted-foreground">
            This account isn&apos;t an ENDZ admin.
          </p>
          {schemaMissing && (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Setup incomplete.</span>{" "}
              The <code>profiles.role</code> column doesn&apos;t exist yet. Paste{" "}
              <code>scripts/2026-07-28-admin-ddl.sql</code> in the Supabase SQL
              editor, then reload.
            </p>
          )}
          <a href="/" className="inline-block text-sm text-primary underline">
            Back to the map
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default AdminRoute;
