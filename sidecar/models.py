from pydantic import BaseModel
from typing import Literal


class MatchScore(BaseModel):
    score: float          # 0.0–1.0
    verdict: Literal["Strong Match", "Potential Match", "Poor Match"]
    strengths: list[str]  # 2–4 items
    gaps: list[str]       # 2–4 items
    reasoning: str        # 2–3 sentence narrative
    confidence: float     # 0.0–1.0
