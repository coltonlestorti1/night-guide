import { describe, it, expect } from "vitest";
import {
  defaultAudience,
  audienceOptions,
  AUDIENCE_LABELS,
  AUDIENCE_SHORT,
  type Audience,
} from "./audience";

describe("defaultAudience", () => {
  it("is school when the user has a college", () => {
    expect(defaultAudience("hws")).toBe("school");
  });

  it("falls back to friends when the college is missing", () => {
    // A school post from a null-college user matches nobody. Never publish into
    // an empty audience while the UI implies one. Measured 2026-08-06: 36% of
    // profiles had no college_slug, and nulls were still being created.
    expect(defaultAudience(null)).toBe("friends");
    expect(defaultAudience(undefined)).toBe("friends");
    expect(defaultAudience("")).toBe("friends");
  });

  it("never defaults to everyone", () => {
    for (const slug of ["hws", null, undefined, ""]) {
      expect(defaultAudience(slug)).not.toBe("everyone");
    }
  });

  it("never defaults to nobody — a default that reaches no one is a bug", () => {
    for (const slug of ["hws", null, undefined, ""]) {
      expect(defaultAudience(slug)).not.toBe("nobody");
    }
  });
});

describe("audienceOptions", () => {
  it("omits school when there is no college to scope to", () => {
    expect(audienceOptions(null)).not.toContain("school");
    expect(audienceOptions("hws")).toContain("school");
  });

  it("always offers everyone, friends and nobody", () => {
    for (const slug of ["hws", null]) {
      const opts = audienceOptions(slug);
      expect(opts).toEqual(expect.arrayContaining(["everyone", "friends", "nobody"]));
    }
  });

  it("orders widest to narrowest", () => {
    expect(audienceOptions("hws")).toEqual(["everyone", "school", "friends", "nobody"]);
    expect(audienceOptions(null)).toEqual(["everyone", "friends", "nobody"]);
  });

  it("always contains whatever defaultAudience returns", () => {
    // Otherwise the picker opens on a value it cannot show.
    for (const slug of ["hws", null, undefined, ""]) {
      expect(audienceOptions(slug)).toContain(defaultAudience(slug));
    }
  });
});

describe("AUDIENCE_LABELS", () => {
  it("describes the audience, not the setting name", () => {
    expect(AUDIENCE_LABELS.everyone).toBe("Everyone on ENDZ");
    expect(AUDIENCE_LABELS.school).toBe("People at my school");
    expect(AUDIENCE_LABELS.friends).toBe("Friends only");
    expect(AUDIENCE_LABELS.nobody).toBe("Just me");
  });

  it("labels every audience value", () => {
    const all: Audience[] = ["everyone", "school", "friends", "nobody"];
    for (const a of all) expect(AUDIENCE_LABELS[a]).toBeTruthy();
  });
});

describe("AUDIENCE_SHORT", () => {
  it("labels every audience value", () => {
    const all: Audience[] = ["everyone", "school", "friends", "nobody"];
    for (const a of all) expect(AUDIENCE_SHORT[a]).toBeTruthy();
  });

  it("stays short enough for a chip row", () => {
    for (const v of Object.values(AUDIENCE_SHORT)) expect(v.length).toBeLessThanOrEqual(10);
  });
});
