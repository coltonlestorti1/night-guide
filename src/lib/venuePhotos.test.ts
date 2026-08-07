import { describe, it, expect } from "vitest";
import { withTimeout } from "./venuePhotos";

// withTimeout is the pure piece of the upload-timeout fix: it doesn't touch
// Supabase, so it's tested directly with plain promises rather than mocking
// the storage client. uploadVenuePhoto itself (getSupabase + reencodeImage +
// the real storage call) is not covered here — mocking that whole chain
// would test the mock, not the timeout behavior.
describe("withTimeout", () => {
  it("resolves with the promise's value when it settles before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "timed out")).resolves.toBe("ok");
  });

  it("propagates the promise's own rejection when it rejects before the timeout", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 50, "timed out"),
    ).rejects.toThrow("boom");
  });

  it("rejects with the given message when the promise never settles", async () => {
    const neverSettles = new Promise<string>(() => {});
    await expect(
      withTimeout(neverSettles, 10, "upload timed out after 10ms"),
    ).rejects.toThrow("upload timed out after 10ms");
  });
});
