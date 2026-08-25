import { describe, expect, it } from "vitest";
import { degreesOfSeparation, scoreNovelty } from "../lib/matching";
import { teamMember } from "./fixtures";

const graph = [
  { userAId: "candidate", userBId: "bridge", count: 1 },
  { userAId: "bridge", userBId: "member", count: 1 },
];

describe("network-break", () => {
  it("scores strangers above repeat collaborators", () => {
    const stranger = scoreNovelty("candidate", [teamMember()], []);
    const repeat = scoreNovelty("candidate", [teamMember()], [{ userAId: "candidate", userBId: "member", count: 4 }]);
    expect(stranger.raw).toBeGreaterThan(repeat.raw);
    expect(repeat.repeated).toBe(true);
  });

  it("finds degrees of separation with bounded BFS", () => {
    expect(degreesOfSeparation("candidate", ["member"], graph)).toBe(2);
    expect(degreesOfSeparation("candidate", ["unknown"], graph)).toBeNull();
  });
});

