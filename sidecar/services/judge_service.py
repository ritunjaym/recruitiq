"""
JudgeService — calls Claude via Pydantic AI to produce a validated MatchScore.

Retries up to 3 times on UnexpectedModelBehavior (malformed / schema-invalid
response).  Raises RuntimeError after all attempts are exhausted.
"""
from __future__ import annotations

from pydantic_ai import Agent
from pydantic_ai.exceptions import UnexpectedModelBehavior

from models import MatchScore

_SYSTEM_PROMPT = """\
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
"""

_MAX_RETRIES = 3


class JudgeService:
    """Evaluates a candidate against a job description and returns a MatchScore."""

    def __init__(self, model: str = "claude-sonnet-4-6") -> None:
        self._agent: Agent[None, MatchScore] = Agent(
            model=model,
            output_type=MatchScore,
            system_prompt=_SYSTEM_PROMPT,
        )

    async def score(self, jd_text: str, candidate_profile: str) -> MatchScore:
        """
        Run the judge and return a validated MatchScore.

        Args:
            jd_text: Full text of the job description.
            candidate_profile: Full text of the candidate's profile / resume.

        Returns:
            A validated MatchScore instance.

        Raises:
            RuntimeError: If all 3 attempts fail due to schema validation errors.
        """
        user_message = (
            f"## Job Description\n\n{jd_text}\n\n"
            f"## Candidate Profile\n\n{candidate_profile}"
        )

        last_exc: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                result = await self._agent.run(user_message)
                return result.output
            except UnexpectedModelBehavior as exc:
                last_exc = exc
                # Continue to next attempt

        raise RuntimeError(
            f"JudgeService failed after {_MAX_RETRIES} attempts. "
            f"Last error: {last_exc}"
        )
