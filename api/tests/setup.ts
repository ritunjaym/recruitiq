import { afterAll } from "vitest";
import fs from "fs";

const TEST_DBS = ["./test.db", "./test-jds.db", "./test-ingest.db"];

afterAll(() => {
  for (const db of TEST_DBS) {
    if (fs.existsSync(db)) fs.unlinkSync(db);
  }
});
