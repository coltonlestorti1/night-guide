/**
 * Admin chrome. Desktop-first by design — this is an operator tool used at a
 * desk, the opposite of the consumer app's one-handed-in-a-dark-bar rule.
 * Narrow screens still work (the rail collapses to a scrolling top strip)
 * but nothing here is optimized for them.
 */
import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { ADMIN_NAV, ADMIN_NAV_DEFERRED } from "./nav";
import { useAdmin } from "./useAdmin";

const AdminLayout = () => {
  const profile = useAuthStore((s) => s.profile);
  const { role } = useAdmin();

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-border bg-background lg:h-screen lg:w-60 lg:border-b-0 lg:border-r lg:sticky lg:top-0">
          <div className="flex items-center justify-between p-4 lg:block">
            <div>
              <div className="font-display text-lg font-bold tracking-tight text-primary">
                ENDZ
              </div>
              <div className="text-xs text-muted-foreground">Admin</div>
            </div>
            <NavLink
              to="/"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:mt-3"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to app
            </NavLink>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3">
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:block">
            <div className="px-6 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Not built yet
            </div>
            <nav className="flex flex-col gap-1 px-3">
              {ADMIN_NAV_DEFERRED.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground/60 hover:bg-muted/60 hover:text-muted-foreground",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {profile && (
            <div className="hidden border-t border-border px-6 py-4 text-xs text-muted-foreground lg:block">
              <div className="font-medium text-foreground">@{profile.username}</div>
              <div>{role === "super_admin" ? "Super admin" : "Admin"}</div>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
