import { describe, expect, it } from "vitest";
import { adaptWeights, DEFAULT_WEIGHTS, type ComponentKey } from "../lib/matching";

describe("adaptive weights", () => {
  it("waits for five decisions", () => {
    expect(adaptWeights(DEFAULT_WEIGHTS, [])).toEqual(DEFAULT_WEIGHTS);
  });

  it("stays clamped, non-negative, and normalized to 100", () => {
    const components = Object.fromEntries((Object.keys(DEFAULT_WEIGHTS) as ComponentKey[]).map((key) => [key, key === "availability" ? 100 : 0])) as Record<ComponentKey, number>;
    const result = adaptWeights(DEFAULT_WEIGHTS, Array.from({ length: 8 }, () => ({ decision: "ACCEPTED" as const, components })));
    expect(Object.values(result).every((value) => value >= 0)).toBe(true);
    expect(result.availability).toBeLessThanOrEqual(DEFAULT_WEIGHTS.availability * 1.4);
    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 8);
  });
});

