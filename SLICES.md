# RecruitIQ — Implementation Slices

Each slice is a thin vertical cut through all layers. On completion: `git tag slice-N-complete`.

## Slice 1 — Data Ingest: JDs + Synthetic Candidates → SQLite
**Status:** TODO  
**Blocked by:** None  
**PRD stories:** 1, 10, 11, 16, 17, 19

Load HuggingFace JDs and generate 50 synthetic candidates via Claude API. Store both in SQLite with full schema. Verified by `GET /jds` and `GET /candidates` returning populated data.

---

## Slice 2 — FAISS Index: Build, Persist, Query
**Status:** TODO  
**Blocked by:** Slice 1  
**PRD stories:** 8, 16, 17, 18

IndexService builds FAISS index from candidate bios, saves to disk, loads on restart. `POST /index/query` returns top-K candidate IDs + similarity scores.

---

## Slice 3 — Judge: Pydantic AI MatchScore via Claude
**Status:** TODO  
**Blocked by:** None (parallel with Slice 2)  
**PRD stories:** 2, 3, 4, 12, 16, 17

JudgeService accepts JD text + candidate profile, returns validated MatchScore. Retries up to 3× on schema failure.

---

## Slice 4 — Matching Pipeline: LangChain Orchestration End-to-End
**Status:** TODO  
**Blocked by:** Slices 2 + 3  
**PRD stories:** 1, 8, 10, 16, 17

`POST /match`: JD ID → IndexService top-K → JudgeService per candidate (≤5 concurrent) → ranked array. `GET /match/:jd_id` returns cached results.

---

## Slice 5 — Recommendation Engine: Both Directions
**Status:** TODO  
**Blocked by:** Slice 4  
**PRD stories:** 7, 8

`GET /candidates/:id/matches` returns top matching JDs ranked by score.

---

## Slice 6 — FastAPI Sidecar: Production-Ready HTTP Server
**Status:** TODO  
**Blocked by:** Slices 2 + 3  
**PRD stories:** 17, 18

Typed request/response models, error handling, health check. Hardens IndexService + JudgeService HTTP contracts.

---

## Slice 7 — Express/Node API: All Typed Endpoints
**Status:** TODO  
**Blocked by:** Slice 6  
**PRD stories:** 16, 17

All routes typed with TypeScript matching FastAPI contracts. Vitest tests for happy path + edge cases per route.

---

## Slice 8 — React/TypeScript UI: Leaderboard + Detail View
**Status:** TODO  
**Blocked by:** Slice 7  
**PRD stories:** 1, 2, 3, 4, 9, 11, 12, 13

LeaderboardView + CandidateDetailView. Fetches from Node API only.

---

## Slice 9 — Conversational Search: LangChain Memory + NL → FAISS
**Status:** TODO  
**Blocked by:** Slice 7  
**PRD stories:** 5, 6, 14, 19

`POST /chat`: session + message → ConversationChain → FAISS → ranked results. Writes to `chat_messages`. `GET /chat/:session_id` returns history.

---

## Slice 10 — Chatbot UI: React Streaming Chat Panel
**Status:** TODO  
**Blocked by:** Slices 8 + 9  
**PRD stories:** 5, 6, 14

ChatPanel with text input, scrollable history, inline candidate cards. Session ID from localStorage.

---

## Slice 11 — Docker: Containerize Full Stack
**Status:** TODO  
**Blocked by:** Slices 7 + 9  
**PRD stories:** 15, 20

docker-compose.yml with sidecar + api + ui. Health checks, FAISS volume mount. Single `docker-compose up` starts everything.

---

## Slice 12 — GCP Cloud Run Deploy
**Status:** TODO  
**Blocked by:** Slice 11  
**PRD stories:** 20  
**GCP config:** project=recruitiq-494623, region=us-west2

Dockerfiles, Cloud Run services for sidecar + api, static UI build. deploy.sh scripts the full deploy.

---

## Git Tags

| Tag | Slice |
|-----|-------|
| `slice-1-complete` | Data Ingest |
| `slice-2-complete` | FAISS Index |
| `slice-3-complete` | Judge |
| `slice-4-complete` | Matching Pipeline |
| `slice-5-complete` | Recommendation Engine |
| `slice-6-complete` | FastAPI Sidecar |
| `slice-7-complete` | Node API |
| `slice-8-complete` | React UI |
| `slice-9-complete` | Conversational Search |
| `slice-10-complete` | Chatbot UI |
| `slice-11-complete` | Docker |
| `slice-12-complete` | GCP Deploy |
