import { useLayoutEffect, useRef } from "react";
import { RefreshCw, X } from "lucide-react";
import { useBuildUpdate } from "@/hooks/useBuildUpdate";

/** Clearance held between the banner and whatever sits directly above it. */
const STACK_GAP_PX = 8;

/** Kept in sync with the `:root` declaration in src/index.css. */
const STACK_VAR = "--endz-update-banner-h";

/**
 * Offers a reload when a newer build is deployed. Deliberately NOT an
 * auto-reload: posting a photo backgrounds the app for the iOS picker, and
 * returning from it is precisely when an automatic reload would fire and
 * discard a half-written post.
 *
 * Placement: the banner JOINS the bottom stack rather than floating on top of
 * it. AppLayout's routes stack four fixed things above the tab bar — the
 * Map/List toggle at 96px, "I'm out tonight" at 148px, the check-in prompt at
 * 210px, and the tabs themselves at 0 — with no free slot between them. So the
 * banner takes the 96px slot and publishes its own height plus a gap as
 * `--endz-update-banner-h`; AppLayout's content padding and all three map
 * controls add that variable to their offsets and ride up by exactly the same
 * amount while it is showing. Nothing above the banner is covered, and the tab
 * bar below it is never reached: the banner's lower edge sits 40px clear of the
 * tabs' upper edge, and z-40 stays under their z-50 regardless.
 */
const BuildUpdateBanner = () => {
  const { show, dismiss } = useBuildUpdate();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Measured rather than hardcoded: at 375px the copy wraps to a second line,
  // which would silently break a fixed offset and put us back under the
  // Map/List toggle — the exact bug this placement exists to fix. Must run
  // before paint (useLayoutEffect, not useEffect): a passive effect would
  // leave --endz-update-banner-h at 0px for the first painted frame, so the
  // banner would briefly overlap the Map/List toggle it exists to clear.
  useLayoutEffect(() => {
    const el = cardRef.current;
    const root = document.documentElement;
    if (!show || !el) return;

    const publish = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty(STACK_VAR, `${height + STACK_GAP_PX}px`);
    };

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);

    return () => {
      observer.disconnect();
      root.style.setProperty(STACK_VAR, "0px");
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed z-40 inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))]
                 lg:inset-x-auto lg:left-24 lg:bottom-4 lg:w-80"
      role="status"
    >
      {/* Two sibling buttons, never nested — a <button> inside a <button> is
          invalid HTML and cost us tap targets on the saved-spots row before.
          The row is items-stretch and the padding lives on the children, so
          each button's hit area is its full 44px rather than the ~20px line
          box it would size to under items-center. gap-2 keeps 8px of dead,
          non-interactive space between them: a mis-tap aimed at dismiss lands
          on nothing rather than on the reload. */}
      <div
        ref={cardRef}
        className="flex items-stretch gap-2 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur"
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex min-h-[44px] flex-1 items-center gap-2 rounded-lg px-2.5 text-left
                     transition-colors active:bg-accent"
        >
          <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm font-medium">New version available — tap to update</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss update notice"
          className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-lg
                     text-muted-foreground transition-colors active:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BuildUpdateBanner;
