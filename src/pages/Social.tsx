/**
 * Social — thin composition over src/components/social/*.
 * Section order (spec): header → requests → out tonight → find friends →
 * your friends. RLS decides every list's contents; nothing is filtered in.
 */
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveBlocked, deriveFriends, deriveIncoming, deriveOutgoing } from "@/lib/friends";
import { useFriendsOutTonight, useMyFriendships } from "@/hooks/useFriends";
import { Button } from "@/components/ui/button";
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

const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-3xl border border-border bg-card p-4 mb-4 animate-fade-in">
    <h2 className="text-sm font-semibold mb-1">{title}</h2>
    {children}
  </div>
);

const Social = () => {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();
  const { data: out } = useFriendsOutTonight();

  const header = (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">Social</h1>
      <p className="text-sm text-muted-foreground">Find out where your friends are tonight</p>
    </header>
  );

  // Signed out / mid-onboarding: existing prompt, unchanged.
  if (status !== "signedIn") {
    return (
      <section className="container pt-6 pb-24 max-w-lg">
        {header}
        <div className="glass rounded-3xl p-8 text-center animate-fade-in">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No friend check-ins yet.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to add friends and see where they're at.
          </p>
          {status === "signedOut" && (
            <Button className="w-full h-11 rounded-xl mt-5" onClick={() => navigate("/profile")}>
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
    <section className="container pt-6 pb-24 max-w-lg">
      {header}

      {(incoming.length > 0 || outgoing.length > 0) && (
        <SectionCard title="Requests">
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

      {friends.length > 0 && (
        <SectionCard title="Out tonight">
          {out && out.length > 0 ? (
            out.map((f) => <OutTonightRow key={f.checkInId} friend={f} />)
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nobody's out yet — someone's gotta go first.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard title="Find friends">
        <ProfileSearch />
        <ShareHandleCard />
        <SuggestedList />
      </SectionCard>

      {friends.length > 0 && (
        <SectionCard title={`Your friends (${friends.length})`}>
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
