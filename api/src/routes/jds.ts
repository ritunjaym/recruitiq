import { Router } from "express";
import type { Db } from "../db/client.js";

export function jdsRouter(db: Db): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM job_descriptions").all();
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch job descriptions" });
    }
  });

  return router;
}
