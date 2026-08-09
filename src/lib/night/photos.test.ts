import { describe, it, expect } from "vitest";
import { ownsPhotoPath } from "./photos";

/**
 * ownsPhotoPath mirrors the night_post_photos INSERT policy
 * (`split_part(storage_path, '/', 1) = auth.uid()`). The policy is the real
 * boundary — these tests exist so the two cannot drift apart quietly.
 *
 * The attack it closes: deleting a post frees the unique index entry on
 * storage_path while the file itself is retained, so a friend who read the
 * path out of the feed could re-attach a deleted friends-only photo to their
 * own 'everyone' post.
 */
const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

describe("ownsPhotoPath", () => {
  it("accepts a path in your own folder", () => {
    expect(ownsPhotoPath(`${ALICE}/abc.jpg`, ALICE)).toBe(true);
  });

  it("rejects another user's path — the re-attachment attack", () => {
    expect(ownsPhotoPath(`${ALICE}/abc.jpg`, BOB)).toBe(false);
  });

  it("rejects a path with no folder at all", () => {
    expect(ownsPhotoPath("abc.jpg", ALICE)).toBe(false);
  });

  it("rejects an empty user id rather than matching an empty first segment", () => {
    // '/abc.jpg'.split('/')[0] === '' — without the guard this would pass for
    // a signed-out caller.
    expect(ownsPhotoPath("/abc.jpg", "")).toBe(false);
  });

  it("does not accept the id merely appearing later in the path", () => {
    expect(ownsPhotoPath(`${BOB}/${ALICE}.jpg`, ALICE)).toBe(false);
  });

  it("does not accept a folder that only starts with the id", () => {
    expect(ownsPhotoPath(`${ALICE}extra/abc.jpg`, ALICE)).toBe(false);
  });

  it("handles nested paths by looking only at the first segment", () => {
    expect(ownsPhotoPath(`${ALICE}/nested/abc.jpg`, ALICE)).toBe(true);
    expect(ownsPhotoPath(`${BOB}/nested/abc.jpg`, ALICE)).toBe(false);
  });
});
