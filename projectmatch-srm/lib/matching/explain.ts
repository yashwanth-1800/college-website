import type { MatchResult } from "./types";

export function explain(result: MatchResult): string[] {
  return [...result.explanation, ...result.warnings.map((warning) => `Watch-out: ${warning}`)];
}

