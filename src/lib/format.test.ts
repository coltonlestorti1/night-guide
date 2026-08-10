import { describe, it, expect } from "vitest";
import { formatMemberSince } from "./format";

describe("formatMemberSince", () => {
  it("renders the month and year of the join date", () => {
    expect(formatMemberSince("2025-06-14T18:04:00Z")).toBe("June 2025");
  });

  it("returns null for missing or unparseable input, so the line is simply omitted", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince(undefined)).toBeNull();
    expect(formatMemberSince("")).toBeNull();
    expect(formatMemberSince("not a date")).toBeNull();
  });
});
