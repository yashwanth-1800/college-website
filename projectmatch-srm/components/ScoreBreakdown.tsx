import type { MatchResult } from "@/lib/matching";

const labels = { skillFit: "Skill fit", gapCoverage: "Gap coverage", availability: "Availability", interest: "Interests", experience: "Experience", chemistry: "Chemistry", novelty: "Network break" } as const;

export function ScoreBreakdown({ result }: { result: MatchResult }) {
  return <dl className="space-y-3">{Object.entries(result.components).map(([key, component]) => <div key={key}><div className="flex justify-between gap-3 text-xs"><dt>{labels[key as keyof typeof labels]}</dt><dd>{component.weighted.toFixed(1)} / {component.max}</dd></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${component.raw}%` }} /></div></div>)}</dl>;
}

