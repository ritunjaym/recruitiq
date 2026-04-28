export interface Candidate {
  id: number;
  name: string;
  skills: string[];
  years_exp: number;
  bio: string;
  past_roles: string[];
}

export interface JobDescription {
  id: number;
  title: string;
  company: string;
  description: string;
}

export type Verdict = "Strong Match" | "Potential Match" | "Poor Match";

export interface MatchResult {
  candidate_id: number;
  candidate_name: string;
  score: number;
  verdict: Verdict;
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
}

export interface JdMatchResult {
  jd_id: number;
  jd_title: string;
  score: number;
  verdict: Verdict;
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
}
