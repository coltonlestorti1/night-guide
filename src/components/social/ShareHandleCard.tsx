/** "You're @handle — send it to the crew." Native share, copy fallback. */
import { useState } from "react";
import { Share2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

export default function ShareHandleCard() {
  const profile = useAuthStore((s) => s.profile);
  const [copied, setCopied] = useState(false);
  if (!profile) return null;
  const handle = `@${profile.username}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(handle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (non-secure context) — nothing sane to do
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: `I'm ${handle} on ENDZ — add me`,
          url: window.location.origin,
        });
      } catch {
        // User dismissed the share sheet — not an error
      }
    } else {
      copy();
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-3.5 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">You're {handle}</p>
        <p className="text-xs text-muted-foreground">Send it to the crew.</p>
      </div>
      <Button size="sm" variant="secondary" className="rounded-full shrink-0" onClick={copy}>
        {copied ? "Copied ✓" : "Copy"}
      </Button>
      <Button size="sm" className="rounded-full shrink-0" onClick={share}>
        <Share2 className="h-3.5 w-3.5 mr-1" /> Share
      </Button>
    </div>
  );
}
