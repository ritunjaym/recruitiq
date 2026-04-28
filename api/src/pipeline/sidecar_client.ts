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
}

export class SidecarClient {
  constructor(private readonly baseUrl: string = "http://localhost:8000") {}

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

  async judgeScore(jdText: string, candidateText: string): Promise<MatchScoreResult> {
    const res = await fetch(`${this.baseUrl}/judge/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_text: jdText, candidate_text: candidateText }),
    });
    return res.json() as Promise<MatchScoreResult>;
  }
}
