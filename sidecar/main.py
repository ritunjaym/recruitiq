from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from services.index_service import IndexService, IndexDoc
from services.judge_service import JudgeService

app = FastAPI(title="RecruitIQ Sidecar")

_CANDIDATE_INDEX_PATH = "/data/faiss-candidates.index"
_JD_INDEX_PATH = "/data/faiss-jds.index"

_index = IndexService()      # candidate index (JD → candidates)
_jd_index = IndexService()  # JD index (candidate → JDs)
_judge: JudgeService | None = None


@app.on_event("startup")
async def _load_or_rebuild_indexes() -> None:
    import httpx, os

    # 1. Try loading from persisted disk files
    loaded_candidates, loaded_jds = False, False
    try:
        _index.load(_CANDIDATE_INDEX_PATH)
        print(f"Loaded candidate index ({_index.size} docs) from disk")
        loaded_candidates = True
    except FileNotFoundError:
        pass
    try:
        _jd_index.load(_JD_INDEX_PATH)
        print(f"Loaded JD index ({_jd_index.size} docs) from disk")
        loaded_jds = True
    except FileNotFoundError:
        pass

    # 2. If either index is empty, fetch seed data from API and rebuild
    if loaded_candidates and loaded_jds:
        return

    api_url = os.environ.get("API_URL", "").rstrip("/")
    if not api_url:
        print("Warning: API_URL not set — skipping auto-rebuild of empty indexes")
        return

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.get(f"{api_url}/api/reseed/data")
            r.raise_for_status()
            data = r.json()

        if not loaded_candidates and data.get("candidates"):
            docs = [IndexDoc(id=d["id"], text=d["text"]) for d in data["candidates"]]
            _index.build(docs)
            os.makedirs("/data", exist_ok=True)
            _index.save(_CANDIDATE_INDEX_PATH)
            print(f"Auto-rebuilt candidate index with {_index.size} docs from API")

        if not loaded_jds and data.get("jds"):
            docs = [IndexDoc(id=d["id"], text=d["text"]) for d in data["jds"]]
            _jd_index.build(docs)
            os.makedirs("/data", exist_ok=True)
            _jd_index.save(_JD_INDEX_PATH)
            print(f"Auto-rebuilt JD index with {_jd_index.size} docs from API")

    except Exception as e:
        print(f"Warning: could not auto-rebuild indexes from API: {e}")


def get_judge() -> JudgeService:
    global _judge
    if _judge is None:
        _judge = JudgeService()
    return _judge


# ── Request/Response models ───────────────────────────────────────────────────

class IndexDocModel(BaseModel):
    id: str
    text: str


class BuildRequest(BaseModel):
    documents: list[IndexDocModel]


class QueryRequest(BaseModel):
    text: str
    top_k: int = 10


class ScoreRequest(BaseModel):
    jd_text: str
    candidate_text: str
    prompt_version: str | None = None

    @field_validator("jd_text", "candidate_text")
    @classmethod
    def must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v


# ── 404 handler ───────────────────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(_request, _exc):
    return JSONResponse(status_code=404, content={"error": "not found"})


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/index/build")
def index_build(req: BuildRequest):
    docs = [IndexDoc(id=d.id, text=d.text) for d in req.documents]
    _index.build(docs)
    try:
        import os; os.makedirs("/data", exist_ok=True)
        _index.save(_CANDIDATE_INDEX_PATH)
    except Exception as e:
        print(f"Warning: could not persist candidate index: {e}")
    return {"status": "ok", "count": len(docs)}


@app.post("/index/query")
def index_query(req: QueryRequest):
    results = _index.query(req.text, top_k=req.top_k)
    return {"results": [{"id": r.id, "score": r.score} for r in results]}


@app.post("/jd-index/build")
def jd_index_build(req: BuildRequest):
    docs = [IndexDoc(id=d.id, text=d.text) for d in req.documents]
    _jd_index.build(docs)
    try:
        import os; os.makedirs("/data", exist_ok=True)
        _jd_index.save(_JD_INDEX_PATH)
    except Exception as e:
        print(f"Warning: could not persist JD index: {e}")
    return {"status": "ok", "count": len(docs)}


@app.post("/jd-index/query")
def jd_index_query(req: QueryRequest):
    results = _jd_index.query(req.text, top_k=req.top_k)
    return {"results": [{"id": r.id, "score": r.score} for r in results]}


@app.post("/judge/score")
async def judge_score(req: ScoreRequest):
    match_score = await get_judge().score(req.jd_text, req.candidate_text, req.prompt_version)
    return match_score.model_dump()
