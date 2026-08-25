import { fromZonedTime } from "date-fns-tz";
import type { AvailabilityBlock } from "./types";

const SLOT_HOURS = [9, 13, 17, 21] as const;
const ANCHOR_MONDAY = 5;

export function canonicalSlot(block: AvailabilityBlock): string {
  const timezone = block.timezone ?? "UTC";
  const local = new Date(Date.UTC(2026, 0, ANCHOR_MONDAY + block.dayOfWeek, SLOT_HOURS[block.slot] ?? 9));
  const utc = fromZonedTime(local, timezone);
  const day = (utc.getUTCDay() + 6) % 7;
  const slot = Math.max(0, Math.min(3, Math.floor((utc.getUTCHours() + 2) / 6)));
  return `${day}:${slot}`;
}

export function normalizeAvailability(blocks: AvailabilityBlock[]): Set<string> {
  return new Set(blocks.map(canonicalSlot));
}

export function scoreAvailability(
  candidate: AvailabilityBlock[],
  required: AvailabilityBlock[],
  candidateHours: number,
  requiredHours: number,
  lastSyncedAt: Date | undefined,
  now: Date,
): { raw: number; overlapRatio: number; overlapCount: number; trust: number } {
  const candidateSet = normalizeAvailability(candidate);
  const requiredSet = normalizeAvailability(required);
  const overlapCount = [...candidateSet].filter((slot) => requiredSet.has(slot)).length;
  const denominator = Math.min(candidateSet.size, requiredSet.size);
  const overlapRatio = denominator === 0 ? 0 : overlapCount / denominator;
  const hoursRatio = requiredHours <= 0 ? 1 : Math.min(candidateHours / requiredHours, 1);
  const overlappingBlocks = candidate.filter((block) => requiredSet.has(canonicalSlot(block)));
  const calendarRatio = overlappingBlocks.length === 0 ? 0 : overlappingBlocks.filter((block) => block.source === "GOOGLE_CALENDAR").length / overlappingBlocks.length;
  const trust = 0.9 + (0.1 * calendarRatio);
  const isFresh = lastSyncedAt !== undefined && now.getTime() - lastSyncedAt.getTime() <= 7 * 86_400_000;
  return {
    raw: Math.min(1, (0.65 * overlapRatio + 0.35 * hoursRatio) * trust * (isFresh ? 1.05 : 1)),
    overlapRatio,
    overlapCount,
    trust,
  };
}

export function suggestKickoffSlots(memberBlocks: AvailabilityBlock[][]): string[] {
  if (memberBlocks.length === 0) return [];
  const sets = memberBlocks.map(normalizeAvailability);
  return [...sets[0]].filter((slot) => sets.every((set) => set.has(slot))).sort();
}

