import type { Db } from "../db/client.js";
import type { SidecarClient } from "../pipeline/sidecar_client.js";

export async function seedIndexes(
  db: Db,
  sidecar: SidecarClient
): Promise<{ candidateCount: number; jdCount: number }> {
  const [candidateCount, jdCount] = await Promise.all([
    seedCandidateIndex(db, sidecar),
    seedJdIndex(db, sidecar),
  ]);
  return { candidateCount, jdCount };
}

async function seedCandidateIndex(db: Db, sidecar: SidecarClient): Promise<number> {
  const rows = db.prepare(
    "SELECT id, name, skills, years_exp, bio, past_roles FROM candidates"
  ).all() as Array<{ id: number; name: string; skills: string; years_exp: number; bio: string; past_roles: string }>;

  if (rows.length === 0) return 0;

  const documents = rows.map((r) => ({
    id: String(r.id),
    text: `Name: ${r.name}\nSkills: ${r.skills}\nYears of experience: ${r.years_exp}\nBio: ${r.bio}\nPast roles: ${r.past_roles}`,
  }));

  const res = await sidecar.buildIndex("candidate", documents);
  if (!res.ok) throw new Error(`Candidate index build failed: ${res.status}`);
  console.log(`Seeded sidecar index with ${documents.length} candidates`);
  return documents.length;
}

async function seedJdIndex(db: Db, sidecar: SidecarClient): Promise<number> {
  const rows = db.prepare(
    "SELECT id, title, company, description FROM job_descriptions"
  ).all() as Array<{ id: number; title: string; company: string; description: string }>;

  if (rows.length === 0) return 0;

  const documents = rows.map((r) => ({
    id: String(r.id),
    // Truncate description to first 500 chars — removes noise, improves cosine scores
    text: `Title: ${r.title}\nCompany: ${r.company}\n${r.description.slice(0, 500)}`,
  }));

  const res = await sidecar.buildIndex("jd", documents);
  if (!res.ok) throw new Error(`JD index build failed: ${res.status}`);
  console.log(`Seeded sidecar JD index with ${documents.length} JDs`);
  return documents.length;
}
