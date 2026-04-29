import type { Candidate, JobDescription, MatchResult, JdMatchResult } from "../types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface ChatResponse {
  reply: string;
  results: MatchResult[];
  session_id: string;
}

export const api = {
  getJds: () => get<JobDescription[]>("/jds"),
  getJd: (id: number) => get<JobDescription>(`/jds/${id}`),
  getCandidates: () => get<Candidate[]>("/candidates"),
  getCandidate: (id: number) => get<Candidate>(`/candidates/${id}`),
  match: (jd_id: number) => post<MatchResult[]>("/match", { jd_id }),
  getMatchResults: (jd_id: number) => get<MatchResult[]>(`/match/${jd_id}`),
  getCandidateMatches: (id: number) => get<JdMatchResult[]>(`/candidates/${id}/matches`),
  chat: (session_id: string, message: string) =>
    post<ChatResponse>("/chat", { session_id, message }),
  getChatHistory: (session_id: string) => get<ChatTurn[]>(`/chat/${session_id}`),
};
