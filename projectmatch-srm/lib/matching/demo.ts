import { people, projects, type DemoPerson, type DemoProject } from "../demo-data";
import { score } from "./score";
import type { Candidate, MatchingConfig, Project, Role } from "./types";
import { DEFAULT_WEIGHTS } from "./weights";

const skillEdges = [
  { fromSkillId: "Next.js", toSkillId: "React", weight: 0.9 },
  { fromSkillId: "Python", toSkillId: "Data Science", weight: 0.85 },
  { fromSkillId: "Data Analysis", toSkillId: "Data Science", weight: 0.8 },
  { fromSkillId: "CAD", toSkillId: "CAD/CAM", weight: 0.85 },
  { fromSkillId: "IoT", toSkillId: "Embedded Systems", weight: 0.78 },
  { fromSkillId: "UI/UX", toSkillId: "UI/UX Design", weight: 0.9 },
  { fromSkillId: "Computer Vision", toSkillId: "AI/ML", weight: 0.72 },
];

const weeklyBlocks = (days: number[]) => days.flatMap((dayOfWeek) => [1, 2].map((slot) => ({ dayOfWeek, slot, source: "MANUAL" as const, timezone: "Asia/Kolkata" })));

export function demoCandidate(person: DemoPerson): Candidate {
  return {
    id: person.handle, name: person.name,
    skills: person.skills.map((skillId, index) => ({ skillId, proficiency: Math.max(3, 5 - index) })),
    interests: person.interests ?? person.skills.slice(0, 2),
    availability: weeklyBlocks(person.availableDays), hoursPerWeek: 8,
    experienceLevel: person.year === "4th Year" ? "ADVANCED" : person.year === "1st Year" ? "BEGINNER" : "INTERMEDIATE",
    reliabilityScore: 72 + (person.handle.length % 20), isVerified: person.verified ?? true,
    workStyle: { asyncPreference: 3, planningStyle: 2 + (person.handle.length % 4), chronotype: 3, feedbackDirectness: 3, riskAppetite: 2 + (person.skills.length % 3), leadershipInclination: 1 + (person.name.length % 5) },
  };
}

export function demoMatchingProject(item: DemoProject): { project: Project; role: Role } {
  const role: Role = {
    id: `${item.id}-primary-role`, title: item.openRoles[0] ?? "Project teammate", seats: Math.max(1, item.roles),
    skills: item.categories.map((skillId, index) => ({ skillId, minProficiency: index === 0 ? 4 : 3, weight: Math.max(1, 3 - index), isRequired: index < 2 })),
    hoursPerWeek: Number.parseInt(item.commitment, 10) || 6, minExperienceLevel: "INTERMEDIATE",
    availability: weeklyBlocks([0, 2, 4]),
  };
  return {
    role,
    project: { id: item.id, title: item.title, type: item.type.toUpperCase(), interests: item.categories, roles: [role], startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") },
  };
}

export function demoMatches(projectId: string) {
  const item = projects.find((entry) => entry.id === projectId) ?? projects[0];
  const { project, role } = demoMatchingProject(item);
  const config: MatchingConfig = { weights: { ...DEFAULT_WEIGHTS }, skillEdges, collaborations: [{ userAId: "priya-nair", userBId: "arjun-mehta", count: 4 }], now: new Date("2026-06-01") };
  return people.map((person) => {
    const candidate = demoCandidate(person);
    return { person, candidate, result: score(candidate, role, project, [], config) };
  }).sort((a, b) => b.result.total - a.result.total || a.person.handle.localeCompare(b.person.handle));
}

