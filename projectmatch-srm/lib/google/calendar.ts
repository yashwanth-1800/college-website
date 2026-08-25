import mockData from "./freebusy.mock.json";
import type { AvailabilityBlock } from "../matching";

export type BusyInterval = { start: string; end: string };
export type FreeBusyRequest = { timeMin: Date; timeMax: Date; timezone: string };

export interface CalendarAdapter {
  getBusyIntervals(request: FreeBusyRequest): Promise<BusyInterval[]>;
  disconnectAndPurge(userId: string): Promise<void>;
}

export class MockCalendarAdapter implements CalendarAdapter {
  async getBusyIntervals(request: FreeBusyRequest): Promise<BusyInterval[]> {
    return mockData.busy.filter((interval) => new Date(interval.end) > request.timeMin && new Date(interval.start) < request.timeMax);
  }
  async disconnectAndPurge(): Promise<void> { return Promise.resolve(); }
}

const HOURS = [9, 13, 17, 21] as const;

export function aggregateFreeBusy(
  busy: BusyInterval[],
  start: Date,
  days = 28,
  timezone = "Asia/Kolkata",
): AvailabilityBlock[] {
  const busyRanges = busy.map((item) => [new Date(item.start).getTime(), new Date(item.end).getTime()] as const);
  const free = new Map<string, AvailabilityBlock>();
  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      const slotStart = new Date(start);
      slotStart.setUTCDate(start.getUTCDate() + dayOffset);
      slotStart.setUTCHours(HOURS[slot], 0, 0, 0);
      const slotEnd = slotStart.getTime() + 4 * 3_600_000;
      const occupied = busyRanges.some(([from, to]) => from < slotEnd && to > slotStart.getTime());
      if (!occupied) {
        const dayOfWeek = (slotStart.getUTCDay() + 6) % 7;
        free.set(String(dayOfWeek) + ":" + String(slot), { dayOfWeek, slot, source: "GOOGLE_CALENDAR", timezone });
      }
    }
  }
  return [...free.values()].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.slot - b.slot);
}

export function calendarAdapter(): CalendarAdapter {
  return new MockCalendarAdapter();
}
