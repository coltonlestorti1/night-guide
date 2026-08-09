import { RefreshCw, X } from "lucide-react";
import { useBuildUpdate } from "@/hooks/useBuildUpdate";

/**
 * Offers a reload when a newer build is deployed. Deliberately NOT an
 * auto-reload: posting a photo backgrounds the app for the iOS picker, and
 * returning from it is precisely when an automatic reload would fire and
 * discard a half-written post.
 *
 * Sits above the bottom tabs (110px matches AppLayout's own content padding)
 * and below their z-50, so it never covers navigation.
 */
const BuildUpdateBanner = () => {
  const { show, dismiss } = useBuildUpdate();

  if (!show) return null;

  return (
    <div
      className="fixed z-40 inset-x-3 bottom-[calc(110px+env(safe-area-inset-bottom))]
                 lg:inset-x-auto lg:left-24 lg:bottom-4 lg:w-80"
      role="status"
    >
      {/* Two sibling buttons, never nested — a <button> inside a <button> is
          invalid HTML and cost us tap targets on the saved-spots row before. */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">New version available — tap to update</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss update notice"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BuildUpdateBanner;
