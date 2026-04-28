import type { Db } from "../db/client.js";

export interface JdRow {
  title: string;
  company: string;
  description: string;
  source: string;
}

export function ingestJds(db: Db, jdRows: JdRow[]): void {
  const existing = (db.prepare("SELECT COUNT(*) as count FROM job_descriptions").get() as { count: number }).count;
  if (existing > 0) return; // idempotent

  const insert = db.prepare(
    `INSERT INTO job_descriptions (title, company, description, source)
     VALUES (@title, @company, @description, @source)`
  );
  const insertMany = db.transaction((rows: JdRow[]) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(jdRows);
}
