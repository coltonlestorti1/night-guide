/**
 * Social — who's out now, what you did last night, and what everyone else did.
 *
 * Section order (Colton, 2026-08-07): header → out tonight → your recap → the
 * feed. Live presence leads because it is the only thing here that is
 * time-critical; the recap sits above the feed because it is the prompt that
 * produces feed content.
 *
 * Three header controls, all sheets: **+** adds a night you never checked into,
 * **Plans** holds tonight's plans and invites, **Friends** holds requests,
 * search, your list and blocked. Plans and Friends both carry badges — moving a
 * section behind an icon must never lose the signal that made people open it.
 *
 * RLS decides every list's contents; nothing is filtered in the client.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin, Plus, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveFriends, deriveIncoming } from "@/lib/friends";
import { useFriendsOutTonight, useMyFriendships } from "@/hooks/useFriends";
import { usePendingRequests, usePlanFeed } from "@/hooks/usePlans";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/social/SectionCard";
import OutTonightRow from "@/components/social/OutTonightRow";
import FriendsSheet from "@/components/social/FriendsSheet";
import PlansSheet from "@/components/social/PlansSheet";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";
import RecapCard from "@/components/night/RecapCard";
import FeedList from "@/components/night/FeedList";
import AddNightSheet from "@/components/night/AddNightSheet";

const Social = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: out } = useFriendsOutTonight();
  const { data: planItems } = usePlanFeed();
  const { data: pendingRequests } = usePendingRequests();

  const [createOpen, setCreateOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const openInvites = (planItems ?? []).filter((p) => p.invitedNoResponse).length;
  const requestCount = (pendingRequests ?? []).length;
  // One badge for everything Plans needs from you: invites to answer and guest
  // requests to approve.
  const planAlerts = openInvites + requestCount;
  const incoming = rows && userId ? deriveIncoming(rows, userId) : [];
  const friends = rows && userId ? deriveFriends(rows, userId) : [];

  const glow = (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-12 h-56 opacity-[0.16] blur-3xl"
      style={{
        background:
          "radial-gradient(ellipse 70% 100% at 18% 0%, hsl(var(--friends)) 0%, transparent 65%)",
      }}
    />
  );

  const header = (
    <header className="relative mb-6 animate-fade-in flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Your crew
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Social</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who&apos;s out now — and where everyone went.
        </p>
      </div>

      {status === "signedIn" && (
        <div className="flex shrink-0 items-center gap-2 mt-1">
          <Button
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={() => setAddOpen(true)}
            aria-label="Add a night you didn't check into"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="relative h-10 w-10 rounded-full"
            onClick={() => setPlansOpen(true)}
            aria-label={planAlerts > 0 ? `Plans — ${planAlerts} waiting on you` : "Plans"}
          >
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {planAlerts > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {planAlerts}
              </span>
            )}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="relative h-10 w-10 rounded-full"
            onClick={() => setFriendsOpen(true)}
            aria-label={
              incoming.length > 0
                ? `Friends — ${incoming.length} pending request${incoming.length === 1 ? "" : "s"}`
                : "Friends"
            }
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {incoming.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {incoming.length}
              </span>
            )}
          </Button>
        </div>
      )}
    </header>
  );

  // Signed out / mid-onboarding: existing prompt, unchanged behavior.
  if (status !== "signedIn") {
    return (
      <section className="relative container pt-6 pb-24 max-w-lg">
        {glow}
        {header}
        <div className="relative glass rounded-3xl p-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <p className="font-display text-lg font-bold">No friend check-ins yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to add friends and see where they're at.
          </p>
          {status === "signedOut" && (
            <Button
              className="w-full h-11 rounded-xl mt-5 shadow-glow"
              onClick={() => navigate("/profile")}
            >
              Sign in
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative container pt-6 pb-24 max-w-lg">
      {glow}
      {header}

      {friends.length > 0 && (
        <SectionCard
          title="Out tonight"
          icon={MapPin}
          tone="live"
          badge={
            out && out.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {out.length} out now
              </span>
            ) : undefined
          }
        >
          {out && out.length > 0 ? (
            out.map((f) => <OutTonightRow key={f.checkInId} friend={f} />)
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nobody's out yet — someone's gotta go first.
            </p>
          )}
        </SectionCard>
      )}

      <RecapCard />

      <FeedList />

      <CreatePlanSheet open={createOpen} onOpenChange={setCreateOpen} surface="social" />
      <FriendsSheet open={friendsOpen} onOpenChange={setFriendsOpen} />
      <PlansSheet
        open={plansOpen}
        onOpenChange={setPlansOpen}
        onMakePlan={() => setCreateOpen(true)}
      />
      {/* One drawer, two steps — it publishes internally rather than handing
          off to PublishSheet. See the note in AddNightSheet. */}
      <AddNightSheet open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
};

export default Social;
