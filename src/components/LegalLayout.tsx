/**
 * Shared chrome for the standalone /privacy and /terms pages. Rendered outside
 * AppLayout (no map, no bottom tabs, no auth) — same standalone pattern as /join.
 */
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to ENDZ
        </Link>

        <h1 className="mt-6 text-3xl font-display font-bold tracking-tight text-primary">ENDZ</h1>
        <h2 className="mt-1 text-xl font-display font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-1">Last updated: {updated}</p>

        <div
          className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/90
            [&_h3]:font-display [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-7 [&_h3]:mb-1.5 [&_h3]:text-foreground
            [&_ul]:space-y-2 [&_ul]:pl-1 [&_li]:list-none [&_a]:text-primary [&_a]:underline
            [&_strong]:text-foreground [&_strong]:font-semibold"
        >
          {children}
        </div>

        <div className="mt-10 pt-6 border-t border-border text-sm text-muted-foreground">
          <Link to="/privacy" className="text-primary underline">Privacy</Link>
          {" · "}
          <Link to="/terms" className="text-primary underline">Terms</Link>
        </div>
      </div>
    </div>
  );
}
