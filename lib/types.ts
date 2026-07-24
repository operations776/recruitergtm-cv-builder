// Shared types for the CV Builder pipeline.

export interface ParsedCV {
  headline: string; // current role + employer, as found in the paste
  currentRole?: string;
  currentEmployer?: string;
  priorEmployer?: string;
  university?: string;
  city?: string;
  country?: string;
  rawText: string;
}

export interface MatchCandidate {
  name: string;
  linkedin?: string;
  headline?: string;
  company?: string;
  summary?: string;
  confidence: "high" | "medium" | "low" | "none";
  confidencePoints: string[]; // e.g. ["Dentons, Oct 2024", "Univ. Constantin Brancoveanu"]
}

export interface CVExperience {
  title: string;
  employer: string;
  dates: string;
  location?: string;
  industry?: string;
  bullets: string[];
  tags?: string[];
}

export interface CVEducation {
  degree: string;
  school: string;
  field?: string;
  dates?: string;
  location?: string;
}

export interface CVContact {
  linkedin?: string;
  email?: string;
  emailStatus?: "verified" | "inferred" | "unknown";
  phone?: string;
  /** Current employer's domain, e.g. "dentons.com" — used to match on Prospeo. */
  companyDomain?: string;
}

export interface CVDesired {
  role?: string;
  type?: string;
  level?: string;
  cities?: string[];
  salary?: string;
}

export interface CVProject {
  name: string;
  dates?: string;
  context?: string; // e.g. "Associated with Qemetica"
  description?: string;
}

export interface CVVolunteering {
  role: string;
  organization?: string;
  dates?: string;
}

export interface CVAward {
  title: string;
  issuer?: string;
  date?: string;
}

// The final, render-ready CV. This is what /api/pdf consumes.
export interface CandidateCV {
  name: string;
  headline: string;
  location?: string;
  /** Profile photo as a data URI (fetched + embedded so it can't expire). */
  photo?: string;
  contact: CVContact;
  about?: string;
  experience: CVExperience[];
  education: CVEducation[];
  skills: { technical: string[]; functional: string[] };
  certifications: string[];
  projects: CVProject[];
  volunteering?: CVVolunteering[];
  awards?: CVAward[];
  recommendation?: { text: string; author?: string };
  languages: string[];
  desired?: CVDesired;
  meta?: {
    sourceId?: string;
    recency?: string;
    matchConfidence?: string[];
  };
}
