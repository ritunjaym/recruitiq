import type { Db } from "../db/client.js";

const TECH_CATEGORIES = [
  "Python Developer", "React Developer", "Data Science", "DevOps",
  "Database", "Java Developer", "Network Security Engineer", "ETL Developer",
  "Information Technology", "SQL Developer", "DotNet Developer", "Blockchain",
];

const SKILL_KEYWORDS: Record<string, string[]> = {
  "Python Developer": ["Python", "Django", "Flask", "FastAPI", "NumPy", "Pandas"],
  "React Developer": ["React", "TypeScript", "JavaScript", "Redux", "Node.js", "CSS"],
  "Data Science": ["Python", "Machine Learning", "TensorFlow", "PyTorch", "SQL", "Pandas"],
  "DevOps": ["Docker", "Kubernetes", "CI/CD", "AWS", "Terraform", "Linux"],
  "Database": ["SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Query Optimization"],
  "Java Developer": ["Java", "Spring Boot", "Hibernate", "Maven", "REST APIs", "Microservices"],
  "Network Security Engineer": ["Firewalls", "VPN", "IDS/IPS", "Network Protocols", "Security Auditing", "SIEM"],
  "ETL Developer": ["ETL", "SQL", "Python", "Data Pipelines", "Informatica", "Apache Spark"],
  "Information Technology": ["IT Support", "Windows", "Linux", "Networking", "Troubleshooting", "Active Directory"],
  "SQL Developer": ["SQL", "T-SQL", "Stored Procedures", "PostgreSQL", "MySQL", "Database Design"],
  "DotNet Developer": ["C#", ".NET", "ASP.NET", "Entity Framework", "Azure", "REST APIs"],
  "Blockchain": ["Solidity", "Ethereum", "Smart Contracts", "Web3.js", "Cryptography", "DeFi"],
};

const FIRST_NAMES = [
  "Alex", "Jordan", "Morgan", "Taylor", "Casey", "Riley", "Avery", "Quinn",
  "Blake", "Reese", "Skylar", "Dakota", "Cameron", "Hayden", "Peyton",
  "Rowan", "Emery", "Finley", "Sage", "Elliot", "Remi", "Corey", "Drew",
  "Kai", "River", "Phoenix", "Ariel", "Jamie", "Jesse", "Robin",
];

const LAST_NAMES = [
  "Chen", "Patel", "Kim", "Garcia", "Williams", "Brown", "Johnson", "Lee",
  "Martinez", "Taylor", "Anderson", "Wilson", "Moore", "Jackson", "White",
  "Harris", "Clark", "Lewis", "Robinson", "Walker", "Hall", "Allen", "Young",
  "Hernandez", "King", "Wright", "Lopez", "Hill", "Scott", "Green",
];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(s) / 0xffffffff;
  };
}

export interface CandidateRow {
  name: string;
  skills: string;
  years_exp: number;
  bio: string;
  past_roles: string;
}

export function buildCandidates(resumeRows: Array<{ Category: string; Text: string }>): CandidateRow[] {
  const techRows = resumeRows.filter((r) => TECH_CATEGORIES.includes(r.Category));

  // Sample 50 evenly across categories
  const byCategory: Record<string, typeof techRows> = {};
  for (const row of techRows) {
    if (!byCategory[row.Category]) byCategory[row.Category] = [];
    byCategory[row.Category].push(row);
  }

  const sampled: typeof techRows = [];
  const rand = seededRand(42);
  while (sampled.length < 50) {
    for (const cat of TECH_CATEGORIES) {
      if (sampled.length >= 50) break;
      const pool = byCategory[cat] ?? [];
      if (pool.length === 0) continue;
      const idx = Math.floor(rand() * pool.length);
      sampled.push(pool[idx]);
    }
  }

  return sampled.map((row, i) => {
    const r = seededRand(i + 100);
    const firstName = FIRST_NAMES[Math.floor(r() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(r() * LAST_NAMES.length)];
    const yearsExp = 1 + Math.floor(r() * 14); // 1–14 years
    const skills = SKILL_KEYWORDS[row.Category] ?? ["Programming", "Problem Solving"];

    return {
      name: `${firstName} ${lastName}`,
      skills: JSON.stringify(skills),
      years_exp: yearsExp,
      bio: row.Text.slice(0, 1000),
      past_roles: JSON.stringify([row.Category]),
    };
  });
}

export function ingestCandidates(db: Db, candidates: CandidateRow[]): void {
  const existing = (db.prepare("SELECT COUNT(*) as count FROM candidates").get() as { count: number }).count;
  if (existing > 0) return; // idempotent

  const insert = db.prepare(
    `INSERT INTO candidates (name, skills, years_exp, bio, past_roles)
     VALUES (@name, @skills, @years_exp, @bio, @past_roles)`
  );
  const insertMany = db.transaction((rows: CandidateRow[]) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(candidates);
}
