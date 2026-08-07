/**
 * Friend management, moved off the Social page when the night feed took it over.
 *
 * What lives here is deliberately the *admin* half: requests, finding people,
 * your list, blocked. Plans and Out tonight stayed on the page — they carry
 * tonight-relevant, actionable information ("2 to approve", who is out right
 * now), and hiding those behind an icon would be a regression dressed up as
 * tidying.
 *
 * The sections themselves are moved verbatim from Social.tsx, so any behaviour
 * change here is a wiring bug rather than an intended edit.
 */
import { ChevronDown, Search, UserPlus, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { deriveBlocked, deriveFriends, deriveIncoming, deriveOutgoing } from "@/lib/friends";
import { useMyFriendships } from "@/hooks/useFriends";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import SectionCard from "@/components/social/SectionCard";
import BlockedRow from "@/components/social/BlockedRow";
import RequestRow from "@/components/social/RequestRow";
import FriendRow from "@/components/social/FriendRow";
import ProfileSearch from "@/components/social/ProfileSearch";
import ShareHandleCard from "@/components/social/ShareHandleCard";
import SuggestedList from "@/components/social/SuggestedList";

export default function FriendsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const { data: rows } = useMyFriendships();

  const incoming = rows && userId ? deriveIncoming(rows, userId) : [];
  const outgoing = rows && userId ? deriveOutgoing(rows, userId) : [];
  const friends = rows && userId ? deriveFriends(rows, userId) : [];
  const blocked = rows && userId ? deriveBlocked(rows, userId) : [];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border max-h-[88vh]">
        <DrawerTitle className="sr-only">Friends</DrawerTitle>
        <DrawerDescription className="sr-only">
          Requests, finding people, your friends and blocked accounts.
        </DrawerDescription>

        <div className="px-4 pt-2 pb-8 max-w-lg mx-auto w-full overflow-y-auto">
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
                    Requested ({outgoing.length}){" "}
                    <ChevronDown className="h-3 w-3 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {outgoing.map((r) => (
                      <RequestRow
                        key={r.rowId}
                        rowId={r.rowId}
                        profile={r.profile}
                        direction="outgoing"
                      />
                    ))}
                  </CollapsibleContent>
                </Collapsible>
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
