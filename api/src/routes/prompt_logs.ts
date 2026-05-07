import { Router } from "express";
import type { Db } from "../db/client.js";

export function promptLogsRouter(db: Db): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      const rows = db.prepare(
        `SELECT score, verdict, latency_ms FROM prompt_logs ORDER BY id DESC LIMIT 500`
      ).all() as Array<{ score: number; verdict: string; latency_ms: number }>;

      const total = rows.length;
      const avgLatencyMs = total > 0
        ? Math.round(rows.reduce((s, r) => s + r.latency_ms, 0) / total)
        : 0;

      const distribution: Record<string, number> = {
        "Strong Match": 0,
        "Potential Match": 0,
        "Poor Match": 0,
      };
      let scoreSum = 0;
      for (const r of rows) {
        distribution[r.verdict] = (distribution[r.verdict] ?? 0) + 1;
        scoreSum += r.score;
      }
      const avgScore = total > 0 ? Math.round((scoreSum / total) * 100) / 100 : 0;

      res.json({
        total_evaluations: total,
        avg_score: avgScore,
        avg_latency_ms: avgLatencyMs,
        verdict_distribution: distribution,
        recent: rows.slice(0, 20).map((r) => ({
          score: r.score,
          verdict: r.verdict,
          latency_ms: r.latency_ms,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch prompt logs" });
    }
  });

  return router;
}
