import type { Candidate, MatchingConfig, Project, Role, TeamMember } from "../lib/matching";
import { DEFAULT_WEIGHTS } from "../lib/matching";

export const blocks = (slots: number[], source: "MANUAL" | "GOOGLE_CALENDAR" = "MANUAL", timezone = "UTC") =>
  slots.map((slot) => ({ dayOfWeek: 0, slot, source, timezone }));

export const role: Role = {
  id: "frontend", title: "Frontend engineer", seats: 1, hoursPerWeek: 6,
  minExperienceLevel: "INTERMEDIATE", availability: blocks([0, 1]),
  skills: [
    { skillId: "React", minProficiency: 4, weight: 3, isRequired: true },
    { skillId: "UI Design", minProficiency: 3, weight: 1, isRequired: false },
  ],
};

export const project: Project = {
  id: "p1", title: "Campus Carbon Map", type: "HACKATHON", interests: ["climate", "web"],
  roles: [role], startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z"),
};

export const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "candidate", name: "Candidate", skills: [{ skillId: "React", proficiency: 4 }],
  interests: ["climate"], availability: blocks([0, 1]), hoursPerWeek: 8,
  experienceLevel: "INTERMEDIATE", reliabilityScore: 80, isVerified: true,
  workStyle: { asyncPreference: 3, planningStyle: 5, chronotype: 3, feedbackDirectness: 3, riskAppetite: 3, leadershipInclination: 5 },
  ...overrides,
});

export const teamMember = (overrides: Partial<TeamMember> = {}): TeamMember => candidate({
  id: "member", name: "Existing member", skills: [{ skillId: "Python", proficiency: 4 }],
  workStyle: { asyncPreference: 3, planningStyle: 1, chronotype: 3, feedbackDirectness: 3, riskAppetite: 2, leadershipInclination: 1 },
  ...overrides,
});

export const config: MatchingConfig = {
  weights: { ...DEFAULT_WEIGHTS }, now: new Date("2026-06-01T00:00:00Z"),
  skillEdges: [
    { fromSkillId: "Next.js", toSkillId: "React", weight: 0.9 },
    { fromSkillId: "Figma", toSkillId: "UI Design", weight: 0.8 },
  ],
  collaborations: [],
};

