import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from sidecar.models import MatchScore

DOCS = [
    {"id": "c1", "text": "Python developer Django REST API experience"},
    {"id": "c2", "text": "React TypeScript frontend engineer Redux"},
    {"id": "c3", "text": "DevOps Kubernetes Docker AWS CI/CD"},
]


@pytest.fixture
def client():
    from sidecar.main import app
    return TestClient(app)


@pytest.fixture(autouse=True)
def pre_built_index(client):
    client.post("/index/build", json={"documents": DOCS})


# ── Behavior 1: health check ──────────────────────────────────────────────────

def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


# ── Behavior 2: build index ───────────────────────────────────────────────────

def test_index_build(client):
    res = client.post("/index/build", json={"documents": DOCS})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["count"] == 3


# ── Behavior 3: query index ───────────────────────────────────────────────────

def test_index_query_returns_sorted_results(client):
    res = client.post("/index/query", json={"text": "Python Django developer", "top_k": 2})
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 2
    assert all("id" in r and "score" in r for r in results)
    assert results[0]["id"] == "c1"
    assert results[0]["score"] >= results[1]["score"]


# ── Behavior 4: judge score ───────────────────────────────────────────────────

def test_judge_score_returns_match_score(client):
    mock_score = MatchScore(
        score=0.85,
        verdict="Strong Match",
        strengths=["Python expertise", "REST API experience"],
        gaps=["Missing Kubernetes"],
        reasoning="Strong backend fit overall.",
        confidence=0.9,
    )
    with patch("sidecar.main.get_judge") as mock_get_judge:
        mock_judge = MagicMock()
        mock_judge.score = AsyncMock(return_value=mock_score)
        mock_get_judge.return_value = mock_judge
        res = client.post("/judge/score", json={
            "jd_text": "Senior Python developer needed",
            "candidate_text": "Python Django engineer 5 years",
        })
    assert res.status_code == 200
    body = res.json()
    assert body["score"] == 0.85
    assert body["verdict"] == "Strong Match"
    assert len(body["strengths"]) >= 1
    assert len(body["gaps"]) >= 1
    assert "reasoning" in body
    assert "confidence" in body
