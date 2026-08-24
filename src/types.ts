export type Role = "student" | "volunteer" | "doctor";
export type EmergencyType = "Medical" | "Fire" | "Security" | "Accident" | "Other";
export type Severity = "Low" | "Medium" | "High";
export type ReportStatus = "Pending" | "Resolved";
export type HelperStatus = "Not yet" | "On it" | "Done";

export interface Profile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role | null;
}

export interface EmergencyReport {
  id: string;
  emergencyType: EmergencyType;
  description: string;
  location: string;
  severity: Severity;
  timestamp: string;
  reportStatus: ReportStatus;
  helperStatus: HelperStatus;
  submittedBy: string;
  submittedByName: string;
  submittedByEmail: string;
  helperUpdatedBy?: string;
  helperUpdatedAt?: string;
  resolvedBy?: "Doctor";
  resolvedAt?: string;
}

