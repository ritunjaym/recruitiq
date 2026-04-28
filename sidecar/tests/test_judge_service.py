"""
TDD tests for JudgeService — written one at a time, red → green.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from sidecar.models import MatchScore


# ──────────────────────────────────────────────────────────────
# Shared fixture: a valid MatchScore instance
# ──────────────────────────────────────────────────────────────
@pytest.fixture
def valid_match_score():
    return MatchScore(
        score=0.85,
        verdict="Strong Match",
        strengths=["Python expertise", "ML background"],
        gaps=["No Kubernetes experience", "Lacks team lead experience"],
        reasoning=(
            "The candidate has strong Python and ML skills that align well "
            "with the JD requirements. However, there are some gaps in "
            "infrastructure experience that may need to be addressed."
        ),
        confidence=0.9,
    )


def make_mock_agent_result(match_score: MatchScore):
    """Return a MagicMock that looks like a pydantic-ai RunResult."""
    result = MagicMock()
    result.data = match_score
    return result


# ──────────────────────────────────────────────────────────────
# Test 1: Tracer bullet — score() returns a MatchScore with all
#         required fields present and correct types
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_score_returns_match_score_with_all_fields(valid_match_score):
    """score() returns a MatchScore with all required fields."""
    from sidecar.services.judge_service import JudgeService

    mock_result = make_mock_agent_result(valid_match_score)

    with patch("sidecar.services.judge_service.Agent") as MockAgent:
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(return_value=mock_result)
        MockAgent.return_value = mock_agent_instance

        service = JudgeService()
        result = await service.score("JD text here", "Candidate profile here")

    assert isinstance(result, MatchScore)
    assert hasattr(result, "score")
    assert hasattr(result, "verdict")
    assert hasattr(result, "strengths")
    assert hasattr(result, "gaps")
    assert hasattr(result, "reasoning")
    assert hasattr(result, "confidence")
    assert isinstance(result.score, float)
    assert isinstance(result.confidence, float)
    assert isinstance(result.reasoning, str)
    assert isinstance(result.strengths, list)
    assert isinstance(result.gaps, list)


# ──────────────────────────────────────────────────────────────
# Test 2: verdict is one of the three valid literals
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_score_verdict_is_valid_literal(valid_match_score):
    """score() returns verdict as one of the three valid literals."""
    from sidecar.services.judge_service import JudgeService

    mock_result = make_mock_agent_result(valid_match_score)

    with patch("sidecar.services.judge_service.Agent") as MockAgent:
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(return_value=mock_result)
        MockAgent.return_value = mock_agent_instance

        service = JudgeService()
        result = await service.score("JD text", "Candidate text")

    assert result.verdict in {"Strong Match", "Potential Match", "Poor Match"}


# ──────────────────────────────────────────────────────────────
# Test 3: strengths and gaps are non-empty lists
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_score_strengths_and_gaps_non_empty(valid_match_score):
    """score() returns non-empty strengths and gaps lists."""
    from sidecar.services.judge_service import JudgeService

    mock_result = make_mock_agent_result(valid_match_score)

    with patch("sidecar.services.judge_service.Agent") as MockAgent:
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(return_value=mock_result)
        MockAgent.return_value = mock_agent_instance

        service = JudgeService()
        result = await service.score("JD text", "Candidate text")

    assert len(result.strengths) > 0
    assert len(result.gaps) > 0


# ──────────────────────────────────────────────────────────────
# Test 4: retry logic — malformed JSON on first call, valid on second
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_score_retries_on_validation_failure(valid_match_score):
    """score() retries when first call fails, succeeds on second."""
    from pydantic_ai.exceptions import UnexpectedModelBehavior
    from sidecar.services.judge_service import JudgeService

    mock_result = make_mock_agent_result(valid_match_score)

    with patch("sidecar.services.judge_service.Agent") as MockAgent:
        mock_agent_instance = MagicMock()
        # First call raises, second call succeeds
        mock_agent_instance.run = AsyncMock(
            side_effect=[
                UnexpectedModelBehavior("malformed response", body="bad json"),
                mock_result,
            ]
        )
        MockAgent.return_value = mock_agent_instance

        service = JudgeService()
        result = await service.score("JD text", "Candidate text")

    assert isinstance(result, MatchScore)
    assert mock_agent_instance.run.call_count == 2


# ──────────────────────────────────────────────────────────────
# Test 5: raises RuntimeError after 3 consecutive failures
# ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_score_raises_runtime_error_after_three_failures():
    """score() raises RuntimeError when all 3 attempts fail."""
    from pydantic_ai.exceptions import UnexpectedModelBehavior
    from sidecar.services.judge_service import JudgeService

    with patch("sidecar.services.judge_service.Agent") as MockAgent:
        mock_agent_instance = MagicMock()
        mock_agent_instance.run = AsyncMock(
            side_effect=UnexpectedModelBehavior("always bad", body="bad json")
        )
        MockAgent.return_value = mock_agent_instance

        service = JudgeService()

        with pytest.raises(RuntimeError, match="3"):
            await service.score("JD text", "Candidate text")

    assert mock_agent_instance.run.call_count == 3
