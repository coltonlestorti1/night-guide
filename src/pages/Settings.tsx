/**
 * Settings — everything that used to sit underneath the Activity feed on
 * /profile.
 *
 * A page rather than a sheet, even though a hamburger conventionally fronts a
 * slide-in panel: account deletion needs a stable, deep-linkable path for
 * App Store review, and the back button has to behave. Same reasoning that put
 * /friends and /lists on real routes.
 *
 * Every row here moved verbatim from Profile.tsx. Nothing changed on the way
 * across except its address.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Flag, Ghost, LogOut } from "lucide-react";
import { useConfigStore } from "@/store/config";
import { useAuthStore } from "@/store/auth";
import SaveVisibilityRow from "@/components/SaveVisibilityRow";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL } from "@/lib/constants";

/** Uppercase-tracking section label, matching the app's header vocabulary. */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
    {children}
  </p>
);

/** Developer-only config (API base URL, Supabase overrides). */
const DevSettings = () => {
  const { apiBaseUrl, supabaseUrl, supabaseAnonKey, setConfig } = useConfigStore();
  const [api, setApi] = useState(apiBaseUrl ?? "");
  const [sUrl, setSUrl] = useState(supabaseUrl ?? "");
  const [sAnon, setSAnon] = useState(supabaseAnonKey ?? "");
  const [open, setOpen] = useState(false);

  const save = () =>
    setConfig({
      apiBaseUrl: api || undefined,
      supabaseUrl: sUrl || undefined,
      supabaseAnonKey: sAnon || undefined,
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-10">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        Developer settings
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-4 max-w-2xl">
        <div className="space-y-2">
          <label className="text-sm font-medium">Public API Base URL</label>
          <Input placeholder="https://api.yourdomain.com" value={api} onChange={(e) => setApi(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase URL</label>
          <Input placeholder="https://xyzcompany.supabase.co" value={sUrl} onChange={(e) => setSUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Supabase Publishable Key</label>
          <Input placeholder="sb_publishable_..." value={sAnon} onChange={(e) => setSAnon(e.target.value)} />
        </div>
        <div>
          <Button onClick={save} variant="secondary" size="sm">Save</Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const Settings = () => {
  const navigate = useNavigate();
  const { status, profile, signOut, setGhostMode } = useAuthStore();

  // Disabled while in flight. The store's sequence guard keeps a stale
  // response from repainting the toggle, but it cannot control which write
  // lands last in the DATABASE — and "older write wins" can leave the switch
  // reading hidden while the policies still see false. One request at a time
  // removes that possibility instead of trying to reconcile it.
  const [ghostBusy, setGhostBusy] = useState(false);

  const handleGhostToggle = async (next: boolean) => {
    setGhostBusy(true);
    try {
      await setGhostMode(next);
    } catch {
      toast.error("Couldn't update ghost mode. Try again.");
    } finally {
      setGhostBusy(false);
    }
  };

  const back = (
    <Button
      variant="ghost"
      size="sm"
      className="mb-4 -ml-2 rounded-xl text-muted-foreground"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
    >
      <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Back
    </Button>
  );

  return (
    <section className="container pt-6 pb-24 max-w-lg">
      {back}

      <header className="mb-2 animate-fade-in">
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
      </header>

      {/* Signed out has no settings to show — and no sign-out to offer. The
          profile page owns the sign-in pitch, so send them there rather than
          rendering a second, weaker copy of it. */}
      {status !== "signedIn" ? (
        <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <p className="font-display text-lg font-bold">Sign in to change your settings.</p>
          <Button asChild className="mt-4 h-11 rounded-xl px-6">
            <Link to="/profile">Go to profile</Link>
          </Button>
        </div>
      ) : (
        <>
          <SectionLabel>Privacy</SectionLabel>
          <div className="flex items-start gap-3 glass rounded-2xl p-4">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                profile?.ghost_mode
                  ? "bg-primary-soft text-primary"
                  : "bg-card text-muted-foreground border border-border",
              )}
            >
              <Ghost className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">Ghost mode</div>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, your check-ins won't show to your friends.
              </p>
            </div>
            <Switch
              checked={!!profile?.ghost_mode}
              onCheckedChange={handleGhostToggle}
              disabled={ghostBusy}
              aria-label="Ghost mode"
              className="mt-1.5"
            />
          </div>

          <SaveVisibilityRow />

          <SectionLabel>Account &amp; support</SectionLabel>
          <div className="glass rounded-2xl divide-y divide-border/60 overflow-hidden">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("ENDZ problem report")}`}
              className="flex items-center gap-3 p-4 text-sm font-medium transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <Flag className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Report a problem
            </a>
            <DeleteAccountDialog username={profile?.username ?? ""} />
            <button
              type="button"
              onClick={signOut}
              className="flex w-full items-center gap-3 p-4 text-sm font-medium text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Sign out
            </button>
          </div>

          <DevSettings />
        </>
      )}

      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        <span className="mx-1.5">·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
      </div>
    </section>
  );
};

export default Settings;
