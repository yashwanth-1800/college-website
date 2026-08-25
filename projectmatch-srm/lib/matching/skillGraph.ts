import type { SkillEdge, SkillProficiency, SkillRequirement } from "./types";

export type SkillSatisfaction = {
  raw: number;
  via?: "direct" | "adjacent";
  sourceSkillId?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function strongestSkillMatch(
  candidateSkills: SkillProficiency[],
  requirement: SkillRequirement,
  edges: SkillEdge[],
): SkillSatisfaction {
  const direct = candidateSkills.find((skill) => skill.skillId === requirement.skillId);
  if (direct) {
    return { raw: clamp(direct.proficiency / requirement.minProficiency), via: "direct", sourceSkillId: direct.skillId };
  }

  let best: SkillSatisfaction = { raw: 0 };
  for (const skill of candidateSkills) {
    const edge = edges.find((item) =>
      (item.fromSkillId === skill.skillId && item.toSkillId === requirement.skillId) ||
      (item.toSkillId === skill.skillId && item.fromSkillId === requirement.skillId));
    if (!edge) continue;
    const raw = clamp(skill.proficiency / requirement.minProficiency) * clamp(edge.weight);
    if (raw > best.raw) best = { raw, via: "adjacent", sourceSkillId: skill.skillId };
  }
  return best;
}

export function scoreSkillFit(
  candidateSkills: SkillProficiency[],
  requirements: SkillRequirement[],
  edges: SkillEdge[],
): { raw: number; matched: { skillId: string; via: "direct" | "adjacent"; strength: number }[]; missing: string[] } {
  if (requirements.length === 0) return { raw: 1, matched: [], missing: [] };
  let earned = 0;
  let possible = 0;
  let missingRequired = 0;
  const matched: { skillId: string; via: "direct" | "adjacent"; strength: number }[] = [];
  const missing: string[] = [];

  for (const requirement of requirements) {
    const importance = requirement.weight * (requirement.isRequired ? 1 : 0.4);
    possible += importance;
    const satisfaction = strongestSkillMatch(candidateSkills, requirement, edges);
    earned += satisfaction.raw * importance;
    if (satisfaction.via) matched.push({ skillId: requirement.skillId, via: satisfaction.via, strength: satisfaction.raw });
    else if (requirement.isRequired) { missing.push(requirement.skillId); missingRequired += 1; }
  }

  const penalty = Math.pow(0.85, missingRequired);
  return { raw: possible === 0 ? 1 : clamp((earned / possible) * penalty), matched, missing };
}

