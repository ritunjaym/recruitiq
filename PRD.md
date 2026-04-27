# RecruitIQ — Product Requirements Document

## Problem Statement

Recruiters and hiring managers spend hours manually screening candidates against job descriptions — reading resumes line by line, applying inconsistent criteria, and missing qualified candidates who don't use the exact right keywords. The signal-to-noise ratio in a candidate pipeline is low, and the process doesn't scale. There is no tool that semantically understands both a job description and a candidate profile, ranks candidates by true fit, explains the reasoning, and lets a recruiter interrogate the results in plain English.

## Solution

RecruitIQ is an AI talent matching pipeline with a React dashboard. A recruiter pastes or selects a job description; the system semantically retrieves the top candidates from a pool, runs each through an LLM judge that produces a structured MatchScore, and surfaces a ranked leaderboard with per-candidate explanations (strengths, gaps, verdict, confidence). The recruiter can then ask the conversational search panel questions like "show me candidates with Rust experience and 3+ years" and get filtered, context-aware ranked results. Matching runs in both directions: JD → candidates and candidate → best matching JDs.

---

## User Stories

1. As a recruiter, I want to paste a job description and immediately see a ranked list of candidates, so that I can prioritize who to interview without reading every resume.
2. As a recruiter, I want each candidate card to show a match score (0–100), verdict, and 2–4 bullet strengths, so that I can scan the leaderboard in seconds.
3. As a recruiter, I want to click a candidate and see a full detail view with strengths, gaps, reasoning narrative, and confidence score, so that I can understand exactly why they ranked where they did.
4. As a recruiter, I want the system to flag low-confidence matches, so that I know when to apply extra scrutiny rather than trusting the score blindly.
5. As a recruiter, I want to search candidates using natural language ("Python engineer, fintech background, 5+ years"), so that I don't have to learn a query language.
6. As a recruiter, I want the chatbot to remember what I said earlier in the conversation ("now filter those to senior level"), so that I can refine results iteratively without restating my full context.
7. As a recruiter, I want to see which job descriptions best match a specific candidate, so that I can proactively reach out with relevant openings.
8. As a recruiter, I want results ranked by semantic fit, not keyword overlap, so that "distributed systems" and "microservices" are treated as related concepts.
9. As a recruiter, I want the leaderboard to show a verdict label (Strong Match / Potential Match / Poor Match), so that I can triage at a glance without reading scores.
10. As a recruiter, I want the system to load quickly (under 10 seconds end-to-end), so that I can use it in a live screening session.
11. As a recruiter, I want to select from a list of pre-loaded job descriptions, so that I don't have to copy-paste every time.
12. As a recruiter, I want the gap analysis to be specific ("missing: Kubernetes, required by JD"), not vague ("lacks some experience"), so that I can ask better interview questions.
13. As a recruiter, I want to filter the leaderboard by verdict category, so that I can focus on Strong Matches when I'm in a hurry.
14. As a recruiter, I want the chatbot conversation history visible in the UI, so that I can scroll back and see what I asked and what the system returned.
15. As a recruiter, I want the full stack to run from a single `docker-compose up`, so that I can demo it without a complex setup.
16. As an engineer, I want all pipeline components tested with at least happy path + one edge case, so that I can refactor with confidence.
17. As an engineer, I want typed API contracts between the Node API and the FastAPI sidecar, so that mismatches fail at compile time, not runtime.
18. As an engineer, I want the FAISS index to be persisted to disk, so that I don't rebuild it on every restart.
19. As an engineer, I want chat turns written to SQLite even during per-session memory, so that the schema supports persistence without a migration later.
20. As an engineer, I want the matching pipeline deployable to GCP Cloud Run, so that a demo URL can be shared without local setup.

---

## Implementation Decisions

### Architecture Overview

Three processes, one network:

```
React UI (port 3000)
    ↕ HTTP
Node/Express API (port 4000)   ←→   SQLite (candidates, jds, match_results, chat_messages)
    ↕ HTTP
FastAPI sidecar (port 8000)    ←→   FAISS index (disk) + Pydantic AI judge (Claude API)
```

### Module Breakdown

**Python FastAPI Sidecar** — two deep modules:

- `IndexService`: owns the FAISS index lifecycle. Accepts raw text documents, embeds them via `sentence-transformers`, builds/saves/loads the index, and exposes a `query(text, top_k)` method returning candidate IDs + similarity scores. Interface: `POST /index/build`, `POST /index/query`.
- `JudgeService`: accepts a JD text + candidate profile text, calls Claude via Pydantic AI, validates the `MatchScore` response schema, retries up to 3 times on validation failure. Interface: `POST /judge/score`.

**Node/Express API** — three modules:

- `IngestionRouter`: loads HuggingFace JDs and synthetic candidates into SQLite on startup (idempotent). Exposes `GET /jds` and `GET /candidates`.
- `MatchRouter`: orchestrates the full pipeline. `POST /match` accepts a JD ID, calls IndexService to retrieve top-K candidates, calls JudgeService per candidate (parallelized, capped at 5 concurrent), writes results to `match_results`, returns ranked array. `GET /match/:jd_id` returns cached results.
- `ChatRouter`: manages conversational search. `POST /chat` accepts a message + session ID, passes through LangChain ConversationChain (with per-session memory backed by `ConversationBufferMemory`), routes to FAISS query + ranked results. Writes turn to `chat_messages`. `GET /chat/:session_id` returns history.

**React/TypeScript UI** — three screens:

- `LeaderboardView`: JD selector, ranked candidate cards (score, verdict, top strength), filter by verdict.
- `CandidateDetailView`: full MatchScore display — score gauge, verdict badge, strengths list, gaps list, reasoning paragraph, confidence indicator.
- `ChatPanel`: persistent right-side panel, text input, scrollable conversation history, results render as mini candidate cards inline.

### Database Schema (SQLite)

```
candidates(id, name, skills, years_exp, bio, past_roles, embedding_id)
job_descriptions(id, title, company, description, source, embedding_id)
match_results(id, jd_id, candidate_id, score, verdict, strengths, gaps, reasoning, confidence, created_at)
chat_messages(id, session_id, role, content, created_at)
```

### MatchScore Contract (Pydantic)

```python
class MatchScore(BaseModel):
    score: float          # 0.0–1.0
    verdict: Literal["Strong Match", "Potential Match", "Poor Match"]
    strengths: list[str]  # 2–4 items
    gaps: list[str]       # 2–4 items
    reasoning: str        # 2–3 sentence narrative
    confidence: float     # 0.0–1.0
```

### Tool Ownership

| Tool | Owns |
|---|---|
| LlamaIndex | Document chunking, text preprocessing for JDs and candidate bios |
| LangChain | Matching pipeline orchestration, ConversationChain, per-session memory |
| FAISS | Vector index build/query, persisted to disk |
| Pydantic AI | MatchScore structured output, schema validation, retry on malformed response |
| FastAPI | Python sidecar HTTP server, exposes IndexService + JudgeService |
| Claude API | Powers the judge (via Pydantic AI) and synthetic candidate generation |
| Node/Express | All business logic routing, SQLite reads/writes, orchestrates sidecar calls |
| React/TypeScript | UI only — no direct DB or FAISS access |
| SQLite | Persistent store for JDs, candidates, match results, chat history |
| Docker | Containerizes all three processes, single `docker-compose up` |
| GCP Cloud Run | Deployment target for sidecar + API containers |
| pytest | Tests for Python sidecar (IndexService, JudgeService) |
| Vitest | Tests for Node API (IngestionRouter, MatchRouter, ChatRouter) |

### Data Generation

- JDs: loaded from `jacob-hugging-face/job-descriptions` HuggingFace dataset (real data)
- Candidates: 50 synthetic profiles generated with Claude API at ingest time, with deliberate variation: 4 seniority tiers, overlapping skill clusters, ~5 "trap" candidates (strong surface, missing key requirement), ~5 "hidden gems" (modest title, strong skill match)

### Conversation Memory Design

- Per-session, using LangChain `ConversationBufferMemory` in Node process memory
- Session ID: UUID generated client-side, stored in `localStorage`
- Every turn (user message + assistant response) written to `chat_messages` table synchronously
- Memory is reconstructed from DB on session resume within the same browser session (supports page refresh); cross-session persistence is out of scope

---

## Testing Decisions

**What makes a good test**: test observable outputs given controlled inputs — what comes out of a module's public interface, not how it computes it. No mocking of internal collaborators; mock only external I/O (Claude API, HuggingFace dataset fetch).

| Module | Test type | What to cover |
|---|---|---|
| `IndexService` | pytest unit | Build index from N docs, query returns top-K IDs; query on empty index returns empty |
| `JudgeService` | pytest unit (mock Claude) | Valid MatchScore returned; malformed Claude response triggers retry; 3 retries exhausted raises error |
| `IngestionRouter` | Vitest unit | Idempotent load (run twice, no duplicates); missing dataset field handled gracefully |
| `MatchRouter` | Vitest integration | `POST /match` returns ranked array sorted by score desc; JD with no candidates returns empty array |
| `ChatRouter` | Vitest unit | Session memory accumulates across turns; new session ID starts fresh memory |
| Full pipeline | pytest e2e | Paste JD → receive MatchScore array with all required fields non-null |

---

## Out of Scope

- User authentication / multi-tenant access
- Real candidate profiles (all candidates are synthetic)
- Cross-session persistent memory (per-session only for MVP)
- Prompt A/B testing and quality delta logging (slice 9)
- Mobile-responsive UI
- Webhook integrations with ATS systems (Greenhouse, Lever, etc.)
- Candidate-facing interface

---

## Further Notes

- The FastAPI sidecar and Node API communicate over `localhost` in development; in Docker they communicate over the internal Docker network via service names.
- FAISS index is built once at startup from all candidates in SQLite; incremental updates are not required for MVP.
- Parallelized judge calls per candidate should be capped at 5 concurrent requests to avoid Claude API rate limits.
- The `docker-compose.yml` must define health checks so the Node API waits for the FastAPI sidecar to be ready before accepting requests.
- GCP Cloud Run deployment uses two separate services (sidecar + API); the React UI is served as a static build from the Node service.
