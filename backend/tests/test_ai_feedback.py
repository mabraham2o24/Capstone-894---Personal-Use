
"""Automated tests for AI feedback validation and goal generation."""

import pytest

import json

from unittest.mock import patch

import httpx

from music_analysis.ai_feedback import (
    AIPracticeFeedback,
    PracticeRecommendation,
    format_practice_goal,
    validate_recommendations,
    generate_ai_feedback,
    generate_fallback_feedback,
)


@pytest.fixture
def sample_summary():
    return {
        "metrics": {
            "pitch_accuracy": {"accuracy_percent": 85},
            "rhythmic_accuracy": {"accuracy_percent": 72},
        },
        "note_feedback": [
            {
                "measure": 2,
                "beat": 1,
                "pitch_status": "correct",
                "timing_status": "late",
            },
            {
                "measure": 3,
                "beat": 2,
                "pitch_status": "incorrect",
                "timing_status": "on_time",
            },
        ],
        "problem_areas": [],
    }


def test_fallback_uses_detected_errors(feedback_plan):
    result = generate_fallback_feedback(feedback_plan)

    assert len(result.recommendations) == 2

    # Higher-priority pitch error comes first.
    assert result.recommendations[0].measure == 3
    assert result.recommendations[0].error_type == "incorrect_pitch"

    # Timing error comes second.
    assert result.recommendations[1].measure == 2
    assert result.recommendations[1].error_type == "late_note"


def test_ollama_unavailable_uses_fallback(sample_summary):
    with patch(
        "music_analysis.ai_feedback.httpx.post",
        side_effect=httpx.ConnectError("Ollama unavailable"),
    ):
        result = generate_ai_feedback(sample_summary)

    assert len(result.recommendations) == 2
    assert result.recommendations[0].error_type == "incorrect_pitch"
    assert "correct pitches" in result.next_session_goal
    assert "accurate note timing" in result.next_session_goal
    assert "three consecutive repetitions" in result.next_session_goal
    assert "77%" not in result.next_session_goal


def test_malformed_json_uses_fallback(sample_summary):
    with patch(
        "music_analysis.ai_feedback.httpx.post"
    ) as mock_post:
        mock_post.return_value.json.return_value = {
            "response": "This is not valid JSON"
        }

        result = generate_ai_feedback(sample_summary)

    assert len(result.recommendations) == 2
    assert result.recommendations[0].measure == 3


def test_unsupported_ai_recommendation_uses_fallback(sample_summary):
    invalid_response = {
        "overall_assessment": "Practice needed.",
        "recommendations": [
            {
                "measure": 99,
                "error_type": "missing_note",
                "exercise": "Practice the missing notes carefully.",
            }
        ],
        "next_session_goal": "",
    }

    with patch(
        "music_analysis.ai_feedback.httpx.post"
    ) as mock_post:
        mock_post.return_value.json.return_value = {
            "response": json.dumps(invalid_response)
        }

        result = generate_ai_feedback(sample_summary)

    assert len(result.recommendations) == 2
    assert all(
        recommendation.measure != 99
        for recommendation in result.recommendations
    )

def test_ollama_extra_recommendations_are_filtered():
    """Keep the verified error and discard invented recommendations."""
    summary = {
        "metrics": {
            "pitch_accuracy": {"accuracy_percent": 100},
            "rhythmic_accuracy": {"accuracy_percent": 93.95},
        },
        "note_feedback": [
            {
                "measure": 4,
                "beat": 2,
                "pitch_status": "correct",
                "timing_status": "on_time",
                "duration_status": "too_short",
            }
        ],
        "problem_areas": [],
    }

    ollama_response = {
        "overall_assessment": (
            "Here are three exercises to improve your performance."
        ),
        "recommendations": [
            {
                "measure": 4,
                "error_type": "short_duration",
                "exercise": (
                    "Practice sustaining the affected note for its full "
                    "written duration while counting aloud with a metronome."
                ),
            },
            {
                "measure": 4,
                "error_type": "late_note",
                "exercise": (
                    "Practice entering on the correct beat with a metronome "
                    "and repeat the passage at a slower tempo."
                ),
            },
            {
                "measure": 4,
                "error_type": "missing_note",
                "exercise": (
                    "Practice the missing note with the surrounding notes "
                    "until the full sequence is accurate."
                ),
            },
        ],
        "next_session_goal": "",
    }

    with patch("music_analysis.ai_feedback.httpx.post") as mock_post:
        mock_post.return_value.json.return_value = {
            "response": json.dumps(ollama_response)
        }

        result = generate_ai_feedback(summary)

    assert len(result.recommendations) == 1

    recommendation = result.recommendations[0]

    assert recommendation.measure == 4
    assert recommendation.error_type == "short_duration"
    assert "Practice sustaining" in recommendation.exercise

    assert result.overall_assessment == (
        "Your performance analysis identified an area "
        "for improvement. Here is a targeted practice "
        "exercise to help you improve."
    )

    assert result.next_session_goal == (
        "In your next practice session, play measure 4 "
        "with correct note durations for three consecutive "
        "repetitions."
    )

    mock_post.assert_called_once()
    
def test_clean_performance_skips_ollama():
    clean_summary = {
        "metrics": {
            "pitch_accuracy": {"accuracy_percent": 100},
            "rhythmic_accuracy": {"accuracy_percent": 100},
        },
        "note_feedback": [],
        "problem_areas": [],
    }

    with patch(
        "music_analysis.ai_feedback.httpx.post"
    ) as mock_post:
        result = generate_ai_feedback(clean_summary)

    mock_post.assert_not_called()
    assert result.recommendations == []
    assert "No note-level errors" in result.overall_assessment



@pytest.fixture
def feedback_plan():
    return {
        "detected_errors": [
            {"measure": 2, "beat": 1, "error_type": "late_note"},
            {"measure": 3, "beat": 2, "error_type": "incorrect_pitch"},
        ],
        "selected_errors": [
            {"measure": 3, "beat": 2, "error_type": "incorrect_pitch"},
            {"measure": 2, "beat": 1, "error_type": "late_note"},
        ],
        "suggested_goal": {
            "metric": "rhythmic_accuracy",
            "current_percent": 72,
            "target_percent": 77,
        },
    }


def test_valid_recommendations_accepted(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Rhythm needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=2,
                error_type="late_note",
                exercise=(
                    "In measure 2, practice entering on the correct beat "
                    "with a metronome. Repeat slowly, then gradually increase "
                    "your speed once your note entries are consistently on time."
                ),
            )
        ],
        next_session_goal="",
    )

    validate_recommendations(feedback, feedback_plan)


def test_invalid_measure_rejected(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Rhythm needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=9,
                error_type="late_note",
                exercise=(
                    "In measure 9, practice entering on the correct beat "
                    "with a metronome. Repeat slowly and gradually increase "
                    "your speed after several accurate repetitions."
                ),
            )
        ],
        next_session_goal="",
    )

    with pytest.raises(ValueError, match="Unsupported recommendation"):
        validate_recommendations(feedback, feedback_plan)


def test_invalid_error_type_rejected(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Rhythm needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=2,
                error_type="missing_note",
                exercise=(
                    "In measure 2, practice the written note sequence slowly "
                    "while counting each expected note. Repeat until you can "
                    "include every note consistently without omissions."
                ),
            )
        ],
        next_session_goal="",
    )

    with pytest.raises(ValueError, match="Unsupported recommendation"):
        validate_recommendations(feedback, feedback_plan)


def test_more_than_three_recommendations_rejected(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Practice needed.",
        recommendations=[
            PracticeRecommendation(
                measure=2,
                error_type="late_note",
                exercise="Practice rhythmic note attacks.",
            )
            for _ in range(4)
        ],
        next_session_goal="",
    )

    with pytest.raises(ValueError, match="Too many"):
        validate_recommendations(feedback, feedback_plan)


def test_deterministic_goal(feedback_plan):
    goal = format_practice_goal(feedback_plan)

    assert goal == (
        "In your next practice session, play measures 2 and 3 "
        "with correct pitches, and accurate note timing "
        "for three consecutive repetitions."
    )


def test_perfect_accuracy_goal():
    plan = {
        "suggested_goal": {
            "metric": "pitch_accuracy",
            "current_percent": 100,
            "target_percent": 100,
        }
    }

    goal = format_practice_goal(plan)

    assert goal == (
        "Maintain pitch accuracy at 100% "
        "in the next practice session."
    )


def test_missing_metrics_goal():
    goal = format_practice_goal({"suggested_goal": None})

    assert "Continue practicing" in goal

def test_goal_prioritizes_pitch_and_note_sequence_errors():
    plan = {
        "selected_errors": [
            {"measure": 1, "error_type": "incorrect_pitch"},
            {"measure": 2, "error_type": "missing_note"},
            {"measure": 3, "error_type": "additional_note"},
        ],
        "suggested_goal": {
            "metric": "tempo_consistency",
            "current_percent": 71.79,
            "target_percent": 76.79,
        },
    }

    goal = format_practice_goal(plan)

    assert "measures 1, 2, and 3" in goal
    assert "correct pitches" in goal
    assert "all expected notes" in goal
    assert "no additional notes" in goal
    assert "three consecutive repetitions" in goal
    assert "tempo consistency" not in goal

def test_strategy_identifier_rejected(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Pitch accuracy needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=3,
                error_type="incorrect_pitch",
                exercise="reference_pitch_comparison",
            )
        ],
        next_session_goal="",
    )

    with pytest.raises(ValueError, match="strategy identifier"):
        validate_recommendations(feedback, feedback_plan)

def test_rejects_internal_error_labels(feedback_plan):
    feedback = AIPracticeFeedback(
        overall_assessment="Pitch accuracy needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=3,
                error_type="incorrect_pitch",
                exercise=(
                    "In measure 3, compare the affected note with "
                    "a reliable pitch reference and repeat the passage. "
                    "This exercise targets the specific error_type "
                    "'incorrect_pitch' and improves the player's ability."
                ),
            )
        ],
        next_session_goal="",
    )

    with pytest.raises(ValueError, match="internal or third-person"):
        validate_recommendations(feedback, feedback_plan)

def test_goal_uses_singular_measure():
    plan = {
        "selected_errors": [
            {"measure": 4, "error_type": "short_duration"}
        ],
        "suggested_goal": None,
    }

    goal = format_practice_goal(plan)

    assert goal == (
        "In your next practice session, play measure 4 "
        "with correct note durations for three consecutive "
        "repetitions."
    )