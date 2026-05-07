import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import type { Db } from "../db/client.js";
import { buildCandidates, ingestCandidates } from "./candidates.js";
import { ingestJds, type JdRow } from "./jds.js";
import { SidecarClient } from "../pipeline/sidecar_client.js";

const FIXTURE_PATH = process.env.FIXTURE_PATH ?? path.resolve("./src/ingest/fixtures.json");

interface Fixtures {
  candidates: Array<{ Category: string; Text: string }>;
  jds: JdRow[];
}

function loadFixtures(): Fixtures {
  if (fs.existsSync(FIXTURE_PATH)) {
    return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
  }

  // Fetch from HuggingFace via Python (one-time, cached as fixture)
  const script = `
import json, sys
from datasets import load_dataset

resumes = load_dataset('ahmedheakl/resume-atlas', split='train', trust_remote_code=True)
jds_raw = load_dataset('jacob-hugging-face/job-descriptions', split='train', trust_remote_code=True)

resume_rows = [{'Category': r['Category'], 'Text': r['Text']} for r in resumes]

jd_rows = []
for r in jds_raw:
    jd_rows.append({
        'title': r.get('job_title') or r.get('position_title') or 'Software Engineer',
        'company': r.get('company_name') or r.get('company') or 'Unknown',
        'description': r.get('job_description') or r.get('description') or '',
        'source': 'huggingface/jacob-job-descriptions'
    })

print(json.dumps({'candidates': resume_rows, 'jds': jd_rows}))
`;

  const result = execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, {
    maxBuffer: 200 * 1024 * 1024,
  });

  const fixtures: Fixtures = JSON.parse(result.toString());
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixtures));
  return fixtures;
}

export async function runIngest(db: Db): Promise<void> {
  const fixtures = loadFixtures();
  const candidates = buildCandidates(fixtures.candidates);
  ingestCandidates(db, candidates);
  ingestJds(db, fixtures.jds);
  await seedSidecarIndex(db);
  await seedJdIndex(db);
}

async function seedSidecarIndex(db: Db): Promise<void> {
  const sidecar = new SidecarClient();
  const rows = db.prepare(
    "SELECT id, name, skills, years_exp, bio, past_roles FROM candidates"
  ).all() as Array<{ id: number; name: string; skills: string; years_exp: number; bio: string; past_roles: string }>;

  if (rows.length === 0) return;

  const documents = rows.map((r) => ({
    id: String(r.id),
    text: `Name: ${r.name}\nSkills: ${r.skills}\nYears of experience: ${r.years_exp}\nBio: ${r.bio}\nPast roles: ${r.past_roles}`,
  }));

  const res = await fetch(`${process.env.SIDECAR_URL ?? "http://localhost:8000"}/index/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) throw new Error(`Sidecar index build failed: ${res.status}`);
  console.log(`Seeded sidecar index with ${documents.length} candidates`);
}

async function seedJdIndex(db: Db): Promise<void> {
  const rows = db.prepare(
    "SELECT id, title, company, description FROM job_descriptions"
  ).all() as Array<{ id: number; title: string; company: string; description: string }>;

  if (rows.length === 0) return;

  const documents = rows.map((r) => ({
    id: String(r.id),
    text: `Title: ${r.title}\nCompany: ${r.company}\n${r.description}`,
  }));

  const res = await fetch(`${process.env.SIDECAR_URL ?? "http://localhost:8000"}/jd-index/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  if (!res.ok) throw new Error(`Sidecar JD index build failed: ${res.status}`);
  console.log(`Seeded sidecar JD index with ${documents.length} JDs`);
}
