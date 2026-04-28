import express from "express";
import cors from "cors";
import type { Db } from "./db/client.js";
import { candidatesRouter } from "./routes/candidates.js";
import { jdsRouter } from "./routes/jds.js";

export function buildApp(db: Db) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/candidates", candidatesRouter(db));
  app.use("/jds", jdsRouter(db));

  return app;
}
