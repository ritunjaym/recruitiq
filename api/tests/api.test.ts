import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";

const TEST_DB = "./test-api.db";

describe("Node API — typed endpoints", () => {
  let app: ReturnType<typeof buildApp>;
  let candidateId: number;
  let jdId: number;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    const c = db.prepare("SELECT id FROM candidates LIMIT 1").get() as { id: number };
    const j = db.prepare("SELECT id FROM job_descriptions LIMIT 1").get() as { id: number };
    candidateId = c.id;
    jdId = j.id;
    app = buildApp(db);
  });

  // Behavior 1 — health check
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  // Behavior 2 — single candidate
  it("GET /candidates/:id returns candidate with all fields", async () => {
    const res = await request(app).get(`/candidates/${candidateId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", candidateId);
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("skills");
    expect(res.body).toHaveProperty("years_exp");
    expect(res.body).toHaveProperty("bio");
    expect(res.body).toHaveProperty("past_roles");
    expect(Array.isArray(res.body.skills)).toBe(true);
  });

  // Behavior 3 — single candidate 404
  it("GET /candidates/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/candidates/999999");
    expect(res.status).toBe(404);
  });

  // Behavior 4 — single JD
  it("GET /jds/:id returns JD with all fields", async () => {
    const res = await request(app).get(`/jds/${jdId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", jdId);
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("company");
    expect(res.body).toHaveProperty("description");
  });

  // Behavior 5 — single JD 404
  it("GET /jds/:id returns 404 for unknown id", async () => {
    const res = await request(app).get("/jds/999999");
    expect(res.status).toBe(404);
  });

  // Behavior 6 — POST /match missing body
  it("POST /match without jd_id returns 400", async () => {
    const res = await request(app).post("/match").send({});
    expect(res.status).toBe(400);
  });

  // Behavior 7 — JSON content-type
  it("GET /candidates responds with application/json", async () => {
    const res = await request(app).get("/candidates");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("GET /jds responds with application/json", async () => {
    const res = await request(app).get("/jds");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });
});
