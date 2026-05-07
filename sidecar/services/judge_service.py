"""
JudgeService — calls Claude via Pydantic AI to produce a validated MatchScore.

Two prompt variants for A/B comparison:
  v1-standard: balanced evaluation, rewards partial skill matches
  v2-strict:   penalises missing must-have skills more aggressively

Retries up to 3 times on UnexpectedModelBehavior (malformed / schema-invalid
response).  Raises RuntimeError after all attempts are exhausted.
"""
from __future__ import annotations

import os
from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.exceptions import UnexpectedModelBehavior

from models import MatchScore

# ── Prompt variants ───────────────────────────────────────────────────────────

_PROMPTS: dict[str, str] = {
    "v1-standard": """\
You are a technical recruiting judge. Given a job description and a candidate
profile, you evaluate how well the candidate fits the role.

Return a JSON object that strictly matches this schema:
  score       — float 0.0–1.0 (overall fit)
  verdict     — one of: "Strong Match", "Potential Match", "Poor Match"
  strengths   — list of 2–4 specific strengths relative to the JD
  gaps        — list of 2–4 specific gaps or missing requirements
  reasoning   — 2–3 sentence narrative explaining the score
  confidence  — float 0.0–1.0 (how confident you are in this evaluation)

Be specific: name the actual skills and requirements, not generic statements.
Partial skill matches should be rewarded — a candidate with adjacent skills
can still be a "Potential Match".
""",
    "v2-strict": """\
You are a strict technical recruiting judge. Given a job description and a
candidate profile, you evaluate how well the candidate fits the role.

Return a JSON object that strictly matches this schema:
  score       — float 0.0–1.0 (overall fit)
  verdict     — one of: "Strong Match", "Potential Match", "Poor Match"
  strengths   — list of 2–4 specific strengths relative to the JD
  gaps        — list of 2–4 specific gaps or missing requirements
  reasoning   — 2–3 sentence narrative explaining the score
  confidence  — float 0.0–1.0 (how confident you are in this evaluation)

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


class JudgeService:
    """Evaluates a candidate against a job description and returns a MatchScore."""

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        self._model = model
        self._agents: dict[str, Agent] = {}

    def _get_agent(self, version: str) -> Agent:
        if version not in self._agents:
            prompt = _PROMPTS.get(version, _PROMPTS["v1-standard"])
            self._agents[version] = Agent(
                model=self._model,
                output_type=MatchScore,
                system_prompt=prompt,
            )
        return self._agents[version]

    async def score(
        self,
        jd_text: str,
        candidate_profile: str,
        version: str | None = None,
    ) -> MatchScoreWithVersion:
        v = version or _DEFAULT_VERSION
        agent = self._get_agent(v)
        user_message = (
            f"## Job Description\n\n{jd_text}\n\n"
            f"## Candidate Profile\n\n{candidate_profile}"
        )

        last_exc: Exception | None = None
        for _ in range(_MAX_RETRIES):
            try:
                result = await agent.run(user_message)
                base = result.output
                return MatchScoreWithVersion(
                    score=base.score,
                    verdict=base.verdict,
                    strengths=base.strengths,
                    gaps=base.gaps,
                    reasoning=base.reasoning,
                    confidence=base.confidence,
                    prompt_version=v,
                )
            except UnexpectedModelBehavior as exc:
                last_exc = exc

        raise RuntimeError(
            f"JudgeService failed after {_MAX_RETRIES} attempts. Last error: {last_exc}"
        )
