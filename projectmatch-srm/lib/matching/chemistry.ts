import type { TeamMember, WorkStyle } from "./types";

const similarity = (a: number, b: number) => 1 - Math.min(1, Math.abs(a - b) / 4);
const balanceGain = (candidate: number, average: number) => 1 - Math.min(1, Math.abs(((candidate + average) / 2) - 3) / 2);

export function scoreChemistry(candidate: WorkStyle | undefined, team: TeamMember[]): { raw: number; warnings: string[] } {
  const styles = team.flatMap((member) => member.workStyle ? [member.workStyle] : []);
  if (!candidate || styles.length === 0) return { raw: 0.65, warnings: ["Working-style data is incomplete, so chemistry confidence is limited."] };
  const average = (key: keyof WorkStyle) => styles.reduce((sum, style) => sum + style[key], 0) / styles.length;
  const similarityScore = (similarity(candidate.asyncPreference, average("asyncPreference")) + similarity(candidate.feedbackDirectness, average("feedbackDirectness"))) / 2;
  const complementScore = (["planningStyle", "riskAppetite", "leadershipInclination"] as const)
    .reduce((sum, key) => sum + balanceGain(candidate[key], average(key)), 0) / 3;
  const warnings: string[] = [];
  if (average("planningStyle") < 2) warnings.push("The team skews toward improvising; a stronger planner would add balance.");
  if (average("leadershipInclination") < 2) warnings.push("No current member shows a strong leadership preference.");
  return { raw: 0.55 * similarityScore + 0.45 * complementScore, warnings };
}

