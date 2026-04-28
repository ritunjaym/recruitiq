from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from sidecar.services.index_service import IndexService, IndexDoc
from sidecar.services.judge_service import JudgeService

app = FastAPI(title="RecruitIQ Sidecar")

_index = IndexService()      # candidate index (JD → candidates)
_jd_index = IndexService()  # JD index (candidate → JDs)
_judge: JudgeService | None = None


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
    return {"status": "ok", "count": len(docs)}


@app.post("/index/query")
def index_query(req: QueryRequest):
    results = _index.query(req.text, top_k=req.top_k)
    return {"results": [{"id": r.id, "score": r.score} for r in results]}


@app.post("/jd-index/build")
def jd_index_build(req: BuildRequest):
    docs = [IndexDoc(id=d.id, text=d.text) for d in req.documents]
    _jd_index.build(docs)
    return {"status": "ok", "count": len(docs)}


@app.post("/jd-index/query")
def jd_index_query(req: QueryRequest):
    results = _jd_index.query(req.text, top_k=req.top_k)
    return {"results": [{"id": r.id, "score": r.score} for r in results]}


@app.post("/judge/score")
async def judge_score(req: ScoreRequest):
    match_score = await get_judge().score(req.jd_text, req.candidate_text)
    return match_score.model_dump()
