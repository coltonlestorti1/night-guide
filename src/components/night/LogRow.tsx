/**
 * One row of the log sheet: a tappable header that expands its content in
 * place, with an inline summary of what is already filled in.
 *
 * The summary is what makes the collapsed sheet readable as a preview of the
 * post you are about to make — a row that has a value shows the value, not the
 * prompt. Everything here is optional, which is why none of it is a step.
 */
import { type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LogRow({
  icon: Icon,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Rendered under the label when collapsed. Chips, a date, an audience. */
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full min-h-11 items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {/* min-w-0 so a long summary truncates instead of widening the row past
            the sheet — the flex item would otherwise default to min-width:auto
            and push the chevron off screen. */}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}
