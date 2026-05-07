import { Router } from "express";
import type { SidecarClient } from "../pipeline/sidecar_client.js";

const EVAL_SET_URL = process.env.SIDECAR_URL
  ? `${process.env.SIDECAR_URL.replace(/\/$/, "")}/eval`
  : "http://localhost:8000/eval";

export function evalRouter(sidecar: SidecarClient): Router {
  const router = Router();

  router.post("/", async (_req, res) => {
    try {
      const r = await fetch(EVAL_SET_URL, { method: "POST" });
      if (!r.ok) {
        res.status(502).json({ error: `Sidecar eval failed: ${r.status}` });
        return;
      }
      res.json(await r.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
