import Database from "better-sqlite3";

export type Db = Database.Database;

export function createDb(path = process.env.DB_PATH ?? "./recruitiq.db"): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      skills TEXT NOT NULL,
      years_exp INTEGER NOT NULL,
      bio TEXT NOT NULL,
      past_roles TEXT NOT NULL,
      embedding_id TEXT
    );

    CREATE TABLE IF NOT EXISTS job_descriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT,
      embedding_id TEXT
    );

    CREATE TABLE IF NOT EXISTS match_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jd_id INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL,
      score REAL NOT NULL,
      verdict TEXT NOT NULL,
      strengths TEXT NOT NULL,
      gaps TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      confidence REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (jd_id) REFERENCES job_descriptions(id),
      FOREIGN KEY (candidate_id) REFERENCES candidates(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}
