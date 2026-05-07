import { ChatAnthropic } from "@langchain/anthropic";
import { createDb } from "./db/client.js";
import { runIngest } from "./ingest/index.js";
import { buildApp } from "./app.js";
import { SidecarClient } from "./pipeline/sidecar_client.js";

const PORT = process.env.PORT ?? 4000;

const db = createDb();
await runIngest(db);

const sidecar = new SidecarClient();
const llm = new ChatAnthropic({ model: "claude-haiku-4-5-20251001" });
const app = buildApp(db, sidecar, llm);

app.listen(PORT, () => {
  console.log(`RecruitIQ API running on port ${PORT}`);
});
