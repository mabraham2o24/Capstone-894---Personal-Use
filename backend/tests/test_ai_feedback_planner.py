
from music_analysis.ai_feedback_planner import (
    build_feedback_plan,
)


def test_feedback_plan_uses_actual_errors():
    summary = {
        "metrics": {
            "pitch_accuracy": {"accuracy_percent": 85},
            "rhythmic_accuracy": {"accuracy_percent": 72},
            "tempo_consistency": {
                "consistency_percent": 78
            },
        },
        "note_feedback": [
            {
                "measure": 2,
                "beat": 1,
                "timing_status": "late",
            },
            {
                "measure": 2,
                "beat": 3,
                "timing_status": "late",
            },
            {
                "measure": 3,
                "beat": 2,
                "pitch_status": "incorrect",
            },
            {
                "measure": 4,
                "beat": 1,
                "duration_status": "too_long",
            },
        ],
        "problem_areas": [
            {"measure": 2, "requires_practice": True}
        ],
    }

    result = build_feedback_plan(summary)

    assert result["weakest_metric"] == "rhythmic_accuracy"
    assert result["error_counts"]["late_note"] == 2
    assert result["error_counts"]["incorrect_pitch"] == 1
    assert result["error_counts"]["long_duration"] == 1
    assert result["problem_measures"] == [2]
    assert result["suggested_goal"]["target_percent"] == 77


def test_missing_metrics_handled():
    result = build_feedback_plan({
        "metrics": {},
        "note_feedback": [],
        "problem_areas": [],
    })

    assert result["weakest_metric"] is None
    assert result["detected_errors"] == []
    assert result["suggested_goal"] is None
