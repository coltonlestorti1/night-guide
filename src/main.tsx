import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Retire the HTML splash once React has actually painted. Two frames rather
// than one: the first lands after React commits, the second after the browser
// has drawn it, so the splash never lifts on an empty frame and flash the
// white screen it exists to prevent.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const splash = document.getElementById("endz-splash");
    if (!splash) return;
    splash.classList.add("endz-splash-out");
    // Matches the 220ms CSS transition. Fixed timeout rather than
    // transitionend, which never fires under prefers-reduced-motion.
    setTimeout(() => splash.remove(), 260);
  }),
);

// Register the minimal service worker (installability, no offline caching).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
