import express from "express";
import cors from "cors";
import type { Db } from "./db/client.js";
import { candidatesRouter } from "./routes/candidates.js";
import { jdsRouter } from "./routes/jds.js";
import { matchRouter } from "./routes/match.js";
import { chatRouter } from "./routes/chat.js";
import type { SidecarClient } from "./pipeline/sidecar_client.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function buildApp(db: Db, sidecar?: SidecarClient, llm?: BaseChatModel) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/candidates", candidatesRouter(db, sidecar));
  app.use("/jds", jdsRouter(db));
  app.use("/match", matchRouter(db, sidecar));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  if (llm && sidecar) {
    app.use("/chat", chatRouter(db, sidecar, llm));
  }

  return app;
}
