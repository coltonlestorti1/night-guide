/**
 * Admin-only primitives. Built on the existing shadcn components and brand
 * tokens so the dashboard inherits the app's look without touching a single
 * consumer file.
 *
 * Deliberately small. These exist because the same five shapes repeat across
 * every admin page, not because the dashboard needs a design system.
 */
import { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warn" | "muted";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-display text-2xl font-bold tabular-nums",
          tone === "warn" && "text-amber-700",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

/**
 * An empty state that says WHY it is empty. The project rule against
 * fabricated data means a zero here is usually structural (nobody can sign in
 * yet), and a blank chart would hide that instead of explaining it.
 */
export function EmptyState({
  title,
  children,
  icon: Icon = Inbox,
}: {
  title: string;
  children?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 p-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      {children && (
        <div className="max-w-md text-sm text-muted-foreground">{children}</div>
      )}
    </Card>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <Card className="flex items-start gap-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </Card>
  );
}

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
