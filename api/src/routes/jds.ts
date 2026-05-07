import { Router } from "express";
import type { Db } from "../db/client.js";

export function jdsRouter(db: Db): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const offset = (page - 1) * limit;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    try {
      const total = (
        search
          ? db.prepare("SELECT COUNT(*) as n FROM job_descriptions WHERE title LIKE ? OR company LIKE ?")
              .get(`%${search}%`, `%${search}%`) as { n: number }
          : db.prepare("SELECT COUNT(*) as n FROM job_descriptions").get() as { n: number }
      ).n;

      const rows = search
        ? db.prepare(
            "SELECT * FROM job_descriptions WHERE title LIKE ? OR company LIKE ? ORDER BY id LIMIT ? OFFSET ?"
          ).all(`%${search}%`, `%${search}%`, limit, offset)
        : db.prepare("SELECT * FROM job_descriptions ORDER BY id LIMIT ? OFFSET ?").all(limit, offset);

      res.json({ total, page, limit, pages: Math.ceil(total / limit), data: rows });
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
