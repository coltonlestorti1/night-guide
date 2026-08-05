/** Single source for the support/legal contact (Decision Log 2026-07-17). */
export const SUPPORT_EMAIL = "clsneaks01@gmail.com";

/**
 * Whether real account sign-up is live. Was gated on Google OAuth leaving
 * testing mode, where only whitelisted users could complete sign-in, so signup
 * CTAs routed to the waitlist (`/join`) instead.
 *
 * Flipped true 2026-08-05: Colton confirmed the OAuth consent screen reads
 * "In production". Signup CTAs now call the real `signInWithGoogle()` flow.
 */
export const SIGNUP_LIVE = true;

/**
 * Canonical public origin, used for links that LEAVE the app — plan invites,
 * QR codes, referral links.
 *
 * Deliberately not `window.location.origin`: creating a plan on the dev server
 * produced `localhost:8080/p/<token>`, which is useless the moment it's sent to
 * anyone. A share link has to work on someone else's phone, so it always points
 * at the deployed app.
 *
 * Override with VITE_APP_URL if the domain changes (custom domain, preview).
 * Trade-off: a link copied while developing opens production, not localhost —
 * correct for sharing, mildly annoying for local round-trip testing.
 */
export const APP_URL = (
  import.meta.env.VITE_APP_URL || "https://night-guide.vercel.app"
).replace(/\/$/, "");
