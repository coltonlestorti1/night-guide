import { useEffect, useState } from "react";
import { createUpdateChecker } from "@/lib/buildVersion";

// Deferred so the first check never competes with first paint. The user is
// reading the map; a version fetch can wait a moment.
const START_DELAY_MS = 4_000;

/**
 * True once a newer build is known to be deployed.
 *
 * Checks at app start and on foreground return. Foreground return is the one
 * that matters: an iOS home-screen PWA resumed from the app switcher fires no
 * navigation at all, which is exactly how ENDZ kept serving Colton a build from
 * hours earlier on 2026-08-09.
 */
export function useBuildUpdate(): { show: boolean; dismiss: () => void } {
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // .bind keeps the `typeof fetch` signature intact; a (...args) wrapper
    // trips up the overloads.
    const check = createUpdateChecker(__BUILD_ID__, window.fetch.bind(window));
    let latched = false;
    let cancelled = false;

    const run = async () => {
      // Once we know, we know — the answer cannot go back to "current", so
      // stop fetching. The listeners stay attached for the dismiss reset.
      if (latched || cancelled) return;
      const status = await check(Date.now());
      if (cancelled || status !== "update") return;
      latched = true;
      setUpdateReady(true);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Coming back is a fresh chance to offer it to someone who waved it away.
      setDismissed(false);
      void run();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // event.persisted is true only for a bfcache restore. Without this
      // gate, pageshow also fires once after every normal load — including
      // the very first one, before START_DELAY_MS has had a chance to
      // elapse — which defeats the deferral above.
      if (!event.persisted) return;
      setDismissed(false);
      void run();
    };

    const timer = window.setTimeout(() => void run(), START_DELAY_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return { show: updateReady && !dismissed, dismiss: () => setDismissed(true) };
}
