import { describe, expect, it } from "vitest";
import { aggregateFreeBusy, MockCalendarAdapter } from "../lib/google/calendar";

describe("calendar privacy adapter", () => {
  it("uses the offline mock without network access", async () => {
    const adapter = new MockCalendarAdapter();
    const busy = await adapter.getBusyIntervals({ timeMin: new Date("2026-01-01"), timeMax: new Date("2026-02-01"), timezone: "Asia/Kolkata" });
    expect(busy).toHaveLength(2);
  });

  it("stores only aggregate weekly free blocks and removes busy slots", () => {
    const free = aggregateFreeBusy([{ start: "2026-01-05T09:00:00Z", end: "2026-01-05T13:00:00Z" }], new Date("2026-01-05T00:00:00Z"), 7, "UTC");
    expect(free).toHaveLength(27);
    expect(free).not.toContainEqual({ dayOfWeek: 0, slot: 0, source: "GOOGLE_CALENDAR", timezone: "UTC" });
  });
});
