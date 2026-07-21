/**
 * /p/:token — the public plan page (§21). Dark, mobile-first, fully
 * functional signed-out (pre-OAuth-publish this is the only surface real
 * people can use). All data comes from the plan-guest Edge Function; this
 * page never queries Supabase tables. Signed-in visitors RSVP as
 * themselves; guests RSVP with a name and can change their answer via the
 * locally-stored guest secret. Cancelled/expired plans render a graceful
 * "this one's a wrap" state.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowRight, CalendarClock, MapPin, Moon, Navigation } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SIGNUP_LIVE } from "@/lib/constants";
import { useAuthStore } from "@/store/auth";
import { directionsUrl } from "@/lib/directions";
import { PlanRsvpValue } from "@/lib/plans";
import {
  PlanGoneError,
  TokenPlanView,
  fetchPlanByToken,
  getStoredGuestRsvp,
  submitTokenRsvp,
  updateGuestRsvp,
} from "@/lib/planGuest";
import { logEvent } from "@/lib/analytics";

const RSVP_OPTIONS: { value: PlanRsvpValue; label: string }[] = [
  { value: "going", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
];

const Shell = ({ children }: { children: React.ReactNode }) => (
  <main className="dark min-h-svh bg-background text-foreground">
    <div className="container max-w-md pt-10 pb-16 px-5">{children}</div>
    <footer className="pb-10 text-center">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        ENDZ — see where tonight is happening
      </Link>
    </footer>
  </main>
);

/**
 * Signup invitation shown to signed-out visitors. Today it routes to the
 * `/join` waitlist (real sign-up is gated on Google OAuth publish); once
 * `SIGNUP_LIVE` flips it calls the real Google sign-in instead.
 */
const WelcomeCta = () => {
  const navigate = useNavigate();
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const onClick = () => {
    logEvent("plan_cta_click", { surface: "link" });
    if (SIGNUP_LIVE) {
      void signInWithGoogle();
    } else {
      navigate("/join?source=plan");
    }
  };
  return (
    <div className="mt-4 rounded-3xl border border-primary/30 bg-primary-soft/30 p-5 text-center">
      <p className="font-display text-lg font-bold">Welcome to ENDZ</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The live map for where the night's actually happening in the East Village.
      </p>
      <Button onClick={onClick} className="mt-4 h-11 rounded-xl px-5 shadow-glow">
        Get early access
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
};

const PlanPage = () => {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  // Signed-in users see their pick reflected on refetch; guests need local
  // state (the guest list may be hidden, and names aren't identifying).
  const [localRsvp, setLocalRsvp] = useState<PlanRsvpValue | null>(
    () => (token ? getStoredGuestRsvp(token)?.rsvp ?? null : null)
  );
  const stored = token ? getStoredGuestRsvp(token) : null;

  const { data, isLoading } = useQuery<TokenPlanView | null>({
    queryKey: ["plan-token", token],
    enabled: !!token,
    refetchOnWindowFocus: true,
    queryFn: () => fetchPlanByToken(token!),
  });

  const pick = async (value: PlanRsvpValue) => {
    if (!token || busy) return;
    if (!session && !stored && guestName.trim().length === 0) {
      toast.error("Add your name first so the crew knows who's in");
      return;
    }
    setBusy(true);
    try {
      if (!session && stored) {
        await updateGuestRsvp(token, value);
      } else {
        await submitTokenRsvp({
          token,
          rsvp: value,
          guestName: session ? undefined : guestName.trim(),
        });
      }
      setLocalRsvp(value);
      logEvent("plan_rsvp", { surface: "link", value });
      queryClient.invalidateQueries({ queryKey: ["plan-token", token] });
    } catch (e) {
      if (e instanceof PlanGoneError) {
        toast.error("This plan is over");
        queryClient.invalidateQueries({ queryKey: ["plan-token", token] });
      } else {
        toast.error("Couldn't save that — try again");
      }
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Shell>
        <Skeleton className="h-8 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-6" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="rounded-3xl border border-border bg-card p-8 text-center animate-fade-in">
          <p className="font-display text-lg font-bold">Nothing here.</p>
          <p className="text-sm text-muted-foreground mt-1">
            This link isn't pointing at a plan anymore.
          </p>
        </div>
      </Shell>
    );
  }

  const over = data.plan.status !== "active" || data.plan.is_past;
  const hostName = data.host
    ? data.host.display_name || `@${data.host.username}`
    : "A friend";
  const hostInitial = (data.host?.display_name || data.host?.username || "E")
    .slice(0, 1)
    .toUpperCase();
  const gl = data.guest_list;

  return (
    <Shell>
      <div className="animate-fade-in">
        {/* Host */}
        <div className="flex items-center gap-3 mb-5">
          <Avatar className="h-11 w-11">
            <AvatarImage src={data.host?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-primary-soft text-primary font-semibold">
              {hostInitial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{hostName} made a plan</p>
            {data.host && (
              <p className="text-xs text-muted-foreground/70">@{data.host.username}</p>
            )}
          </div>
        </div>

        {/* The plan */}
        <div className="rounded-3xl border border-border bg-card p-5">
          <h1 className="font-display text-2xl font-bold leading-tight flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-1 shrink-0 text-primary" aria-hidden="true" />
            {data.venue?.name ?? "A spot TBD"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {format(new Date(data.plan.planned_at), "EEEE MMM d · h:mm a")}
          </p>
          {data.plan.note && (
            <p className="mt-3 text-sm text-foreground/90">{data.plan.note}</p>
          )}
          {data.venue && !over && (
            <a
              href={directionsUrl("google", {
                title: data.venue.name,
                latitude: data.venue.latitude,
                longitude: data.venue.longitude,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" /> Directions
            </a>
          )}
        </div>

        {over ? (
          <div className="mt-4 rounded-3xl border border-border bg-card p-6 text-center">
            <p className="font-display text-lg font-bold">This one's a wrap.</p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.plan.status === "cancelled"
                ? "The host called it off."
                : "This plan already happened."}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-border bg-card p-5">
            {!session && !stored && (
              <Input
                placeholder="Your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={40}
                className="rounded-xl mb-3"
              />
            )}
            {stored && !session && (
              <p className="text-xs text-muted-foreground mb-3">
                You're on the list as <span className="font-medium text-foreground">{stored.guestName}</span> — tap to change your answer.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {RSVP_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={localRsvp === opt.value ? "default" : "secondary"}
                  disabled={busy}
                  className={cn(
                    "h-11 rounded-xl",
                    localRsvp === opt.value && "shadow-glow"
                  )}
                  onClick={() => pick(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Signup invite — signed-out visitors only */}
        {!session && <WelcomeCta />}

        {/* Guest list */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Who's in
          </p>
          {gl.hidden ? (
            <p className="text-sm text-muted-foreground">
              {gl.going} going{gl.maybe > 0 && ` · ${gl.maybe} maybe`}
            </p>
          ) : gl.entries && gl.entries.length > 0 ? (
            <ul className="space-y-1.5">
              {gl.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate">{e.name}</span>
                  <span
                    className={cn(
                      "text-xs font-medium shrink-0 ml-3",
                      e.rsvp === "going"
                        ? "text-emerald-500"
                        : e.rsvp === "maybe"
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {e.rsvp === "going" ? "going" : e.rsvp === "maybe" ? "maybe" : "can't"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nobody yet — be the first.</p>
          )}
        </div>
      </div>
    </Shell>
  );
};

export default PlanPage;
