import { describe, it, expect } from "vitest";
import { ageFromBirthday, isUnderMinimum, bandFromBirthday, MIN_AGE } from "./birthday";

const NOW = new Date("2026-08-05T12:00:00Z");

describe("ageFromBirthday", () => {
  it("computes whole years", () => {
    expect(ageFromBirthday("2000-08-05", NOW)).toBe(26);
    expect(ageFromBirthday("2000-08-04", NOW)).toBe(26);
  });

  it("does not count a birthday that has not happened yet this year", () => {
    expect(ageFromBirthday("2000-08-06", NOW)).toBe(25);
    expect(ageFromBirthday("2000-12-31", NOW)).toBe(25);
  });

  it("handles a 29 Feb birthday in a non-leap year", () => {
    expect(ageFromBirthday("2004-02-29", NOW)).toBe(22);
  });

  it("returns null for an unparseable or future date", () => {
    expect(ageFromBirthday("not-a-date", NOW)).toBeNull();
    expect(ageFromBirthday("2030-01-01", NOW)).toBeNull();
  });
});

describe("isUnderMinimum", () => {
  it("is false on the 13th birthday and true the day before", () => {
    expect(MIN_AGE).toBe(13);
    expect(isUnderMinimum("2013-08-05", NOW)).toBe(false);
    expect(isUnderMinimum("2013-08-06", NOW)).toBe(true);
  });

  it("treats an unparseable date as under minimum, failing closed", () => {
    expect(isUnderMinimum("", NOW)).toBe(true);
  });

  it("does not gate on drinking age", () => {
    expect(isUnderMinimum("2008-01-01", NOW)).toBe(false); // 18
    expect(isUnderMinimum("2006-01-01", NOW)).toBe(false); // 20
  });
});

describe("bandFromBirthday", () => {
  it("maps ages onto the existing bands", () => {
    expect(bandFromBirthday("2004-01-01", NOW)).toBe("21-23");
    expect(bandFromBirthday("2001-01-01", NOW)).toBe("24-26");
    expect(bandFromBirthday("1997-01-01", NOW)).toBe("27-30");
    expect(bandFromBirthday("1980-01-01", NOW)).toBe("31+");
  });

  it("returns null under 21 — no band exists down there", () => {
    expect(bandFromBirthday("2008-01-01", NOW)).toBeNull();
  });
});
