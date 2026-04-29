import { Router } from "express";
import type { Db } from "../db/client.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";
import { ChatService } from "../chat/chat_service.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export function chatRouter(db: Db, sidecar: SidecarClient, llm: BaseChatModel): Router {
  const router = Router();
  const chatService = new ChatService(llm);

  router.post("/", async (req, res) => {
    const { session_id, message } = req.body as { session_id?: string; message?: string };
    if (!session_id || !message) {
      res.status(400).json({ error: "session_id and message are required" });
      return;
    }
    try {
      const response = await chatService.send(session_id, message, sidecar, db);
      res.json(response);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.get("/:session_id", (req, res) => {
    try {
      const rows = db
        .prepare(
          "SELECT role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC"
        )
        .all(req.params.session_id);
      res.json(rows);
    } catch {
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  return router;
}
