/**
 * Social — thin composition over src/components/social/*.
 * Section order (spec): header → requests → out tonight → find friends →
 * your friends. RLS decides every list's contents; nothing is filtered in.
 */
import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronDown, MapPin, Search, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveBlocked, deriveFriends, deriveIncoming, deriveOutgoing } from "@/lib/friends";
import { useFriendsOutTonight, useMyFriendships } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import BlockedRow from "@/components/social/BlockedRow";
import RequestRow from "@/components/social/RequestRow";
import FriendRow from "@/components/social/FriendRow";
import OutTonightRow from "@/components/social/OutTonightRow";
import ProfileSearch from "@/components/social/ProfileSearch";
import ShareHandleCard from "@/components/social/ShareHandleCard";
import SuggestedList from "@/components/social/SuggestedList";
import { usePendingRequests, usePlanFeed } from "@/hooks/usePlans";
import PlanCard from "@/components/social/PlanCard";
import CreatePlanSheet from "@/components/social/CreatePlanSheet";

type Tone = "primary" | "live" | "neutral";

const CHIP_TONE: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  live: "bg-emerald-600/10 text-emerald-700",
  neutral: "bg-secondary text-muted-foreground",
};

const SectionCard = ({
  title,
  icon: Icon,
  tone = "neutral",
  badge,
  children,
}: {
  title: string;
  icon: typeof Users;
  tone?: Tone;
  badge?: ReactNode;
  children: ReactNode;
}) => (
  <div className="rounded-3xl border border-border bg-card p-4 mb-4 animate-fade-in">
    <div className="flex items-center gap-2.5 mb-1.5">
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", CHIP_TONE[tone])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold flex-1 min-w-0 truncate">{title}</h2>
      {badge}
    </div>
    {children}
  </div>
);

const Social = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: out } = useFriendsOutTonight();
  const { data: planItems } = usePlanFeed();
  const { data: pendingRequests } = usePendingRequests();
  const [createOpen, setCreateOpen] = useState(false);
  const openInvites = (planItems ?? []).filter((p) => p.invitedNoResponse).length;
  const requestCount = (pendingRequests ?? []).length;

  const header = (
    <header className="relative mb-6 animate-fade-in">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
        Your crew
      </p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Social</h1>
      <p className="mt-1 text-sm text-muted-foreground">See who&apos;s out tonight — and where.</p>
    </header>
  );

  const glow = (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-12 h-56 opacity-[0.16] blur-3xl"
      style={{ background: "radial-gradient(ellipse 70% 100% at 18% 0%, hsl(var(--friends)) 0%, transparent 65%)" }}
    />
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

  const incoming = rows && userId ? deriveIncoming(rows, userId) : [];
  const outgoing = rows && userId ? deriveOutgoing(rows, userId) : [];
  const friends = rows && userId ? deriveFriends(rows, userId) : [];
  const blocked = rows && userId ? deriveBlocked(rows, userId) : [];

  return (
    <section className="relative container pt-6 pb-24 max-w-lg">
      {glow}
      {header}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <SectionCard
          title="Requests"
          icon={UserPlus}
          tone="primary"
          badge={
            incoming.length > 0 ? (
              <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                {incoming.length} new
              </span>
            ) : undefined
          }
        >
          {incoming.map((r) => (
            <RequestRow key={r.rowId} rowId={r.rowId} profile={r.profile} direction="incoming" />
          ))}
          {outgoing.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
                Requested ({outgoing.length}) <ChevronDown className="h-3 w-3 transition-transform" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {outgoing.map((r) => (
                  <RequestRow key={r.rowId} rowId={r.rowId} profile={r.profile} direction="outgoing" />
                ))}
              </CollapsibleContent>
            </Collapsible>
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
          <p className="text-sm text-muted-foreground py-2">
            Nothing on the books tonight.
          </p>
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

      <SectionCard title="Find friends" icon={Search} tone="primary">
        <div className="mt-1.5">
          <ProfileSearch />
        </div>
        <ShareHandleCard />
        <SuggestedList />
      </SectionCard>

      {friends.length > 0 && (
        <SectionCard title={`Your friends (${friends.length})`} icon={Users}>
          {friends.map((f) => (
            <FriendRow key={f.rowId} rowId={f.rowId} profile={f.profile} />
          ))}
        </SectionCard>
      )}

      {blocked.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors [&[data-state=open]>svg]:rotate-180">
            Blocked ({blocked.length}) <ChevronDown className="h-3 w-3 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-3xl border border-border bg-card px-4 py-1.5">
              {blocked.map((b) => (
                <BlockedRow key={b.rowId} rowId={b.rowId} profile={b.profile} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
};

export default Social;
