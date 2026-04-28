import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";
import type { SidecarClient } from "../src/pipeline/sidecar_client.js";

const TEST_DB = "./test-recommend.db";

function makeMockSidecar(): SidecarClient {
  return {
    queryIndex: vi.fn().mockResolvedValue([
      { id: "1", score: 0.9 },
      { id: "2", score: 0.7 },
    ]),
    queryJdIndex: vi.fn().mockResolvedValue([
      { id: "1", score: 0.88 },
      { id: "2", score: 0.65 },
    ]),
    judgeScore: vi.fn().mockResolvedValue({
      score: 0.85,
      verdict: "Strong Match" as const,
      strengths: ["Python expertise"],
      gaps: ["Missing Kubernetes"],
      reasoning: "Good fit.",
      confidence: 0.9,
    }),
  } as unknown as SidecarClient;
}

describe("GET /candidates/:id/matches", () => {
  let app: ReturnType<typeof buildApp>;
  let candidate_id: number;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    const row = db.prepare("SELECT id FROM candidates LIMIT 1").get() as { id: number };
    candidate_id = row.id;
    app = buildApp(db, makeMockSidecar());
  });

  // Behavior 3: returns array sorted by score desc
  it("returns an array of JD matches", async () => {
    const res = await request(app).get(`/candidates/${candidate_id}/matches`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Behavior 4: all required fields present
  it("each result has required fields", async () => {
    const res = await request(app).get(`/candidates/${candidate_id}/matches`);
    const result = res.body[0];
    expect(result).toHaveProperty("jd_id");
    expect(result).toHaveProperty("jd_title");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("strengths");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("reasoning");
    expect(result).toHaveProperty("confidence");
    expect(typeof result.score).toBe("number");
    expect(Array.isArray(result.strengths)).toBe(true);
  });

  // Behavior 5: unknown candidate returns 404
  it("returns 404 for unknown candidate_id", async () => {
    const res = await request(app).get("/candidates/999999/matches");
    expect(res.status).toBe(404);
  });
});
