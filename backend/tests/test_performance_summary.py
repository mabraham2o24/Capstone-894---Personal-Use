
from music_analysis.performance_summary import (
    generate_performance_summary,
)


def test_summary_contains_metrics_and_errors():
    analysis = {
        "pitch_accuracy": {"accuracy_percent": 90.0},
        "rhythmic_accuracy": {"accuracy_percent": 85.0},
        "tempo_consistency": {"status": "consistent"},
        "note_sequence_accuracy": {"accuracy_percent": 95.0},
        "errors": {
            "incorrect_pitch": [{"note_index": 1}],
            "missing_notes": [{"note_index": 3}],
            "additional_notes": [],
        },
    }

    feedback = [
        {"measure": 1, "pitch_status": "incorrect"},
        {"measure": 1, "pitch_status": "missing"},
    ]

    areas = [
        {"measure": 1, "requires_practice": True}
    ]

    result = generate_performance_summary(
        analysis, feedback, areas
    )

    assert result["metrics"]["pitch_accuracy"] == {
        "accuracy_percent": 90.0
    }
    assert result["metrics"]["rhythmic_accuracy"] == {
        "accuracy_percent": 85.0
    }
    assert result["metrics"]["tempo_consistency"] == {
        "status": "consistent"
    }

    assert result["error_counts"]["incorrect_pitch"] == 1
    assert result["error_counts"]["missing_notes"] == 1
    assert result["error_counts"]["additional_notes"] == 0
    assert result["problem_area_count"] == 1
    assert len(result["note_feedback"]) == 2


def test_summary_handles_missing_metrics():
    analysis = {"errors": {}}

    result = generate_performance_summary(
        analysis, [], []
    )

    assert result["metrics"]["pitch_accuracy"] is None
    assert result["metrics"]["rhythmic_accuracy"] is None
    assert result["error_counts"]["missing_notes"] == 0
    assert result["problem_areas"] == []


def test_summary_requires_analysis():
    result = generate_performance_summary(
        None, [], []
    )

    assert result is None


def test_summary_with_no_errors():
    analysis = {
        "pitch_accuracy": {"accuracy_percent": 100.0},
        "rhythmic_accuracy": {"accuracy_percent": 100.0},
        "tempo_consistency": {"consistency_percent": 100.0},
        "errors": {
            "incorrect_pitch": [],
            "missing_notes": [],
            "additional_notes": [],
        },
    }

    result = generate_performance_summary(
        analysis, [], []
    )

    assert result["error_counts"] == {
        "incorrect_pitch": 0,
        "missing_notes": 0,
        "additional_notes": 0,
    }
    assert result["problem_area_count"] == 0
    assert result["problem_areas"] == []
    assert result["note_feedback"] == []
    assert result["metrics"]["pitch_accuracy"]["accuracy_percent"] == 100.0
