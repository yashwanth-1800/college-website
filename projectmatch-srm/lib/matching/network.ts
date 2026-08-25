import type { Collaboration, TeamMember } from "./types";

function touches(edge: Collaboration, userId: string): string | undefined {
  if (edge.userAId === userId) return edge.userBId;
  if (edge.userBId === userId) return edge.userAId;
  return undefined;
}

export function degreesOfSeparation(fromId: string, targets: string[], graph: Collaboration[], maxDepth = 3): number | null {
  if (targets.includes(fromId)) return 0;
  let frontier = [fromId];
  const visited = new Set(frontier);
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next: string[] = [];
    for (const userId of frontier) {
      for (const edge of graph) {
        const neighbour = touches(edge, userId);
        if (!neighbour || visited.has(neighbour)) continue;
        if (targets.includes(neighbour)) return depth;
        visited.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return null;
}

export function scoreNovelty(candidateId: string, team: TeamMember[], graph: Collaboration[]): { raw: number; degrees: number | null; repeated: boolean } {
  if (team.length === 0) return { raw: 1, degrees: null, repeated: false };
  const teamIds = team.map((member) => member.id);
  const prior = graph.filter((edge) =>
    (edge.userAId === candidateId && teamIds.includes(edge.userBId)) ||
    (edge.userBId === candidateId && teamIds.includes(edge.userAId)));
  const count = prior.reduce((sum, edge) => sum + edge.count, 0);
  return {
    raw: count === 0 ? 1 : Math.max(0.15, 1 / (1 + count * 0.45)),
    degrees: degreesOfSeparation(candidateId, teamIds, graph),
    repeated: count >= 3,
  };
}

