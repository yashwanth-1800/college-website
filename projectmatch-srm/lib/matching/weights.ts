import type { MatchWeights } from "./types";

export const DEFAULT_WEIGHTS = {
  skillFit: 30,
  gapCoverage: 22,
  availability: 18,
  interest: 10,
  experience: 8,
  chemistry: 7,
  novelty: 5,
} as const satisfies MatchWeights;

export const DIVERSITY_LAMBDA = 0.82;

