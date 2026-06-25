/* ═══════════════════════════════════════════════
   WAJOOD — TypeScript Type Definitions
   ═══════════════════════════════════════════════ */

// ─── Enums ───
export type UserRole =
  | "ADMIN"
  | "PUBLIC"
  | "NGO_WORKER"
  | "OFFICER"
  | "DOCTOR"
  | "VOLUNTEER"
  | "JOURNALIST"
  | "GOVT_OFFICIAL"
  | "FORENSICS";

export type CaseStatus =
  | "open"
  | "active"
  | "under_investigation"
  | "matched"
  | "resolved"
  | "closed"
  | "MISSING"
  | "FOUND_ALIVE"
  | "DECEASED"
  | "MATCHED"
  | "IN_PROCESS"
  | "PENDING"
  | "CONFIRMED"
  | "REJECTED"
  | string;

export type CasePriority = "low" | "medium" | "high" | "critical" | string;

export type PersonType = "missing" | "found" | "unidentified" | string;

export type Gender = "male" | "female" | "other" | "unknown" | "MALE" | "FEMALE" | "OTHER" | "UNKNOWN" | string;

export type OrgType =
  | "ngo"
  | "law_enforcement"
  | "hospital"
  | "government"
  | "forensics"
  | "media"
  | "volunteer_group"
  | "other";

// ─── User ───
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  cnic?: string;
  role: UserRole;
  organization_id?: string;
  is_active: boolean;
  is_verified: boolean;
  province?: string;
  district?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Person ───
export interface Person {
  id: string;
  full_name?: string;
  age_min?: number;
  age_max?: number;
  gender: Gender;
  person_type: PersonType;
  height_cm?: number;
  weight_kg?: number;
  skin_color?: string;
  hair_color?: string;
  eye_color?: string;
  blood_group?: string;
  distinguishing_marks?: string;
  cnic?: string;
  photo_url?: string;
  last_known_address?: string;
  province?: string;
  district?: string;
  city?: string;
  clothing_description?: string;
  medical_conditions?: string;
  additional_notes?: string;
  notes?: string;
  is_alive?: boolean;
  physical_description?: string;
  found_location?: string;
  found_date?: string;
  found_city?: string;
  hospital_name?: string;
  morgue_id?: string;
  status?: string;
  match_status?: string;
  age?: number;
  created_at: string;
  updated_at: string;
}

// ─── Case ───
export interface Case {
  id: string;
  case_number: string;
  person_id: string;
  reporter_id: string;
  assigned_org_id?: string;
  status: CaseStatus;
  priority: CasePriority;
  title: string;
  description?: string;
  last_seen_location?: string;
  last_seen_city?: string;
  last_seen_date?: string;
  last_seen_province?: string;
  last_seen_district?: string;
  fir_number?: string;
  police_station?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  person?: Person;
}

export interface CaseListResponse {
  cases: Case[];
  total: number;
  page: number;
  per_page: number;
}

// ─── Match Result ───
export interface MatchResult {
  id: string;
  case_id: string;
  matched_person_id: string;
  confidence_score: number;
  match_type: string;
  details?: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  confirmed_by?: string;
  created_at: string;
  missing_person?: Person;
  matched_person?: Person; // supports both names used in different parts
  found_person?: Person;
}

// ─── Organization ───
export interface Organization {
  id: string;
  name: string;
  org_type: OrgType;
  registration_number?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  province?: string;
  district?: string;
  website?: string;
  description?: string;
  is_verified: boolean;
}

// ─── Notification ───
export interface Notification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  related_case_id?: string;
  created_at: string;
}

// ─── Analytics ───
export interface DashboardStats {
  cases: {
    total: number;
    active: number;
    resolved: number;
    resolution_rate: number;
  };
  persons: {
    total: number;
    missing: number;
    found: number;
    unidentified: number;
  };
  organizations: {
    total: number;
    verified: number;
  };
  users: {
    total: number;
  };
}

// ─── Pakistan Administrative Data ───
export interface Province {
  name: string;
  districts: string[];
}
