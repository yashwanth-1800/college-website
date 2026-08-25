import { coverageRatio } from "./gaps";
import { score } from "./score";
import type { Candidate, MatchingConfig, Project, TeamMember, TeamSelection } from "./types";

export type OptimizeOptions = { locked?: TeamSelection[] };
export type OptimizeResult = { selections: TeamSelection[]; coverageBefore: number; coverageAfter: number };

export function optimizeTeam(project: Project, candidates: Candidate[], team: TeamMember[], config: MatchingConfig, options: OptimizeOptions = {}): OptimizeResult {
  const selections = [...(options.locked ?? [])];
  const selectedIds = new Set(selections.map((item) => item.candidate.id));
  const workingTeam: TeamMember[] = [...team, ...selections.map((item) => ({ ...item.candidate, roleId: item.roleId }))];
  const coverageBefore = coverageRatio(project, team, config.skillEdges);

  for (const role of [...project.roles].sort((a, b) => a.id.localeCompare(b.id))) {
    const alreadyFilled = selections.filter((item) => item.roleId === role.id).length;
    for (let seat = alreadyFilled; seat < role.seats; seat += 1) {
      const ranked = candidates.filter((candidate) => !selectedIds.has(candidate.id)).map((candidate) => ({ candidate, result: score(candidate, role, project, workingTeam, config) }))
        .filter((item) => !item.result.hardFilterFailed)
        .sort((a, b) => b.result.total - a.result.total || a.candidate.id.localeCompare(b.candidate.id));
      const best = ranked[0];
      if (!best) break;
      const selection = { roleId: role.id, candidate: best.candidate, score: best.result };
      selections.push(selection); selectedIds.add(best.candidate.id); workingTeam.push({ ...best.candidate, roleId: role.id });
    }
  }
  return { selections, coverageBefore, coverageAfter: coverageRatio(project, workingTeam, config.skillEdges) };
}

export function rerankDiverse(results: { candidate: Candidate; score: number }[], lambda = 0.82): { candidate: Candidate; score: number }[] {
  const pending = [...results]; const selected: typeof results = [];
  const similarity = (a: Candidate, b: Candidate) => {
    const left = new Set(a.skills.map((skill) => skill.skillId));
    const right = new Set(b.skills.map((skill) => skill.skillId));
    const union = new Set([...left, ...right]);
    return union.size === 0 ? 0 : [...left].filter((skill) => right.has(skill)).length / union.size;
  };
  while (pending.length > 0) {
    pending.sort((a, b) => {
      const adjusted = (item: typeof a) => lambda * item.score - (1 - lambda) * Math.max(0, ...selected.map((chosen) => similarity(item.candidate, chosen.candidate) * 100));
      return adjusted(b) - adjusted(a) || a.candidate.id.localeCompare(b.candidate.id);
    });
    selected.push(pending.shift()!);
  }
  return selected;
}

