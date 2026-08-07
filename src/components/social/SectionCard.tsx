/**
 * The card chrome used by every section on Social and inside FriendsSheet.
 *
 * Extracted from Social.tsx when the feed took over that page — both surfaces
 * need identical chrome, and two copies would drift the moment one is restyled.
 */
import { ReactNode } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "live" | "neutral";

const CHIP_TONE: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary",
  live: "bg-emerald-600/10 text-emerald-700",
  neutral: "bg-secondary text-muted-foreground",
};

export default function SectionCard({
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
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 mb-4 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            CHIP_TONE[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold flex-1 min-w-0 truncate">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}
