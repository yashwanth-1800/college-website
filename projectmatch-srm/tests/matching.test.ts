import { describe, expect, it } from "vitest";
import { candidateProjectFit, harmonicMean, score, scoreGapCoverage, scoreSkillFit } from "../lib/matching";
import { candidate, config, project, role, teamMember } from "./fixtures";

describe("skill fit", () => {
  it("scores an exact match and caps over-qualification", () => {
    const exact = scoreSkillFit([{ skillId: "React", proficiency: 4 }], [role.skills[0]], []);
    const over = scoreSkillFit([{ skillId: "React", proficiency: 5 }], [role.skills[0]], []);
    expect(exact.raw).toBe(1);
    expect(over.raw).toBe(1);
  });

  it("applies the required-skill penalty", () => {
    const result = scoreSkillFit([], role.skills, []);
    expect(result.raw).toBe(0);
    expect(result.missing).toEqual(["React"]);
  });

  it("uses the strongest one-hop adjacency and never traverses two hops", () => {
    const adjacent = scoreSkillFit([{ skillId: "Next.js", proficiency: 4 }], [role.skills[0]], config.skillEdges);
    const twoHop = scoreSkillFit([{ skillId: "Vue", proficiency: 4 }], [role.skills[0]], [...config.skillEdges, { fromSkillId: "Vue", toSkillId: "Next.js", weight: 1 }]);
    expect(adjacent.matched[0]).toMatchObject({ via: "adjacent", strength: 0.9 });
    expect(twoHop.missing).toEqual(["React"]);
  });
});

describe("complementarity and two-sided fit", () => {
  it("scores the same candidate differently when one team already covers their skill", () => {
    const uncovered = scoreGapCoverage(candidate(), project, [teamMember()], config.skillEdges);
    const covered = scoreGapCoverage(candidate(), project, [teamMember({ skills: [{ skillId: "React", proficiency: 5 }] })], config.skillEdges);
    expect(uncovered.raw).toBeGreaterThan(covered.raw);
    expect(uncovered.unique).toContain("React");
  });

  it("uses a harmonic mean so one-sided matches rank lower", () => {
    expect(harmonicMean(90, 90)).toBe(90);
    expect(harmonicMean(90, 20)).toBeLessThan(40);
    expect(candidateProjectFit(candidate(), role, project)).toBeGreaterThan(50);
  });

  it("hard-filters expired projects", () => {
    const result = score(candidate(), role, { ...project, endDate: new Date("2025-12-31") }, [], config);
    expect(result.hardFilterFailed).toBe(true);
    expect(result.warnings[0]).toContain("ended");
  });
});

