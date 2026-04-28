from fastapi import FastAPI
from pydantic import BaseModel

from sidecar.services.index_service import IndexService, IndexDoc
from sidecar.services.judge_service import JudgeService

app = FastAPI(title="RecruitIQ Sidecar")

_index = IndexService()
_judge: JudgeService | None = None


def get_judge() -> JudgeService:
    global _judge
    if _judge is None:
        _judge = JudgeService()
    return _judge


# ── Request/Response models ───────────────────────────────────────────────────

class BuildRequest(BaseModel):
    documents: list[dict]  # [{id: str, text: str}]


class QueryRequest(BaseModel):
    text: str
    top_k: int = 10


class ScoreRequest(BaseModel):
    jd_text: str
    candidate_text: str


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/index/build")
def index_build(req: BuildRequest):
    docs = [IndexDoc(id=d["id"], text=d["text"]) for d in req.documents]
    _index.build(docs)
    return {"status": "ok", "count": len(docs)}


@app.post("/index/query")
def index_query(req: QueryRequest):
    results = _index.query(req.text, top_k=req.top_k)
    return {"results": [{"id": r.id, "score": r.score} for r in results]}


@app.post("/judge/score")
async def judge_score(req: ScoreRequest):
    match_score = await get_judge().score(req.jd_text, req.candidate_text)
    return match_score.model_dump()
