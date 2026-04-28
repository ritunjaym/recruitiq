"""
IndexService — owns the FAISS index lifecycle.

Interface:
    build(docs: list[IndexDoc]) -> None
    query(text: str, top_k: int) -> list[QueryResult]
    save(path: str) -> None
    load(path: str) -> None

Embedding model: sentence-transformers/all-MiniLM-L6-v2 (384-dim, fast, good quality)
Index type: IndexFlatIP (inner product on L2-normalised vectors == cosine similarity)
Persistence: serialise index to disk with faiss.write_index / faiss.read_index
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


@dataclass
class IndexDoc:
    """A document to be indexed."""
    id: str          # opaque candidate/JD ID (e.g. "cand-42")
    text: str        # raw text to embed (bio, skills, past_roles concatenated)


@dataclass
class QueryResult:
    """A single result from a FAISS query."""
    id: str
    score: float     # cosine similarity in [0, 1]


class IndexService:
    """
    Owns the FAISS vector index.  One instance per process.

    Usage:
        svc = IndexService()
        svc.build([IndexDoc(id="c1", text="..."), ...])
        results = svc.query("Python engineer with fintech experience", top_k=5)
        svc.save("/data/faiss.index")

    On restart:
        svc = IndexService()
        svc.load("/data/faiss.index")
        results = svc.query(...)
    """

    MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM = 384

    def __init__(self, model_name: Optional[str] = None) -> None:
        self._model_name = model_name or self.MODEL_NAME
        self._model: Optional[SentenceTransformer] = None  # lazy-loaded
        self._index: Optional[faiss.IndexFlatIP] = None
        self._id_map: list[str] = []   # position i → doc ID

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def build(self, docs: list[IndexDoc]) -> None:
        """Embed all docs and build a fresh FAISS index.

        Calling build() again replaces any existing index.
        """
        if not docs:
            # Empty corpus: keep a valid but empty index so query() returns [].
            self._index = faiss.IndexFlatIP(self.EMBEDDING_DIM)
            self._id_map = []
            return

        model = self._get_model()
        texts = [doc.text for doc in docs]
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        embeddings = np.array(embeddings, dtype=np.float32)

        index = faiss.IndexFlatIP(self.EMBEDDING_DIM)
        index.add(embeddings)

        self._index = index
        self._id_map = [doc.id for doc in docs]

    def query(self, text: str, top_k: int = 10) -> list[QueryResult]:
        """Return the top_k most similar documents for *text*.

        Returns an empty list when the index is empty or not yet built.
        Clips top_k to the number of indexed documents.
        """
        if self._index is None or self._index.ntotal == 0:
            return []

        k = min(top_k, self._index.ntotal)
        model = self._get_model()
        vec = model.encode([text], normalize_embeddings=True, show_progress_bar=False)
        vec = np.array(vec, dtype=np.float32)

        scores, indices = self._index.search(vec, k)

        results: list[QueryResult] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:   # FAISS sentinel for "not found"
                continue
            results.append(QueryResult(id=self._id_map[idx], score=float(score)))
        return results

    def save(self, path: str) -> None:
        """Persist the FAISS index and ID map to *path* and *path*.ids."""
        if self._index is None:
            raise RuntimeError("No index to save — call build() first.")
        faiss.write_index(self._index, path)
        ids_path = path + ".ids"
        with open(ids_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(self._id_map))

    def load(self, path: str) -> None:
        """Load a previously saved index from *path* and *path*.ids."""
        if not os.path.exists(path):
            raise FileNotFoundError(f"FAISS index not found: {path}")
        ids_path = path + ".ids"
        if not os.path.exists(ids_path):
            raise FileNotFoundError(f"ID map not found: {ids_path}")

        self._index = faiss.read_index(path)
        with open(ids_path, "r", encoding="utf-8") as fh:
            content = fh.read()
        self._id_map = content.splitlines() if content.strip() else []

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def size(self) -> int:
        """Number of documents in the index."""
        return self._index.ntotal if self._index is not None else 0

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(self._model_name)
        return self._model
