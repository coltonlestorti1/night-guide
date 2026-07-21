/** Single source for the support/legal contact (Decision Log 2026-07-17). */
export const SUPPORT_EMAIL = "clsneaks01@gmail.com";

/**
 * Whether real account sign-up is live. Gated on Google OAuth leaving testing
 * mode — until then only whitelisted users can complete sign-in, so signup
 * CTAs route to the waitlist (`/join`) instead. Flip to `true` once OAuth is
 * published to graduate those CTAs to the real `signInWithGoogle()` flow.
 */
export const SIGNUP_LIVE = false;
