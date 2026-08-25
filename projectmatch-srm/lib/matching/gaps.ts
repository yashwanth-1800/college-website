import { strongestSkillMatch } from "./skillGraph";
import type { Candidate, Project, SkillEdge, TeamMember } from "./types";

export function unmetSkillDemand(project: Project, team: TeamMember[], edges: SkillEdge[]): string[] {
  const requirements = project.roles.filter((role) => role.seats > 0).flatMap((role) => role.skills.filter((skill) => skill.isRequired));
  return [...new Set(requirements.filter((requirement) =>
    !team.some((member) => strongestSkillMatch(member.skills, requirement, edges).raw >= 1),
  ).map((requirement) => requirement.skillId))];
}

export function scoreGapCoverage(candidate: Candidate, project: Project, team: TeamMember[], edges: SkillEdge[]): { raw: number; unique: string[] } {
  const requirements = project.roles.flatMap((role) => role.skills.filter((skill) => skill.isRequired));
  if (requirements.length === 0) return { raw: 1, unique: [] };
  const unique: string[] = [];
  let earned = 0;
  let possible = 0;
  for (const requirement of requirements) {
    const teamCovers = team.some((member) => strongestSkillMatch(member.skills, requirement, edges).raw >= 1);
    const importance = requirement.weight;
    possible += importance;
    const match = strongestSkillMatch(candidate.skills, requirement, edges).raw;
    earned += match * importance * (teamCovers ? 0.25 : 1);
    if (!teamCovers && match > 0) unique.push(requirement.skillId);
  }
  return { raw: possible === 0 ? 0 : Math.min(1, earned / possible), unique: [...new Set(unique)] };
}

export function coverageRatio(project: Project, team: TeamMember[], edges: SkillEdge[]): number {
  const required = [...new Set(project.roles.flatMap((role) => role.skills.filter((skill) => skill.isRequired).map((skill) => skill.skillId)))];
  if (required.length === 0) return 1;
  return required.filter((skillId) => {
    const requirement = project.roles.flatMap((role) => role.skills).find((skill) => skill.skillId === skillId);
    return requirement ? team.some((member) => strongestSkillMatch(member.skills, requirement, edges).raw >= 1) : false;
  }).length / required.length;
}
