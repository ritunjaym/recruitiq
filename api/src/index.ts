import { createDb } from "./db/client.js";
import { runIngest } from "./ingest/index.js";
import { buildApp } from "./app.js";

const PORT = process.env.PORT ?? 4000;

const db = createDb();
await runIngest(db);
const app = buildApp(db);

app.listen(PORT, () => {
  console.log(`RecruitIQ API running on port ${PORT}`);
});
