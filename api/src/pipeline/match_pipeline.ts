import { RunnableSequence } from "@langchain/core/runnables";
import pLimit from "p-limit";
import type { Db } from "../db/client.js";
import { JdRowSchema, CandidateRowSchema, parseRow, parseRows } from "../db/schemas.js";
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

import type { JdRow, CandidateRow } from "../db/schemas.js";

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
    const raw = this.db.prepare("SELECT * FROM job_descriptions WHERE id = ?").get(jd_id);
    if (!raw) throw new Error(`JD not found: ${jd_id}`);
    return parseRow(JdRowSchema, raw, `fetchJd(${jd_id})`);
  }

  private readonly FAISS_THRESHOLD = 0.25;

  private async retrieveCandidates(jd: JdRow): Promise<{ jd: JdRow; candidates: CandidateRow[] }> {
    const queryResults = await this.sidecar.queryIndex(jd.description.slice(0, 500), 10);
    if (queryResults.length === 0) return { jd, candidates: [] };

    // Pre-filter: only pass candidates above FAISS threshold to the LLM reranker
    const filtered = queryResults.filter((r) => r.score >= this.FAISS_THRESHOLD);
    if (filtered.length === 0) return { jd, candidates: [] };

    const ids = filtered.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const candidates = parseRows(
      CandidateRowSchema,
      this.db.prepare(`SELECT * FROM candidates WHERE id IN (${placeholders})`).all(...ids),
      "retrieveCandidates"
    );

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

          const t0 = Date.now();
          const matchScore = await this.sidecar.judgeScore(jd.description, profile);
          return this.persistAndReturn(jd.id, candidate, matchScore, Date.now() - t0);
        })
      )
    );
    return results;
  }

  private persistAndReturn(
    jd_id: number,
    candidate: CandidateRow,
    score: MatchScoreResult,
    latencyMs: number
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

    this.db
      .prepare(
        `INSERT INTO prompt_logs (candidate_id, jd_id, score, verdict, latency_ms, prompt_version)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(candidate.id, jd_id, score.score, score.verdict, latencyMs, score.prompt_version ?? "v1-standard");

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
