import { describe, expect, it } from "vitest";
import { explain, score } from "../lib/matching";
import { candidate, config, project, role, teamMember } from "./fixtures";

describe("explainability", () => {
  it("emits concrete evidence and no generic filler", () => {
    const result = score(candidate({ skills: [{ skillId: "Next.js", proficiency: 4 }] }), role, project, [teamMember()], config);
    const reasons = explain(result);
    expect(reasons.some((reason) => reason.includes("React") || reason.includes("shared weekly"))).toBe(true);
    expect(reasons.join(" ").toLowerCase()).not.toMatch(/great match|good fit|recommended candidate/);
  });

  it("always explains an otherwise sparse result specifically", () => {
    const result = score(candidate({ interests: [], availability: [] }), role, project, [], config);
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.warnings).toContain("No overlapping availability for this role.");
  });
});
