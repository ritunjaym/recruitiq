"""
JudgeService — pydantic-ai Agent with two tools for multi-step agentic scoring.

Tools:
  search_candidates(query)      — semantic FAISS search via IndexService
  get_candidate_detail(id)      — fetch structured candidate data by ID

The agent first calls tools to gather context, then produces a validated MatchScore.

Two prompt variants for A/B comparison:
  v1-standard: balanced evaluation, rewards partial skill matches
  v2-strict:   penalises missing must-have skills more aggressively
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any
from pydantic_ai import Agent, RunContext
from pydantic_ai.exceptions import UnexpectedModelBehavior

from models import MatchScore

# ── Prompt variants ───────────────────────────────────────────────────────────

_PROMPTS: dict[str, str] = {
    "v1-standard": """\
You are a technical recruiting judge with access to two tools:
- search_candidates: find relevant candidates via semantic search
- get_candidate_detail: fetch structured details for a specific candidate

Given a job description and a candidate profile, use your tools to gather
additional context if needed, then evaluate how well the candidate fits the role.

Return a JSON object matching this schema:
  score       — float 0.0–1.0 (overall fit)
  verdict     — one of: "Strong Match", "Potential Match", "Poor Match"
  strengths   — list of 2–4 specific strengths relative to the JD
  gaps        — list of 2–4 specific gaps or missing requirements
  reasoning   — 2–3 sentence narrative explaining the score
  confidence  — float 0.0–1.0

Be specific: name actual skills and requirements. Partial skill matches
should be rewarded — a candidate with adjacent skills can still be a
"Potential Match".
""",
    "v2-strict": """\
You are a strict technical recruiting judge with access to two tools:
- search_candidates: find relevant candidates via semantic search
- get_candidate_detail: fetch structured details for a specific candidate

Given a job description and a candidate profile, use your tools to gather
additional context if needed, then evaluate how well the candidate fits the role.

Return a JSON object matching this schema:
  score       — float 0.0–1.0 (overall fit)
  verdict     — one of: "Strong Match", "Potential Match", "Poor Match"
  strengths   — list of 2–4 specific strengths relative to the JD
  gaps        — list of 2–4 specific gaps or missing requirements
  reasoning   — 2–3 sentence narrative explaining the score
  confidence  — float 0.0–1.0

Be strict: missing must-have skills should significantly lower the score.
Only award "Strong Match" if the candidate meets at least 80% of stated
requirements. Adjacent or transferable skills do NOT substitute for
explicit requirements.
""",
}

_DEFAULT_VERSION = os.environ.get("PROMPT_VERSION", "v1-standard")
_MAX_RETRIES = 3


class MatchScoreWithVersion(MatchScore):
    prompt_version: str
    tool_calls: list[str] = []


# ── Dependency container passed to agent tools ────────────────────────────────

@dataclass
class JudgeDeps:
    index: Any = None                          # IndexService instance
    candidate_store: dict[str, dict] = field(default_factory=dict)

    def register_candidate(self, candidate_id: str, profile: str) -> None:
        self.candidate_store[candidate_id] = {"id": candidate_id, "profile": profile}


# ── JudgeService ─────────────────────────────────────────────────────────────

class JudgeService:
    """Evaluates a candidate against a JD using a pydantic-ai Agent with tools."""

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        self._model = model
        self._agents: dict[str, Agent] = {}
        self._tool_call_log: list[str] = []

    def set_index(self, index: "IndexService") -> None:
        self._index = index

    def _get_agent(self, version: str) -> Agent:
        if version not in self._agents:
            prompt = _PROMPTS.get(version, _PROMPTS["v1-standard"])
            agent: Agent = Agent(
                model=self._model,
                output_type=MatchScore,
                system_prompt=prompt,
                deps_type=JudgeDeps,
            )

            @agent.tool
            def search_candidates(ctx: RunContext[JudgeDeps], query: str) -> str:
                """Search for candidates semantically similar to the query."""
                idx = getattr(self, "_index", None)
                if idx is None:
                    return "Index not available."
                results = idx.query(query, top_k=3)
                self._tool_call_log.append(f"search_candidates({query!r})")
                if not results:
                    return "No candidates found."
                lines = [f"id={r.id} score={r.score:.3f}" for r in results]
                return "Top candidates: " + ", ".join(lines)

            @agent.tool
            def get_candidate_detail(ctx: RunContext[JudgeDeps], candidate_id: str) -> str:
                """Fetch structured profile for a candidate by ID."""
                self._tool_call_log.append(f"get_candidate_detail({candidate_id!r})")
                profile = ctx.deps.candidate_store.get(candidate_id)
                if profile:
                    return profile["profile"]
                return f"Candidate {candidate_id} not found in context."

            self._agents[version] = agent
        return self._agents[version]

    async def score(
        self,
        jd_text: str,
        candidate_profile: str,
        version: str | None = None,
        candidate_id: str | None = None,
    ) -> MatchScoreWithVersion:
        v = version or _DEFAULT_VERSION
        agent = self._get_agent(v)
        self._tool_call_log = []

        deps = JudgeDeps()
        if candidate_id:
            deps.register_candidate(candidate_id, candidate_profile)
        if hasattr(self, "_index"):
            deps.index = self._index

        user_message = (
            f"## Job Description\n\n{jd_text}\n\n"
            f"## Candidate Profile\n\n{candidate_profile}"
        )

        last_exc: Exception | None = None
        for _ in range(_MAX_RETRIES):
            try:
                result = await agent.run(user_message, deps=deps)
                base = result.output
                tool_calls = list(self._tool_call_log)
                if tool_calls:
                    print(f"Agent tool calls: {tool_calls}")
                return MatchScoreWithVersion(
                    score=base.score,
                    verdict=base.verdict,
                    strengths=base.strengths,
                    gaps=base.gaps,
                    reasoning=base.reasoning,
                    confidence=base.confidence,
                    prompt_version=v,
                    tool_calls=tool_calls,
                )
            except UnexpectedModelBehavior as exc:
                last_exc = exc

        raise RuntimeError(
            f"JudgeService failed after {_MAX_RETRIES} attempts. Last error: {last_exc}"
        )
