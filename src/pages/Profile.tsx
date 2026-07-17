import { useState } from "react";
import { Link } from "react-router-dom";
import { useConfigStore } from "@/store/config";
import { useAuthStore } from "@/store/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, Ghost, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const Profile = () => {
  const { status, session, profile, signInWithGoogle, signOut, setGhostMode } = useAuthStore();
  const [signingIn, setSigningIn] = useState(false);

  const handleGhostToggle = async (next: boolean) => {
    try {
      await setGhostMode(next);
    } catch {
      toast.error("Couldn't update ghost mode. Try again.");
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    await signInWithGoogle();
    // OAuth redirects away; if it didn't (config missing), release the button
    setTimeout(() => setSigningIn(false), 4000);
  };

  const meta = session?.user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string } | undefined;
  const displayName = profile?.display_name || meta?.full_name || meta?.name || "";
  const avatarUrl = profile?.avatar_url || meta?.avatar_url || meta?.picture || "";

  return (
    <section className="relative container pt-6 pb-24 max-w-lg">
      {/* Ambient light spill — brand purple, echoing /join */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-12 h-56 opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(ellipse 70% 100% at 18% 0%, hsl(var(--primary)) 0%, transparent 65%)" }}
      />

      <header className="relative mb-6 animate-fade-in">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          You on the map
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Profile</h1>
      </header>

      {status === "loading" ? (
        <div className="relative glass rounded-3xl overflow-hidden">
          <Skeleton className="h-20 w-full rounded-none" />
          <div className="p-6 pt-0">
            <Skeleton className="h-20 w-20 rounded-full -mt-10 ring-4 ring-card" />
            <div className="space-y-2 mt-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ) : status === "signedOut" ? (
        <div className="relative glass rounded-3xl p-8 text-center animate-slide-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <MapPin className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-bold">
            Find out where your friends are tonight.
          </h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Sign in to check in, add friends, and show up on the map.
          </p>
          <Button
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full h-12 rounded-xl text-base font-semibold shadow-glow"
          >
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </Button>
        </div>
      ) : (
        <div className="relative glass rounded-3xl overflow-hidden animate-slide-up">
          {/* Cover band — the ENDZ wordmark gradient */}
          <div className="relative h-20 bg-gradient-to-r from-primary to-rose-400">
            <span
              className="absolute right-4 top-3 font-display font-bold tracking-tight text-white/30 select-none"
              aria-hidden="true"
            >
              ENDZ
            </span>
          </div>
          <div className="p-6 pt-0">
            <Avatar className="h-20 w-20 -mt-10 ring-4 ring-card shadow-float">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-xl font-semibold bg-primary-soft text-primary">
                {(displayName || "?").slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 mt-3">
              <div className="font-display text-xl font-bold truncate">{displayName || "You"}</div>
              {profile?.username && (
                <div className="text-sm text-muted-foreground truncate">@{profile.username}</div>
              )}
            </div>

            <div className="flex items-start gap-3 mt-5 rounded-2xl bg-secondary/60 p-4">
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
                aria-label="Ghost mode"
                className="mt-1.5"
              />
            </div>

            <Button onClick={signOut} variant="secondary" className="w-full h-11 rounded-xl mt-4">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      )}

      <DevSettings />

      <div className="mt-6 text-center text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        <span className="mx-1.5">·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
      </div>
    </section>
  );
};

export default Profile;
