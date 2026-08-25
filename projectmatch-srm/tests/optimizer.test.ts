import { describe, expect, it } from "vitest";
import { optimizeTeam } from "../lib/matching";
import { candidate, config, project, role } from "./fixtures";

describe("team optimizer", () => {
  it("respects seat counts and locked members", () => {
    const lockedCandidate = candidate({ id: "locked" });
    const locked = { roleId: role.id, candidate: lockedCandidate, score: optimizeTeam(project, [lockedCandidate], [], config).selections[0].score };
    const result = optimizeTeam(project, [lockedCandidate, candidate({ id: "other" })], [], config, { locked: [locked] });
    expect(result.selections).toHaveLength(1);
    expect(result.selections[0].candidate.id).toBe("locked");
  });

  it("is deterministic across repeated runs", () => {
    const candidates = [candidate({ id: "b" }), candidate({ id: "a" })];
    const first = optimizeTeam(project, candidates, [], config).selections.map((item) => item.candidate.id);
    const second = optimizeTeam(project, candidates, [], config).selections.map((item) => item.candidate.id);
    expect(first).toEqual(second);
    expect(first).toEqual(["a"]);
  });
});

