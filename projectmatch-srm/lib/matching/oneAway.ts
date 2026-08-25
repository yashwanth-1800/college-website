import { coverageRatio } from "./gaps";
import { score } from "./score";
import type { Candidate, MatchingConfig, Project, Role, TeamMember } from "./types";

export function findHighestImpactGap(project: Project, candidates: Candidate[], team: TeamMember[], config: MatchingConfig): { role: Role; candidates: Candidate[]; coverageDelta: number } | null {
  const before = coverageRatio(project, team, config.skillEdges);
  const ranked = project.roles.map((role) => {
    const matches = candidates.map((candidate) => ({ candidate, result: score(candidate, role, project, team, config) }))
      .filter((item) => !item.result.hardFilterFailed)
      .sort((a, b) => b.result.total - a.result.total || a.candidate.id.localeCompare(b.candidate.id));
    const best = matches[0];
    const after = best ? coverageRatio(project, [...team, { ...best.candidate, roleId: role.id }], config.skillEdges) : before;
    return { role, candidates: matches.slice(0, 3).map((item) => item.candidate), coverageDelta: after - before };
  }).sort((a, b) => b.coverageDelta - a.coverageDelta || a.role.id.localeCompare(b.role.id));
  return ranked[0] ?? null;
}

