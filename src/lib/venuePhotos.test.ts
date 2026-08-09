import { describe, it, expect } from "vitest";
import { withTimeout, isAcceptedImage, describeFileType } from "./venuePhotos";

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

// isAcceptedImage is the pure piece of the format-acceptance fix: whether the
// browser will even attempt to decode a dropped/picked file, decided purely
// from its reported MIME type. Every accepted file still gets canvas
// re-encoded to JPEG before upload (see uploadVenuePhoto/reencodeImage), so
// this just needs to admit anything image/* rather than a hardcoded
// allowlist — including AVIF, which is what triggered this fix (modern venue
// sites serve it and the old allowlist rejected it outright).
describe("isAcceptedImage", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"])(
    "accepts %s",
    (type) => {
      expect(isAcceptedImage({ type })).toBe(true);
    },
  );

  it.each(["application/pdf", "text/plain", ""])("rejects %j", (type) => {
    expect(isAcceptedImage({ type })).toBe(false);
  });
});

describe("describeFileType", () => {
  it("prefers the reported MIME type when present", () => {
    expect(describeFileType(new File([], "photo.pdf", { type: "application/pdf" }))).toBe(
      "application/pdf",
    );
  });

  it("falls back to the file extension when the type is empty", () => {
    expect(describeFileType(new File([], "IMG_0001.heic", { type: "" }))).toBe(".heic");
  });

  it("falls back to the filename when there's no extension and no type", () => {
    expect(describeFileType(new File([], "noext", { type: "" }))).toBe('"noext"');
  });
});
