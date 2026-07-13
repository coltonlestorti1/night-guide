/**
 * Overlapping avatar cluster — max N faces then a "+K" chip.
 * Pattern from 21st.dev id 17144 "Astryx Avatar" (AvatarGroup + overflow);
 * rebuilt on the repo's shadcn Avatar because the Astryx source is an npm
 * package re-export and this branch adds no packages.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ClusterPerson = { id: string; name: string; avatarUrl: string | null };

export default function AvatarCluster({
  people,
  max = 4,
  className,
}: {
  people: ClusterPerson[];
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {shown.map((p) => (
        <Avatar key={p.id} className="h-7 w-7 ring-2 ring-card">
          <AvatarImage src={p.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px] font-semibold bg-primary-soft text-primary">
            {p.name.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="h-7 w-7 rounded-full ring-2 ring-card bg-secondary flex items-center justify-center text-[10px] font-semibold">
          +{extra}
        </span>
      )}
    </div>
  );
}
