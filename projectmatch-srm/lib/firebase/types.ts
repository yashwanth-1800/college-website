export const BRANCHES = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "CHEMICAL", "BIOTECH", "AEROSPACE", "OTHER"] as const;
export type Branch = (typeof BRANCHES)[number];
export const ACADEMIC_YEARS = ["FIRST_YEAR", "SECOND_YEAR", "THIRD_YEAR", "FOURTH_YEAR"] as const;
export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

export type AvailabilitySlot = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";
export type AvailabilitySource = "MANUAL" | "GOOGLE_CALENDAR";

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  handle: string;
  bio: string;
  image?: string;
  branch: Branch;
  academicYear: AcademicYear;
  isOpenToWork: boolean;
  skillCategories: string[];
  skills: { name: string; proficiency: number }[];
  availability: { dayOfWeek: number; slot: AvailabilitySlot; source: AvailabilitySource }[];
  updatedAt: number;
}
