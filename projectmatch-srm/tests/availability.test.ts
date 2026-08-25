import { describe, expect, it } from "vitest";
import { canonicalSlot, scoreAvailability, suggestKickoffSlots } from "../lib/matching";
import { blocks } from "./fixtures";

describe("availability", () => {
  it("normalizes equivalent local times into the same canonical UTC slot", () => {
    const kolkata = canonicalSlot({ dayOfWeek: 0, slot: 1, source: "MANUAL", timezone: "Asia/Kolkata" });
    const utc = canonicalSlot({ dayOfWeek: 0, slot: 0, source: "MANUAL", timezone: "UTC" });
    expect(kolkata).toBe(utc);
  });

  it("uses zero overlap as a hard-filter signal", () => {
    const result = scoreAvailability(blocks([0]), blocks([2]), 8, 6, undefined, new Date("2026-01-01"));
    expect(result.overlapRatio).toBe(0);
  });

  it("rewards calendar-source trust over manual availability", () => {
    const manual = scoreAvailability(blocks([0]), blocks([0]), 6, 6, undefined, new Date("2026-01-01"));
    const calendar = scoreAvailability(blocks([0], "GOOGLE_CALENDAR"), blocks([0]), 6, 6, undefined, new Date("2026-01-01"));
    expect(calendar.raw).toBeGreaterThan(manual.raw);
    expect(calendar.trust).toBe(1);
  });

  it("only suggests kickoff slots shared by every member", () => {
    expect(suggestKickoffSlots([blocks([0, 1]), blocks([1, 2]), blocks([1])])).toEqual([
      canonicalSlot(blocks([1])[0]),
    ]);
  });
});
