import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";

const TEST_DB = "./test.db";

describe("GET /candidates", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    app = buildApp(db);
  });

  it("returns 50 candidates", async () => {
    const res = await request(app).get("/candidates");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it("each candidate has required fields", async () => {
    const res = await request(app).get("/candidates");
    const candidate = res.body[0];
    expect(candidate).toHaveProperty("id");
    expect(candidate).toHaveProperty("name");
    expect(candidate).toHaveProperty("skills");
    expect(candidate).toHaveProperty("years_exp");
    expect(candidate).toHaveProperty("bio");
    expect(candidate).toHaveProperty("past_roles");
    expect(Array.isArray(candidate.skills)).toBe(true);
    expect(typeof candidate.years_exp).toBe("number");
  });
});
