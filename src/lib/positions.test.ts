import { describe, expect, it } from "vitest";
import { autoSlots, presetsFor, shapeOf } from "./positions";

describe("formation presets", () => {
  it("lists playable futsal 6v6 shapes for 5 outfield players", () => {
    const names = presetsFor("futsal6", 5).map(p => p.name);
    expect(names).toContain("1-2-2");
    expect(names).toContain("2-2-1");
  });

  it("offers the classic 5v5 shapes", () => {
    const names = presetsFor("futsal5", 4).map(p => p.name);
    expect(names).toEqual(expect.arrayContaining(["1-2-1", "2-2", "3-1"]));
  });

  it("spreads a line across distinct slots instead of stacking", () => {
    const slots = autoSlots({ GK: [1], DF: [2, 3], MF: [4, 5], FW: [6] }, "futsal6");
    expect(new Set(Object.values(slots)).size).toBe(6);
    expect(shapeOf(slots, "futsal6")).toBe("2-2-1");
  });

  it("re-slots into a requested football shape", () => {
    const unit = { GK: [1], DF: [2, 3, 4], MF: [5, 6, 7, 8], FW: [9, 10, 11] };
    const slots = autoSlots(unit, "s11", "4-3-3");
    expect(shapeOf(slots, "s11")).toBe("4-3-3");
  });
});
