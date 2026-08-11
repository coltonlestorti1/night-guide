/**
 * Activity | Tagged, on both your profile and someone else's.
 *
 * Both surfaces get the same two tabs deliberately. Before this, /u/:username
 * showed authored AND tagged posts merged into one list while /profile showed
 * only what you authored — so your friends could see a version of your profile
 * that you could not. Splitting them the same way in both places is what makes
 * "Tagged" mean one thing.
 *
 * Icons carry a label. The reference is Instagram's icon-only pair, which
 * works there because everyone has already learned it; Activity has no equally
 * obvious icon here, and an unlabelled one is a guess.
 *
 * Real buttons with aria-selected, not links: which tab you are on is view
 * state, not an address, and it does not need to survive a reload.
 */
import { Moon, SquareUserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileTab = "activity" | "tagged";

const TABS: { id: ProfileTab; label: string; Icon: typeof Moon }[] = [
  { id: "activity", label: "Activity", Icon: Moon },
  { id: "tagged", label: "Tagged", Icon: SquareUserRound },
];

export default function ProfileTabs({
  value,
  onChange,
}: {
  value: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  return (
    <div role="tablist" aria-label="Profile sections" className="flex border-b border-border">
      {TABS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              // The underline is drawn as a border on the button so it sits
              // exactly on the container's border, not a pixel above it.
              active
                ? "border-b-2 border-foreground text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
