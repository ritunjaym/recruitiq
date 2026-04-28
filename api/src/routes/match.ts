import { Router } from "express";
import type { Db } from "../db/client.js";
import { MatchPipeline } from "../pipeline/match_pipeline.js";
import { SidecarClient } from "../pipeline/sidecar_client.js";

export function matchRouter(db: Db, sidecar?: SidecarClient): Router {
  const router = Router();
  const pipeline = new MatchPipeline(db, sidecar ?? new SidecarClient());

  router.post("/", async (req, res) => {
    const { jd_id } = req.body as { jd_id?: number };
    if (!jd_id) {
      res.status(400).json({ error: "jd_id is required" });
      return;
    }

    try {
      const results = await pipeline.run(jd_id);
      res.json(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        res.status(404).json({ error: msg });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  router.get("/:jd_id", (req, res) => {
    const jd_id = parseInt(req.params.jd_id, 10);
    if (isNaN(jd_id)) {
      res.status(400).json({ error: "Invalid jd_id" });
      return;
    }

    try {
      const rows = db
        .prepare(
          `SELECT mr.*, c.name as candidate_name
           FROM match_results mr
           JOIN candidates c ON c.id = mr.candidate_id
           WHERE mr.jd_id = ?
           ORDER BY mr.score DESC`
        )
        .all(jd_id) as Array<{
          candidate_id: number;
          candidate_name: string;
          score: number;
          verdict: string;
          strengths: string;
          gaps: string;
          reasoning: string;
          confidence: number;
        }>;

      const results = rows.map((r) => ({
        candidate_id: r.candidate_id,
        candidate_name: r.candidate_name,
        score: r.score,
        verdict: r.verdict,
        strengths: JSON.parse(r.strengths) as string[],
        gaps: JSON.parse(r.gaps) as string[],
        reasoning: r.reasoning,
        confidence: r.confidence,
      }));

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch match results" });
    }
  });

  return router;
}
