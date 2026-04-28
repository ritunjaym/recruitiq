import { Router } from "express";
import type { Db } from "../db/client.js";

export function jdsRouter(db: Db): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    try {
      res.json(db.prepare("SELECT * FROM job_descriptions").all());
    } catch {
      res.status(500).json({ error: "Failed to fetch job descriptions" });
    }
  });

  router.get("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const row = db.prepare("SELECT * FROM job_descriptions WHERE id = ?").get(id);
      if (!row) { res.status(404).json({ error: "JD not found" }); return; }
      res.json(row);
    } catch {
      res.status(500).json({ error: "Failed to fetch job description" });
    }
  });

  return router;
}
