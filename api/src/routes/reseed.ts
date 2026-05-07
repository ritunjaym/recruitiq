import { Router } from "express";
import type { Db } from "../db/client.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";
import { seedIndexes } from "../ingest/seed_indexes.js";

export function reseedRouter(db: Db, sidecar: SidecarClient): Router {
  const router = Router();

  // Returns raw data for sidecar self-seeding on cold start
  router.get("/data", (_req, res) => {
    try {
      const candidates = db.prepare(
        "SELECT id, name, skills, years_exp, bio, past_roles FROM candidates"
      ).all() as Array<{ id: number; name: string; skills: string; years_exp: number; bio: string; past_roles: string }>;

      const jds = db.prepare(
        "SELECT id, title, company, description FROM job_descriptions"
      ).all() as Array<{ id: number; title: string; company: string; description: string }>;

      res.json({
        candidates: candidates.map((r) => ({
          id: String(r.id),
          text: `Name: ${r.name}\nSkills: ${r.skills}\nYears of experience: ${r.years_exp}\nBio: ${r.bio}\nPast roles: ${r.past_roles}`,
        })),
        jds: jds.map((r) => ({
          id: String(r.id),
          text: `Title: ${r.title}\nCompany: ${r.company}\n${r.description}`,
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch seed data" });
    }
  });

  // Manual reseed trigger — rebuilds both sidecar indexes from DB
  router.get("/", async (_req, res) => {
    try {
      const { candidateCount, jdCount } = await seedIndexes(db, sidecar);
      res.json({ status: "ok", candidates_indexed: candidateCount, jds_indexed: jdCount });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
