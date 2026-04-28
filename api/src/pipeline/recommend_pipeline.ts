import { RunnableSequence } from "@langchain/core/runnables";
import pLimit from "p-limit";
import type { Db } from "../db/client.js";
import { SidecarClient, type MatchScoreResult } from "./sidecar_client.js";

const CONCURRENCY_LIMIT = 5;

export interface JdMatchResult {
  jd_id: number;
  jd_title: string;
  score: number;
  verdict: "Strong Match" | "Potential Match" | "Poor Match";
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
}

interface CandidateRow {
  id: number;
  name: string;
  skills: string;
  years_exp: number;
  bio: string;
  past_roles: string;
}

interface JdRow {
  id: number;
  title: string;
  company: string;
  description: string;
}

export class RecommendPipeline {
  private readonly chain: RunnableSequence;
  private readonly limit = pLimit(CONCURRENCY_LIMIT);

  constructor(
    private readonly db: Db,
    private readonly sidecar: SidecarClient = new SidecarClient()
  ) {
    this.chain = RunnableSequence.from([
      (candidateId: number) => this.fetchCandidate(candidateId),
      (candidate: CandidateRow) => this.retrieveJds(candidate),
      ({ candidate, jds }: { candidate: CandidateRow; jds: JdRow[] }) =>
        this.judgeAll(candidate, jds),
      (results: JdMatchResult[]) => results.sort((a, b) => b.score - a.score),
    ]);
  }

  async run(candidateId: number): Promise<JdMatchResult[]> {
    return this.chain.invoke(candidateId);
  }

  private fetchCandidate(candidateId: number): CandidateRow {
    const row = this.db
      .prepare("SELECT * FROM candidates WHERE id = ?")
      .get(candidateId) as CandidateRow | undefined;
    if (!row) throw new Error(`Candidate not found: ${candidateId}`);
    return row;
  }

  private async retrieveJds(
    candidate: CandidateRow
  ): Promise<{ candidate: CandidateRow; jds: JdRow[] }> {
    const profile = `${candidate.bio} ${candidate.skills} ${candidate.past_roles}`;
    const queryResults = await this.sidecar.queryJdIndex(profile, 10);
    if (queryResults.length === 0) return { candidate, jds: [] };

    const ids = queryResults.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const jds = this.db
      .prepare(`SELECT * FROM job_descriptions WHERE id IN (${placeholders})`)
      .all(...ids) as JdRow[];

    return { candidate, jds };
  }

  private async judgeAll(
    candidate: CandidateRow,
    jds: JdRow[]
  ): Promise<JdMatchResult[]> {
    const profile = `Name: ${candidate.name}
Skills: ${candidate.skills}
Years of experience: ${candidate.years_exp}
Bio: ${candidate.bio}
Past roles: ${candidate.past_roles}`;

    return Promise.all(
      jds.map((jd) =>
        this.limit(async () => {
          const score = await this.sidecar.judgeScore(jd.description, profile);
          return this.toResult(jd, score);
        })
      )
    );
  }

  private toResult(jd: JdRow, score: MatchScoreResult): JdMatchResult {
    return {
      jd_id: jd.id,
      jd_title: jd.title,
      score: score.score,
      verdict: score.verdict,
      strengths: score.strengths,
      gaps: score.gaps,
      reasoning: score.reasoning,
      confidence: score.confidence,
    };
  }
}
