export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** email local-part -> lowercase, non [a-z0-9_] -> _, collapse _, trim _ */
export function suggestUsername(email: string | undefined | null): string {
  if (!email) return "";
  return email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}
