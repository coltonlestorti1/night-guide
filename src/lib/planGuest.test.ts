/**
 * Status-code mapping for the plan-guest client.
 *
 * The point of these tests is not the happy path — it is that a PERMANENT
 * refusal must not reach the user as "try again". 409 means the host has not
 * approved your join request yet, and no amount of retrying changes that; the
 * generic branch would have said "Couldn't save that — try again", which is the
 * same class of lie as an error state rendered as an empty one.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
  getFunctionsBase: () => "https://example.test/functions/v1",
}));

vi.mock("@/store/auth", () => ({
  useAuthStore: { getState: () => ({ session: { access_token: "jwt" } }) },
}));

import {
  submitTokenRsvp,
  PlanGoneError,
  PlanRequestPendingError,
} from "@/lib/planGuest";

const reply = (status: number, body: unknown = {}) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("submitTokenRsvp status mapping", () => {
  it("throws PlanRequestPendingError on 409, not a generic error", async () => {
    vi.stubGlobal("fetch", reply(409, { error: "Your request is waiting on the host" }));

    await expect(
      submitTokenRsvp({ token: "t", rsvp: "going" }),
    ).rejects.toBeInstanceOf(PlanRequestPendingError);
  });

  it("still throws PlanGoneError on 410", async () => {
    vi.stubGlobal("fetch", reply(410, { error: "This plan is over" }));

    await expect(
      submitTokenRsvp({ token: "t", rsvp: "going" }),
    ).rejects.toBeInstanceOf(PlanGoneError);
  });

  it("throws a generic error on 500, which IS worth retrying", async () => {
    vi.stubGlobal("fetch", reply(500, { error: "Something broke" }));

    const err = await submitTokenRsvp({ token: "t", rsvp: "going" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(PlanRequestPendingError);
    expect(err).not.toBeInstanceOf(PlanGoneError);
  });

  it("resolves as_user on success", async () => {
    vi.stubGlobal("fetch", reply(201, { as_user: true }));

    await expect(submitTokenRsvp({ token: "t", rsvp: "going" })).resolves.toEqual({
      asUser: true,
    });
  });
});
