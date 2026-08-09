import { describe, it, expect, vi, beforeEach } from "vitest";

// The one thing worth testing here is the branch that used to be silently
// wrong: a duplicate must come back as "already-reported" rather than as a
// success, and a real error must still throw.
const insert = vi.fn();
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ from: () => ({ insert }) }),
}));

import { submitReport } from "./reports";

const input = {
  reporterId: "me",
  reportedUserId: "them",
  reason: "harassment" as const,
  context: "profile" as const,
};

beforeEach(() => insert.mockReset());

describe("submitReport", () => {
  it("reports 'filed' when the row is created", async () => {
    insert.mockResolvedValue({ error: null });
    await expect(submitReport(input)).resolves.toBe("filed");
  });

  it("reports 'already-reported' on the dedupe constraint, and does NOT throw", async () => {
    // 23505 is reachable by reporting the same profile twice for different
    // reasons — profile reports carry context_id null, so only one is allowed.
    insert.mockResolvedValue({ error: { code: "23505" } });
    await expect(submitReport(input)).resolves.toBe("already-reported");
  });

  it("still throws on a real failure, so the UI can say it did not send", async () => {
    insert.mockResolvedValue({ error: { code: "42501" } });
    await expect(submitReport(input)).rejects.toBeTruthy();
  });
});
