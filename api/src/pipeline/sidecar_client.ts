export interface SidecarQueryResult {
  id: string;
  score: number;
}

export interface MatchScoreResult {
  score: number;
  verdict: "Strong Match" | "Potential Match" | "Poor Match";
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
  prompt_version?: string;
  tool_calls?: string[];
}

export class SidecarClient {
  constructor(
    private readonly baseUrl: string = process.env.SIDECAR_URL ?? "http://localhost:8000"
  ) {}

  async buildIndex(
    type: "candidate" | "jd",
    documents: Array<{ id: string; text: string }>
  ): Promise<Response> {
    const path = type === "candidate" ? "/index/build" : "/jd-index/build";
    return fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents }),
    });
  }

  async queryIndex(text: string, topK: number): Promise<SidecarQueryResult[]> {
    const res = await fetch(`${this.baseUrl}/index/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, top_k: topK }),
    });
    const data = await res.json() as { results: SidecarQueryResult[] };
    return data.results;
  }

  async queryJdIndex(text: string, topK: number): Promise<SidecarQueryResult[]> {
    const res = await fetch(`${this.baseUrl}/jd-index/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, top_k: topK }),
    });
    const data = await res.json() as { results: SidecarQueryResult[] };
    return data.results;
  }

  async judgeScore(
    jdText: string,
    candidateText: string,
    promptVersion?: string
  ): Promise<MatchScoreResult> {
    const res = await fetch(`${this.baseUrl}/judge/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jd_text: jdText,
        candidate_text: candidateText,
        ...(promptVersion ? { prompt_version: promptVersion } : {}),
      }),
    });
    return res.json() as Promise<MatchScoreResult>;
  }
}
