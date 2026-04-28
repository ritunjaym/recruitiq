import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";
import type { SidecarClient } from "../src/pipeline/sidecar_client.js";

const TEST_DB = "./test-match.db";

function makeMockSidecar(scores: number[]): SidecarClient {
  let callCount = 0;
  return {
    queryIndex: vi.fn().mockResolvedValue([
      { id: "1", score: 0.9 },
      { id: "2", score: 0.7 },
    ]),
    judgeScore: vi.fn().mockImplementation(async () => ({
      score: scores[callCount++ % scores.length] ?? 0.5,
      verdict: "Strong Match" as const,
      strengths: ["Python expertise"],
      gaps: ["Missing Kubernetes"],
      reasoning: "Good fit overall.",
      confidence: 0.9,
    })),
  } as unknown as SidecarClient;
}

describe("POST /match", () => {
  let app: ReturnType<typeof buildApp>;
  let jd_id: number;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    const jd = db.prepare("SELECT id FROM job_descriptions LIMIT 1").get() as { id: number };
    jd_id = jd.id;
    app = buildApp(db, makeMockSidecar([0.9, 0.7]));
  });

  // Behavior 5: tracer bullet — returns ranked array
  it("returns an array of match results", async () => {
    const res = await request(app).post("/match").send({ jd_id });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  // Behavior 6: all required fields present
  it("each result has all required MatchScore fields", async () => {
    const res = await request(app).post("/match").send({ jd_id });
    const result = res.body[0];
    expect(result).toHaveProperty("candidate_id");
    expect(result).toHaveProperty("candidate_name");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("strengths");
    expect(result).toHaveProperty("gaps");
    expect(result).toHaveProperty("reasoning");
    expect(result).toHaveProperty("confidence");
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.gaps)).toBe(true);
  });

  // Behavior 7: GET /match/:jd_id returns cached results
  it("GET /match/:jd_id returns cached results", async () => {
    await request(app).post("/match").send({ jd_id });
    const res = await request(app).get(`/match/${jd_id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("score");
  });

  // Behavior 8: unknown jd_id returns 404
  it("returns 404 for unknown jd_id", async () => {
    const res = await request(app).post("/match").send({ jd_id: 999999 });
    expect(res.status).toBe(404);
  });
});
