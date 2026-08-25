import { describe, expect, it } from "vitest";
import { scoreChemistry } from "../lib/matching";
import { candidate, teamMember } from "./fixtures";

describe("chemistry", () => {
  it("rewards leadership complementarity", () => {
    const lowLeadershipTeam = [teamMember()];
    const leader = scoreChemistry(candidate().workStyle, lowLeadershipTeam);
    const followerStyle = { ...candidate().workStyle!, leadershipInclination: 1, planningStyle: 1 };
    const follower = scoreChemistry(followerStyle, lowLeadershipTeam);
    expect(leader.raw).toBeGreaterThan(follower.raw);
    expect(leader.warnings.join(" ")).toContain("leadership");
  });

  it("rewards similarity in async and feedback communication", () => {
    const team = [teamMember()];
    const aligned = scoreChemistry(candidate().workStyle, team);
    const misaligned = scoreChemistry({ ...candidate().workStyle!, asyncPreference: 5, feedbackDirectness: 5 }, team);
    expect(aligned.raw).toBeGreaterThan(misaligned.raw);
  });
});

