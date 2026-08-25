export type ComponentKey =
  | "skillFit"
  | "gapCoverage"
  | "availability"
  | "interest"
  | "experience"
  | "chemistry"
  | "novelty";

export type MatchWeights = Record<ComponentKey, number>;
export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type AvailabilitySource = "MANUAL" | "GOOGLE_CALENDAR";

export type SkillProficiency = {
  skillId: string;
  proficiency: number;
  wantsToLearn?: boolean;
};

export type SkillRequirement = {
  skillId: string;
  minProficiency: number;
  weight: number;
  isRequired: boolean;
};

export type SkillEdge = { fromSkillId: string; toSkillId: string; weight: number };

export type AvailabilityBlock = {
  dayOfWeek: number;
  slot: number;
  source: AvailabilitySource;
  timezone?: string;
};

export type WorkStyle = {
  asyncPreference: number;
  planningStyle: number;
  chronotype: number;
  feedbackDirectness: number;
  riskAppetite: number;
  leadershipInclination: number;
};

export type Candidate = {
  id: string;
  name: string;
  skills: SkillProficiency[];
  interests: string[];
  availability: AvailabilityBlock[];
  hoursPerWeek: number;
  experienceLevel: ExperienceLevel;
  reliabilityScore: number;
  isVerified: boolean;
  workStyle?: WorkStyle;
  calendarLastSyncedAt?: Date;
  projectTypeHistory?: string[];
};

export type Role = {
  id: string;
  title: string;
  seats: number;
  skills: SkillRequirement[];
  hoursPerWeek: number;
  minExperienceLevel: ExperienceLevel;
  availability: AvailabilityBlock[];
};

export type Project = {
  id: string;
  title: string;
  type: string;
  interests: string[];
  roles: Role[];
  startDate: Date;
  endDate: Date;
};

export type TeamMember = Candidate & { roleId?: string };
export type Collaboration = { userAId: string; userBId: string; count: number };

export type MatchingConfig = {
  weights: MatchWeights;
  skillEdges: SkillEdge[];
  collaborations: Collaboration[];
  now: Date;
};

export type MatchResult = {
  total: number;
  components: Record<ComponentKey, { raw: number; weighted: number; max: number }>;
  explanation: string[];
  warnings: string[];
  hardFilterFailed: boolean;
  matchedSkills: { skillId: string; via: "direct" | "adjacent"; strength: number }[];
  missingSkills: string[];
};

export type TeamSelection = { roleId: string; candidate: Candidate; score: MatchResult };

