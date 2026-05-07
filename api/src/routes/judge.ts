import { Router } from "express";
import type { Db } from "../db/client.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";

export function judgeRouter(db: Db, sidecar: SidecarClient): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const { candidate_id, query } = req.body as { candidate_id?: number; query?: string };
    if (!candidate_id || !query?.trim()) {
      res.status(400).json({ error: "candidate_id and query are required" });
      return;
    }

    const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(candidate_id) as {
      id: number; name: string; skills: string;
      years_exp: number; bio: string; past_roles: string;
    } | undefined;

    if (!row) {
      res.status(404).json({ error: `Candidate not found: ${candidate_id}` });
      return;
    }

    const profile = `Name: ${row.name}
Skills: ${row.skills}
Years of experience: ${row.years_exp}
Bio: ${row.bio}
Past roles: ${row.past_roles}`;

    try {
      const t0 = Date.now();
      const score = await sidecar.judgeScore(query, profile);
      const latencyMs = Date.now() - t0;

      db.prepare(
        `INSERT INTO prompt_logs (candidate_id, jd_id, score, verdict, latency_ms) VALUES (?, NULL, ?, ?, ?)`
      ).run(row.id, score.score, score.verdict, latencyMs);

      res.json({
        candidate_id: row.id,
        candidate_name: row.name,
        score: score.score,
        verdict: score.verdict,
        strengths: score.strengths,
        gaps: score.gaps,
        reasoning: score.reasoning,
        confidence: score.confidence,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
