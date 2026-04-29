import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";
import type { SidecarClient } from "../src/pipeline/sidecar_client.js";

const TEST_DB = "./test-chat.db";

function makeMockSidecar(): SidecarClient {
  return {
    queryIndex: vi.fn().mockResolvedValue([{ id: "1", score: 0.9 }]),
    queryJdIndex: vi.fn().mockResolvedValue([]),
    judgeScore: vi.fn().mockResolvedValue({
      score: 0.85, verdict: "Strong Match" as const,
      strengths: ["Python"], gaps: ["Kubernetes"],
      reasoning: "Good fit.", confidence: 0.9,
    }),
  } as unknown as SidecarClient;
}

// FakeListChatModel returns responses from the list in order (cycling)
function makeFakeLlm(responses: string[] = ["Here are matching Python candidates."]) {
  return new FakeListChatModel({ responses });
}

describe("POST /chat", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    app = buildApp(db, makeMockSidecar(), makeFakeLlm());
  });

  // Behavior 1: tracer bullet
  it("returns reply, results, and session_id", async () => {
    const res = await request(app).post("/chat").send({
      session_id: "sess-001",
      message: "find Python developers with 5 years experience",
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reply");
    expect(res.body).toHaveProperty("results");
    expect(res.body).toHaveProperty("session_id", "sess-001");
    expect(typeof res.body.reply).toBe("string");
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  // Behavior 2: turn written to DB
  it("writes both user and assistant turns to chat_messages", async () => {
    const db = createDb(TEST_DB);
    const before = (db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?")
      .get("sess-002") as { c: number }).c;

    await request(app).post("/chat").send({
      session_id: "sess-002",
      message: "show me React developers",
    });

    const after = (db.prepare("SELECT COUNT(*) as c FROM chat_messages WHERE session_id = ?")
      .get("sess-002") as { c: number }).c;
    expect(after - before).toBe(2); // user + assistant
  });

  // Behavior 3: GET returns history
  it("GET /chat/:session_id returns turns with role and content", async () => {
    await request(app).post("/chat").send({
      session_id: "sess-003",
      message: "find DevOps engineers",
    });
    const res = await request(app).get("/chat/sess-003");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const [userTurn, assistantTurn] = res.body;
    expect(userTurn).toHaveProperty("role", "user");
    expect(userTurn).toHaveProperty("content");
    expect(assistantTurn).toHaveProperty("role", "assistant");
  });

  // Behavior 4: memory accumulates
  it("two messages in same session produce 4 rows in history", async () => {
    const fakeLlm = makeFakeLlm(["First response.", "Second response."]);
    const db = createDb(TEST_DB);
    const localApp = buildApp(db, makeMockSidecar(), fakeLlm);

    await request(localApp).post("/chat").send({ session_id: "sess-004", message: "Python devs" });
    await request(localApp).post("/chat").send({ session_id: "sess-004", message: "senior level only" });

    const res = await request(localApp).get("/chat/sess-004");
    expect(res.body.length).toBe(4);
  });

  // Behavior 5: new session starts fresh
  it("GET /chat/:unknown_session returns empty array", async () => {
    const res = await request(app).get("/chat/nonexistent-session-xyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
