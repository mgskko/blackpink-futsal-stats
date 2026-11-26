import { describe, expect, it } from "vitest";
import { localISODate, parseLocalDate } from "./utils";

describe("localISODate", () => {
  it("uses the local calendar day, not UTC", () => {
    // 2026-03-05 01:30 local time — in KST this is still 2026-03-04 in UTC.
    const early = new Date(2026, 2, 5, 1, 30);
    expect(localISODate(early)).toBe("2026-03-05");
  });

  it("zero-pads month and day", () => {
    expect(localISODate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("parseLocalDate", () => {
  it("round-trips with localISODate", () => {
    for (const key of ["2025-12-31", "2026-01-01", "2026-02-28"]) {
      expect(localISODate(parseLocalDate(key))).toBe(key);
    }
  });

  it("yields the correct local weekday", () => {
    expect(parseLocalDate("2026-11-26").getDay()).toBe(4); // Thursday
  });
});
