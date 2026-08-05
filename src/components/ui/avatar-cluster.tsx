/**
 * Overlapping avatar cluster — max N faces then a "+K" chip.
 * Pattern from 21st.dev id 17144 "Astryx Avatar" (AvatarGroup + overflow);
 * rebuilt on the repo's shadcn Avatar because the Astryx source is an npm
 * package re-export and this branch adds no packages.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ClusterPerson = { id: string; name: string; avatarUrl: string | null };

/**
 * "sm" exists for the Discover card facepile, which sits inside a 12px
 * metadata line — the default 28px face pushes the card taller.
 */
const SIZES = {
  sm: { face: "h-5 w-5", text: "text-[9px]", overlap: "-space-x-1.5" },
  md: { face: "h-7 w-7", text: "text-[10px]", overlap: "-space-x-2" },
} as const;

export default function AvatarCluster({
  people,
  max = 4,
  size = "md",
  className,
}: {
  people: ClusterPerson[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const s = SIZES[size];
  return (
    <div className={cn("flex", s.overlap, className)}>
      {shown.map((p) => (
        <Avatar key={p.id} className={cn(s.face, "ring-2 ring-card")}>
          <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className={cn(s.text, "font-semibold bg-primary-soft text-primary")}>
            {p.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            s.face, s.text,
            "rounded-full ring-2 ring-card bg-secondary flex items-center justify-center font-semibold"
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
