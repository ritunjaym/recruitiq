"""
pytest unit tests for IndexService.

Coverage:
  1. build() + query() returns top-K results with correct IDs
  2. query() on empty index returns empty list (no crash)
  3. top_k is clipped to corpus size (no FAISS crash when k > ntotal)
  4. save() + load() round-trip: querying a reloaded index gives same results
  5. build() called twice replaces the old index (no stale IDs)
"""

import os
import tempfile

import pytest

from sidecar.services.index_service import IndexDoc, IndexService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def service() -> IndexService:
    """Fresh IndexService for each test."""
    return IndexService()


DOCS = [
    IndexDoc(id="c1", text="Python engineer with 8 years fintech experience, expert in Django and FastAPI"),
    IndexDoc(id="c2", text="Java backend developer, Spring Boot, microservices, 5 years banking"),
    IndexDoc(id="c3", text="Data scientist specialising in NLP, transformers, and LLM fine-tuning, Python"),
    IndexDoc(id="c4", text="DevOps engineer, Kubernetes, Docker, Terraform, AWS"),
    IndexDoc(id="c5", text="Frontend engineer, React, TypeScript, Tailwind CSS, design systems"),
]


# ---------------------------------------------------------------------------
# Test 1 — happy path: build then query returns top-K IDs
# ---------------------------------------------------------------------------

def test_query_returns_top_k_results(service: IndexService) -> None:
    """Querying after build() returns exactly top_k results, each with a valid ID."""
    service.build(DOCS)
    results = service.query("Python developer fintech API", top_k=3)

    assert len(results) == 3, f"Expected 3 results, got {len(results)}"

    returned_ids = {r.id for r in results}
    valid_ids = {d.id for d in DOCS}
    assert returned_ids.issubset(valid_ids), f"Unknown IDs in results: {returned_ids - valid_ids}"

    # Scores should be in descending order (FAISS IndexFlatIP guarantees this)
    scores = [r.score for r in results]
    assert scores == sorted(scores, reverse=True), "Results not sorted by descending score"

    # The Python/fintech query should rank c1 highest
    assert results[0].id == "c1", f"Expected c1 to rank first, got {results[0].id}"


# ---------------------------------------------------------------------------
# Test 2 — edge case: query on empty index returns empty list
# ---------------------------------------------------------------------------

def test_query_on_empty_index_returns_empty(service: IndexService) -> None:
    """query() before build() and after build([]) both return [] without error."""
    # Before any build
    results = service.query("anything", top_k=5)
    assert results == [], "Expected [] before build, got non-empty list"

    # After build with empty corpus
    service.build([])
    results = service.query("anything", top_k=5)
    assert results == [], "Expected [] after build([]), got non-empty list"


# ---------------------------------------------------------------------------
# Test 3 — edge case: top_k larger than corpus size does not crash
# ---------------------------------------------------------------------------

def test_query_clips_top_k_to_corpus_size(service: IndexService) -> None:
    """Requesting more results than docs in the index clips silently."""
    small_corpus = DOCS[:2]   # only 2 docs
    service.build(small_corpus)

    results = service.query("Python", top_k=100)
    assert len(results) == 2, f"Expected 2 (corpus size), got {len(results)}"
    assert {r.id for r in results} == {"c1", "c2"}


# ---------------------------------------------------------------------------
# Test 4 — persistence: save() + load() round-trip
# ---------------------------------------------------------------------------

def test_save_and_load_round_trip(service: IndexService) -> None:
    """Index saved to disk and reloaded produces the same top result."""
    service.build(DOCS)
    query_text = "NLP transformers language model"
    original_results = service.query(query_text, top_k=3)
    original_top_id = original_results[0].id

    with tempfile.TemporaryDirectory() as tmp:
        index_path = os.path.join(tmp, "test.index")
        service.save(index_path)

        # Verify files exist on disk
        assert os.path.exists(index_path), "FAISS index file missing"
        assert os.path.exists(index_path + ".ids"), "ID map file missing"

        # Load into a brand-new service instance
        fresh = IndexService()
        fresh.load(index_path)

        assert fresh.size == len(DOCS), f"Loaded index size mismatch: {fresh.size}"

        reloaded_results = fresh.query(query_text, top_k=3)
        assert reloaded_results[0].id == original_top_id, (
            f"Top result changed after reload: was {original_top_id}, "
            f"got {reloaded_results[0].id}"
        )


# ---------------------------------------------------------------------------
# Test 5 — rebuild replaces old index
# ---------------------------------------------------------------------------

def test_rebuild_replaces_old_index(service: IndexService) -> None:
    """Calling build() a second time clears the previous index entirely."""
    # First build: all 5 docs
    service.build(DOCS)
    assert service.size == 5

    # Second build: only 2 docs (c3, c4)
    new_docs = [
        IndexDoc(id="c3", text="Data scientist specialising in NLP and transformers"),
        IndexDoc(id="c4", text="DevOps engineer with Kubernetes and Docker expertise"),
    ]
    service.build(new_docs)
    assert service.size == 2, f"Expected size 2 after rebuild, got {service.size}"

    results = service.query("Python fintech", top_k=10)
    returned_ids = {r.id for r in results}

    # Old IDs c1, c2, c5 must NOT appear
    stale_ids = returned_ids & {"c1", "c2", "c5"}
    assert not stale_ids, f"Stale IDs from old index found: {stale_ids}"

    # Only c3, c4 should be present
    assert returned_ids.issubset({"c3", "c4"}), f"Unexpected IDs: {returned_ids}"
