# RecruitIQ

**AI-powered talent matching platform** — semantic candidate ranking, bidirectional recommendation, conversational search, and LLM-as-judge scoring. Built end-to-end with TypeScript, React, Python, LangChain, FAISS, and GCP.

🔗 **Live Demo:** https://recruitiq-api-328237540203.us-west2.run.app

📐 **Architecture decisions with measured tradeoffs:** [View ADR Document](https://docs.google.com/document/d/10cF1FzHtbRyVuq95xspW-5luZZwr6IiQxjxVFofIFk4/edit?usp=sharing)


---

## What It Does

RecruitIQ ingests job descriptions and candidate profiles, embeds them with sentence transformers, retrieves semantically similar matches via FAISS, and reranks with a Claude-powered judge that returns structured scores — all surfaced in a polished React dashboard with conversational search.

**Core loop:**
```
JD input → LangChain pipeline → LlamaIndex chunking
                                        ↓
                             FAISS cosine retrieval (top-K)
                                        ↓
                  Pre-filter (score ≥ 0.25) → Claude judge agent
                  pydantic-ai tools: search_candidates() + get_candidate_detail()
                                        ↓
                  MatchScore {score, verdict, strengths, gaps, reasoning}
                                        ↓
                  React dashboard — leaderboard, detail view, chat panel
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  React/TypeScript UI                        │
│  Leaderboard · Chat · Detail · Search       │
└────────────────────┬────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────┐
│  Node.js / Express API (TypeScript)         │
│  Routes · LangChain chat · SQLite · pLimit  │
└────────────────────┬────────────────────────┘
                     │ HTTP (internal Cloud Run)
┌────────────────────▼────────────────────────┐
│  Python FastAPI Sidecar                     │
│  sentence-transformers · FAISS · pydantic-ai│
│  Claude judge agent with tool use           │
└─────────────────────────────────────────────┘
```

Two services. Polyglot by design: Node.js handles concurrency, Python owns ML.

---

## Features

### Candidate–Job Matching
- Semantic search via FAISS IndexFlatIP (cosine similarity)
- Two-stage pipeline: FAISS retrieval → score threshold filter → Claude judge
- Structured output: `score`, `verdict`, `strengths`, `skill_gaps`, `reasoning`, `confidence`
- Bidirectional: JD → candidates AND candidate → JDs

### Conversational Search
- LangChain `RunnableWithMessageHistory` — multi-turn memory
- Context persisted to SQLite, rehydrated on session resume
- Candidate results rendered as clickable cards → full judge detail view
- Example: "find React engineers" → "now filter to senior level" → retains context

### LLM Judge Agent (pydantic-ai)
- `claude-sonnet-4-6` with structured `MatchScore` output type
- Two registered tools: `search_candidates()` and `get_candidate_detail()`
- Agent autonomously fetches context before scoring (avg 3-4 tool calls per judge invocation)
- Automatic retry on schema violation (3× via `UnexpectedModelBehavior`)

### Prompt Versioning + Evaluation
- Two named variants: `v1-standard` (balanced) and `v2-strict` (penalises missing must-haves)
- 10-pair controlled eval set (`eval_set.json`): 5 strong + 5 weak candidates
- `POST /api/eval` — side-by-side version comparison on same inputs
- `GET /api/prompt-logs/compare` — aggregate metrics per version

### Production Reliability
- `pLimit(5)` — concurrent LLM call cap in both match and recommend pipelines
- FAISS auto-rebuild on cold start: `_load_or_rebuild_indexes()` fetches seed data from API if disk is empty
- `--min-instances=1` on sidecar: keeps one instance warm
- Zod runtime validation on all DB query results
- `GET /api/reseed` — manual index rebuild trigger

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| API | Node.js, Express, TypeScript (strict mode) |
| Chat/pipelines | LangChain (RunnableWithMessageHistory, RunnableSequence, ChatPromptTemplate) |
| LLM judge | pydantic-ai + Claude (claude-sonnet-4-6) |
| Chat LLM | LangChain + ChatAnthropic (claude-haiku-4-5-20251001) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, 384-dim) |
| Vector search | FAISS IndexFlatIP (cosine via L2-normalised vectors) |
| DB | SQLite (better-sqlite3) + Zod runtime validation |
| Sidecar | Python 3.12, FastAPI, uvicorn |
| Containers | Docker, docker-compose |
| Deployment | GCP Cloud Run, Artifact Registry (us-west2) |
| Testing | Vitest (26 tests), pytest (20 tests) |

---

## Data

| Source | Details |
|---|---|
| Job descriptions | [HuggingFace: jacob-hugging-face/job-descriptions](https://huggingface.co/datasets/jacob-hugging-face/job-descriptions) — 853 JDs, bundled at build time |
| Candidates | Synthetic profiles derived from [ahmedheakl/resume-atlas](https://huggingface.co/datasets/ahmedheakl/resume-atlas) — real resume text, synthetic names, 50 candidates across 12 tech categories (seed=42, deterministic) |

Both datasets are bundled into the Docker image (`/data/fixtures.json`) — no runtime downloads, no API keys needed for data.

---

## API Reference

```
POST /api/match              → rank candidates for a JD (FAISS + Claude judge)
GET  /api/candidates/:id/matches → find matching JDs for a candidate
POST /api/chat               → conversational search with memory
POST /api/judge              → score arbitrary candidate/JD pair on demand
GET  /api/candidates         → list all candidates
GET  /api/jds?page=&limit=&search= → paginated JD search (853 total)
GET  /api/prompt-logs/compare → avg score + latency by prompt version
POST /api/eval               → run controlled eval set across both prompt versions
GET  /api/reseed             → rebuild FAISS indexes from seed data
```

---

## Running Locally

**Prerequisites:** Docker Desktop, Anthropic API key

```bash
git clone https://github.com/ritunjaym/recruitiq
cd recruitiq

# Start full stack (API + sidecar + UI)
ANTHROPIC_API_KEY=sk-ant-... docker compose up

# Open
open http://localhost:3000
```

All 853 JDs and 50 candidates are pre-loaded. FAISS indexes build automatically on first startup (~2 min).

---

## Running Tests

```bash
# Node.js API (26 tests)
cd api && npx vitest run

# Python sidecar (20 tests)
cd sidecar && pytest

# All green: 46/46
```

---

## Deployment

```bash
# Deploy both services to GCP Cloud Run
ANTHROPIC_API_KEY=sk-ant-... ./scripts/deploy.sh

# Verify
API_URL=https://your-api-url.run.app ./scripts/verify_deploy.sh
```

Deploy script builds and pushes both Docker images to Artifact Registry, deploys sidecar first (gets URL), then deploys API wired to sidecar URL.

---

## Architecture Decisions

See [ADR](https://docs.google.com/document/d/10cF1FzHtbRyVuq95xspW-5luZZwr6IiQxjxVFofIFk4/edit?usp=sharing)
 for documented decisions on:
- Polyglot architecture rationale (TypeScript + Python)
- FAISS over managed vector services
- Two-stage retrieve-then-rerank pipeline
- pydantic-ai agent tool use for structured judging
- LangChain message history + SQLite rehydration
- Prompt versioning + controlled evaluation methodology
- pLimit(5) concurrency strategy
- FAISS auto-rebuild on cold start

---

## Project Structure

```
recruitiq/
├── api/                    # Node.js/TypeScript API
│   ├── src/
│   │   ├── routes/         # Express routes (typed)
│   │   ├── pipeline/       # match_pipeline, recommend_pipeline
│   │   ├── chat/           # chat_service (LangChain)
│   │   ├── db/             # SQLite client + Zod schemas
│   │   └── ingest/         # Data loading + FAISS seeding
│   └── tests/              # Vitest (26 tests)
├── sidecar/                # Python FastAPI sidecar
│   ├── services/
│   │   ├── index_service.py   # FAISS build/query/persist
│   │   └── judge_service.py   # pydantic-ai agent + tools
│   └── tests/              # pytest (20 tests)
├── ui/                     # React/TypeScript frontend
│   └── src/
│       ├── components/     # CandidateCard, ChatPanel, DetailView
│       └── types/          # Shared TypeScript interfaces
├── scripts/
│   ├── deploy.sh           # GCP Cloud Run deploy
│   └── verify_deploy.sh    # Live endpoint verification
├── eval_set.json           # 10-pair controlled prompt eval set
├── docker-compose.yml      # Local full-stack setup
└── ADR.md                  # Architecture decision records
```

---

## Git Tags

| Tag | Description |
|---|---|
| `slice-1-complete` through `slice-12-complete` | Vertical slice milestones |
| `v1.0-pre-depth-fixes` | Post-slice-12 baseline |
| `v1.1-depth-fixes-complete` | FAISS persistence, pagination, prompt versioning |
| `v1.2-all-gaps-fixed` | Full audit gaps resolved — current production version |

---

## Live Endpoints

- **API:** https://recruitiq-api-328237540203.us-west2.run.app
- **Health:** https://recruitiq-api-328237540203.us-west2.run.app/health
- **Sidecar health:** https://recruitiq-sidecar-328237540203.us-west2.run.app/health
