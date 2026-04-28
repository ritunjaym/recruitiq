import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";

const TEST_DB = "./test-jds.db";

describe("GET /jds", () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    app = buildApp(db);
  });

  it("returns at least 1 JD", async () => {
    const res = await request(app).get("/jds");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("each JD has required fields", async () => {
    const res = await request(app).get("/jds");
    const jd = res.body[0];
    expect(jd).toHaveProperty("id");
    expect(jd).toHaveProperty("title");
    expect(jd).toHaveProperty("company");
    expect(jd).toHaveProperty("description");
  });
});
