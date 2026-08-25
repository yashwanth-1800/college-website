import { scoreAvailability } from "./availability";
import { scoreChemistry } from "./chemistry";
import { scoreGapCoverage } from "./gaps";
import { scoreNovelty } from "./network";
import { scoreSkillFit } from "./skillGraph";
import type { Candidate, ComponentKey, MatchResult, MatchingConfig, Project, Role, TeamMember } from "./types";

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const round = (value: number) => Math.round(value * 10) / 10;

function cosine(left: string[], right: string[]): number {
  const a = new Set(left); const b = new Set(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((value) => b.has(value)).length;
  return intersection / Math.sqrt(a.size * b.size);
}

function experienceRaw(candidate: Candidate, role: Role): number {
  const candidateLevel = LEVELS.indexOf(candidate.experienceLevel);
  const minimum = LEVELS.indexOf(role.minExperienceLevel);
  const distance = candidateLevel - minimum;
  const levelScore = distance < 0 ? Math.max(0.25, 1 + distance * 0.3) : Math.max(0.75, 1 - distance * 0.08);
  const reliability = Math.max(candidate.isVerified ? 0.65 : 0, Math.min(1, candidate.reliabilityScore / 100));
  return 0.65 * levelScore + 0.35 * reliability;
}

export function score(candidate: Candidate, role: Role, project: Project, team: TeamMember[], config: MatchingConfig): MatchResult {
  const skill = scoreSkillFit(candidate.skills, role.skills, config.skillEdges);
  const gaps = scoreGapCoverage(candidate, project, team, config.skillEdges);
  const availability = scoreAvailability(candidate.availability, role.availability, candidate.hoursPerWeek, role.hoursPerWeek, candidate.calendarLastSyncedAt, config.now);
  const chemistry = scoreChemistry(candidate.workStyle, team);
  const novelty = scoreNovelty(candidate.id, team, config.collaborations);
  const interest = Math.min(1, cosine(candidate.interests, project.interests) + (candidate.projectTypeHistory?.includes(project.type) ? 0.1 : 0));
  const raw: Record<ComponentKey, number> = {
    skillFit: skill.raw,
    gapCoverage: gaps.raw,
    availability: availability.raw,
    interest,
    experience: experienceRaw(candidate, role),
    chemistry: chemistry.raw,
    novelty: novelty.raw,
  };
  const components = Object.fromEntries((Object.keys(config.weights) as ComponentKey[]).map((key) => [key, {
    raw: round(raw[key] * 100), weighted: round(raw[key] * config.weights[key]), max: config.weights[key],
  }])) as MatchResult["components"];
  const warnings = [...chemistry.warnings];
  const expired = project.endDate.getTime() < config.now.getTime();
  if (availability.overlapRatio === 0) warnings.unshift("No overlapping availability for this role.");
  if (expired) warnings.unshift("This project's collaboration window has ended.");
  if (novelty.repeated) warnings.push("This candidate has collaborated with the current team at least three times.");
  const explanation: string[] = [];
  if (gaps.unique.length > 0) explanation.push(`Covers the team's unfilled ${gaps.unique.join(", ")} ${gaps.unique.length === 1 ? "gap" : "gaps"}.`);
  for (const match of skill.matched) {
    if (match.via === "adjacent") explanation.push(`${match.skillId} is covered through an adjacent skill at ${Math.round(match.strength * 100)}% transfer.`);
  }
  if (availability.overlapCount > 0) explanation.push(`${availability.overlapCount} shared weekly time ${availability.overlapCount === 1 ? "block" : "blocks"}${availability.trust === 1 ? ", verified from calendar" : ""}.`);
  if (novelty.raw === 1) explanation.push(novelty.degrees ? `New connection — ${novelty.degrees} degrees from the current team.` : "New connection — expands the team beyond prior collaborators.");
  if (explanation.length === 0) explanation.push(`${candidate.name} meets ${Math.round(skill.raw * 100)}% of the weighted skill requirement for ${role.title}.`);
  const total = round((Object.values(components).reduce((sum, component) => sum + component.weighted, 0)));
  return { total, components, explanation, warnings, hardFilterFailed: availability.overlapRatio === 0 || expired, matchedSkills: skill.matched, missingSkills: skill.missing };
}

export function harmonicMean(left: number, right: number): number {
  return left <= 0 || right <= 0 ? 0 : round((2 * left * right) / (left + right));
}

export function candidateProjectFit(candidate: Candidate, role: Role, project: Project): number {
  const learning = role.skills.filter((requirement) => candidate.skills.some((skill) => skill.wantsToLearn && skill.skillId === requirement.skillId)).length;
  const interest = cosine(candidate.interests, project.interests);
  const commitment = Math.min(candidate.hoursPerWeek / Math.max(1, role.hoursPerWeek), 1);
  return round(Math.min(100, (0.5 * interest + 0.35 * commitment + 0.15 * Math.min(1, learning)) * 100));
}
