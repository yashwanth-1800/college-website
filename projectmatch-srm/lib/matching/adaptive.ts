import type { ComponentKey, MatchWeights } from "./types";

export type WeightFeedback = { decision: "ACCEPTED" | "REJECTED"; components: Record<ComponentKey, number> };

export function adaptWeights(defaults: MatchWeights, feedback: WeightFeedback[]): MatchWeights {
  if (feedback.length < 5) return { ...defaults };
  const keys = Object.keys(defaults) as ComponentKey[];
  const adjusted = Object.fromEntries(keys.map((key) => {
    const signal = feedback.reduce((sum, item) => sum + (item.decision === "ACCEPTED" ? 1 : -1) * (item.components[key] / 100), 0) / feedback.length;
    const min = defaults[key] * 0.6; const max = defaults[key] * 1.4;
    return [key, Math.max(min, Math.min(max, defaults[key] * (1 + 0.25 * signal)))];
  })) as MatchWeights;
  const total = Object.values(adjusted).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(keys.map((key) => [key, adjusted[key] * 100 / total])) as MatchWeights;
}

