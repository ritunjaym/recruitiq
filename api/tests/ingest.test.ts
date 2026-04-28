import { describe, it, expect, beforeAll } from "vitest";
import { createDb } from "../src/db/client.js";
import { runIngest } from "../src/ingest/index.js";

const TEST_DB = "./test-ingest.db";

describe("Ingest idempotency", () => {
  beforeAll(async () => {
    const db = createDb(TEST_DB);
    await runIngest(db);
    await runIngest(db); // run twice
  });

  it("running ingest twice produces exactly 50 candidates", async () => {
    const db = createDb(TEST_DB);
    const row = db.prepare("SELECT COUNT(*) as count FROM candidates").get() as { count: number };
    expect(row.count).toBe(50);
  });

  it("running ingest twice produces no duplicate JDs", async () => {
    const db = createDb(TEST_DB);
    const total = (db.prepare("SELECT COUNT(*) as count FROM job_descriptions").get() as { count: number }).count;
    const distinct = (db.prepare("SELECT COUNT(DISTINCT description) as count FROM job_descriptions").get() as { count: number }).count;
    expect(total).toBe(distinct);
  });
});
