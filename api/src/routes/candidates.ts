import { Router } from "express";
import type { Db } from "../db/client.js";
import { RecommendPipeline } from "../pipeline/recommend_pipeline.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";

export function candidatesRouter(db: Db, sidecar?: SidecarClient): Router {
  const router = Router();
  const recommend = new RecommendPipeline(db, sidecar);

  router.get("/", (_req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM candidates").all() as Array<{
        id: number;
        name: string;
        skills: string;
        years_exp: number;
        bio: string;
        past_roles: string;
        embedding_id: string | null;
      }>;

      const candidates = rows.map((r) => ({
        id: r.id,
        name: r.name,
        skills: JSON.parse(r.skills) as string[],
        years_exp: r.years_exp,
        bio: r.bio,
        past_roles: JSON.parse(r.past_roles) as string[],
        embedding_id: r.embedding_id,
      }));

      res.json(candidates);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch candidates" });
    }
  });

  router.get("/:id/matches", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid candidate id" });
      return;
    }
    try {
      const results = await recommend.run(id);
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

  return router;
}
