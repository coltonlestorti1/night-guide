/**
 * Social — the night feed, plus what is happening tonight.
 *
 * Section order: header → last night's recap → the feed → out tonight → plans.
 * Friend *management* (requests, search, your list, blocked) moved into
 * FriendsSheet behind the header icon: it is a surface people visit twice and
 * then stop, and it was occupying the page the feed needs.
 *
 * Plans and Out tonight deliberately stayed. They are not friend management —
 * they carry tonight-relevant, actionable information, and burying an invite
 * that needs approving behind an icon would be a regression dressed up as
 * tidying.
 *
 * RLS decides every list's contents; nothing is filtered in the client.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveFriends, deriveIncoming } from "@/lib/friends";
import { useFriendsOutTonight, useMyFriendships } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import SectionCard from "@/components/social/SectionCard";
import OutTonightRow from "@/components/social/OutTonightRow";
import FriendsSheet from "@/components/social/FriendsSheet";
import { usePendingRequests, usePlanFeed } from "@/hooks/usePlans";
import PlanCard from "@/components/social/PlanCard";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";
import RecapCard from "@/components/night/RecapCard";
import FeedList from "@/components/night/FeedList";

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

  const openInvites = (planItems ?? []).filter((p) => p.invitedNoResponse).length;
  const requestCount = (pendingRequests ?? []).length;
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
          Where everyone went — and who&apos;s out now.
        </p>
      </div>

      {status === "signedIn" && (
        <Button
          variant="secondary"
          size="icon"
          className="relative shrink-0 h-10 w-10 rounded-full mt-1"
          onClick={() => setFriendsOpen(true)}
          aria-label={
            incoming.length > 0
              ? `Friends — ${incoming.length} pending request${incoming.length === 1 ? "" : "s"}`
              : "Friends"
          }
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          {/* The request signal used to sit in plain view on the page. Moving
              the section behind this button must not silently lose it. */}
          {incoming.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {incoming.length}
            </span>
          )}
        </Button>
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

      <RecapCard />

      <div className="mb-4">
        <FeedList />
      </div>

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

      <SectionCard
        title="Plans"
        icon={CalendarClock}
        tone="primary"
        badge={
          openInvites > 0 || requestCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1.5">
              {requestCount > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  {requestCount} to approve
                </span>
              )}
              {openInvites > 0 && (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                  {openInvites} new
                </span>
              )}
            </span>
          ) : undefined
        }
      >
        {(planItems ?? []).map((item) => (
          <PlanCard key={item.plan.id} item={item} />
        ))}
        {(planItems ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Nothing on the books tonight.</p>
        )}
        <Button
          variant="secondary"
          className="w-full h-10 rounded-xl mt-2"
          onClick={() => setCreateOpen(true)}
        >
          <CalendarClock className="h-4 w-4 mr-2" /> Make a plan
        </Button>
      </SectionCard>

      <CreatePlanSheet open={createOpen} onOpenChange={setCreateOpen} surface="social" />
      <FriendsSheet open={friendsOpen} onOpenChange={setFriendsOpen} />
    </section>
  );
};

export default Social;
