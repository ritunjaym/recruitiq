import { Router } from "express";
import type { Db } from "../db/client.js";

export function candidatesRouter(db: Db): Router {
  const router = Router();

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

  return router;
}
