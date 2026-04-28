import { RunnableSequence } from "@langchain/core/runnables";
import pLimit from "p-limit";
import type { Db } from "../db/client.js";
import { SidecarClient, type MatchScoreResult } from "./sidecar_client.js";

const CONCURRENCY_LIMIT = 5;

export interface MatchResult {
  candidate_id: number;
  candidate_name: string;
  score: number;
  verdict: "Strong Match" | "Potential Match" | "Poor Match";
  strengths: string[];
  gaps: string[];
  reasoning: string;
  confidence: number;
}

interface PipelineInput {
  jd_id: number;
}

interface JdRow {
  id: number;
  title: string;
  company: string;
  description: string;
}

interface CandidateRow {
  id: number;
  name: string;
  skills: string;
  years_exp: number;
  bio: string;
  past_roles: string;
}

export class MatchPipeline {
  private readonly chain: RunnableSequence;
  private readonly limit = pLimit(CONCURRENCY_LIMIT);

  constructor(
    private readonly db: Db,
    private readonly sidecar: SidecarClient = new SidecarClient()
  ) {
    this.chain = RunnableSequence.from([
      (input: PipelineInput) => this.fetchJd(input.jd_id),
      (jd: JdRow) => this.retrieveCandidates(jd),
      ({ jd, candidates }: { jd: JdRow; candidates: CandidateRow[] }) =>
        this.judgeAll(jd, candidates),
      (results: MatchResult[]) => results.sort((a, b) => b.score - a.score),
    ]);
  }

  async run(jd_id: number): Promise<MatchResult[]> {
    return this.chain.invoke({ jd_id });
  }

  private fetchJd(jd_id: number): JdRow {
    const jd = this.db
      .prepare("SELECT * FROM job_descriptions WHERE id = ?")
      .get(jd_id) as JdRow | undefined;
    if (!jd) throw new Error(`JD not found: ${jd_id}`);
    return jd;
  }

  private async retrieveCandidates(jd: JdRow): Promise<{ jd: JdRow; candidates: CandidateRow[] }> {
    const queryResults = await this.sidecar.queryIndex(jd.description, 10);
    if (queryResults.length === 0) return { jd, candidates: [] };

    const ids = queryResults.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const candidates = this.db
      .prepare(`SELECT * FROM candidates WHERE id IN (${placeholders})`)
      .all(...ids) as CandidateRow[];

    return { jd, candidates };
  }

  private async judgeAll(
    jd: JdRow,
    candidates: CandidateRow[]
  ): Promise<MatchResult[]> {
    const results = await Promise.all(
      candidates.map((candidate) =>
        this.limit(async () => {
          const profile = `Name: ${candidate.name}
Skills: ${candidate.skills}
Years of experience: ${candidate.years_exp}
Bio: ${candidate.bio}
Past roles: ${candidate.past_roles}`;

          const matchScore = await this.sidecar.judgeScore(jd.description, profile);
          return this.persistAndReturn(jd.id, candidate, matchScore);
        })
      )
    );
    return results;
  }

  private persistAndReturn(
    jd_id: number,
    candidate: CandidateRow,
    score: MatchScoreResult
  ): MatchResult {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO match_results
         (jd_id, candidate_id, score, verdict, strengths, gaps, reasoning, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        jd_id,
        candidate.id,
        score.score,
        score.verdict,
        JSON.stringify(score.strengths),
        JSON.stringify(score.gaps),
        score.reasoning,
        score.confidence
      );

    return {
      candidate_id: candidate.id,
      candidate_name: candidate.name,
      score: score.score,
      verdict: score.verdict,
      strengths: score.strengths,
      gaps: score.gaps,
      reasoning: score.reasoning,
      confidence: score.confidence,
    };
  }
}
