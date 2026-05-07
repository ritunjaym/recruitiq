import { Router } from "express";
import type { Db } from "../db/client.js";

export function promptLogsRouter(db: Db): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      const rows = db.prepare(
        `SELECT score, verdict, latency_ms, prompt_version FROM prompt_logs ORDER BY id DESC LIMIT 500`
      ).all() as Array<{ score: number; verdict: string; latency_ms: number; prompt_version: string }>;

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

      res.json({
        total_evaluations: total,
        avg_score: total > 0 ? Math.round((scoreSum / total) * 100) / 100 : 0,
        avg_latency_ms: avgLatencyMs,
        verdict_distribution: distribution,
        recent: rows.slice(0, 20).map((r) => ({
          score: r.score,
          verdict: r.verdict,
          latency_ms: r.latency_ms,
          prompt_version: r.prompt_version,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch prompt logs" });
    }
  });

  router.get("/compare", (_req, res) => {
    try {
      const rows = db.prepare(
        `SELECT prompt_version,
                COUNT(*) as count,
                ROUND(AVG(score), 3) as avg_score,
                ROUND(AVG(latency_ms)) as avg_latency_ms,
                SUM(CASE WHEN verdict = 'Strong Match' THEN 1 ELSE 0 END) as strong,
                SUM(CASE WHEN verdict = 'Potential Match' THEN 1 ELSE 0 END) as potential,
                SUM(CASE WHEN verdict = 'Poor Match' THEN 1 ELSE 0 END) as poor
         FROM prompt_logs
         GROUP BY prompt_version
         ORDER BY prompt_version`
      ).all() as Array<{
        prompt_version: string;
        count: number;
        avg_score: number;
        avg_latency_ms: number;
        strong: number;
        potential: number;
        poor: number;
      }>;

      const versions = rows.map((r) => ({
        prompt_version: r.prompt_version,
        count: r.count,
        avg_score: r.avg_score,
        avg_latency_ms: r.avg_latency_ms,
        verdict_distribution: {
          "Strong Match": r.strong,
          "Potential Match": r.potential,
          "Poor Match": r.poor,
        },
      }));

      res.json({ versions });
    } catch (err) {
      res.status(500).json({ error: "Failed to compare prompt versions" });
    }
  });

  return router;
}
