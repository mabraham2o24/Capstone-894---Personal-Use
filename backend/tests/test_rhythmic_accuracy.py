
import pytest

from music_analysis.performance_analysis import (
    calculate_rhythmic_accuracy,
    analyze_performance
)


def make_alignment(operations):
    return [{"operation": operation} for operation in operations]


def test_perfect_rhythm():
    timing = {
        "results": [
            {"expected_interval": 0.0, "performed_interval": 0.0},
            {"expected_interval": 0.5, "performed_interval": 0.5},
            {"expected_interval": 0.5, "performed_interval": 0.5},
        ]
    }

    expected = [
        {"duration": 1.0},
        {"duration": 1.0},
        {"duration": 1.0},
    ]

    performed = [
        {"measured_duration": 0.5},
        {"measured_duration": 0.5},
        {"measured_duration": 0.5},
    ]

    result = calculate_rhythmic_accuracy(
        timing, expected, performed,
        make_alignment(["match"] * 3),
        seconds_per_beat=0.5,
    )

    assert result["accuracy_percent"] == 100.0
    assert result["onset_accuracy_percent"] == 100.0
    assert result["duration_accuracy_percent"] == 100.0


def test_rhythmic_errors_reduce_accuracy():
    timing = {
        "results": [
            {"expected_interval": 0.0, "performed_interval": 0.0},
            {"expected_interval": 0.5, "performed_interval": 0.75},
        ]
    }

    expected = [{"duration": 1.0}, {"duration": 1.0}]
    performed = [
        {"measured_duration": 0.5},
        {"measured_duration": 0.75},
    ]

    result = calculate_rhythmic_accuracy(
        timing, expected, performed,
        make_alignment(["match", "match"]),
        seconds_per_beat=0.5,
    )

    assert result["onset_accuracy_percent"] == 50.0
    assert result["duration_accuracy_percent"] == 75.0
    assert result["accuracy_percent"] == pytest.approx(66.67)


def test_missing_duration_is_excluded():
    timing = {
        "results": [
            {"expected_interval": 0.0, "performed_interval": 0.0},
            {"expected_interval": 0.5, "performed_interval": 0.5},
        ]
    }

    result = calculate_rhythmic_accuracy(
        timing,
        [{"duration": 1.0}, {"duration": 1.0}],
        [{"measured_duration": None}, {"inferred": True}],
        make_alignment(["match", "match"]),
        seconds_per_beat=0.5,
    )

    assert result["accuracy_percent"] == 100.0
    assert result["duration_accuracy_percent"] is None
    assert result["durations_evaluated"] == 0


def test_insufficient_data():
    result = calculate_rhythmic_accuracy(
        None, [], [], [], seconds_per_beat=None
    )

    assert result["accuracy_percent"] is None
    assert result["status"] == "insufficient_timing_data"



def test_rhythmic_accuracy_in_performance_analysis():
    expected = [
        {"pitch": "C4", "offset": 0.0, "duration": 1.0},
        {"pitch": "D4", "offset": 1.0, "duration": 1.0},
        {"pitch": "E4", "offset": 2.0, "duration": 1.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0, "duration": 0.5,
         "measured_duration": 0.5},
        {"pitch": "D4", "onset": 0.5, "duration": 0.5,
         "measured_duration": 0.5},
        {"pitch": "E4", "onset": 1.0, "duration": 0.5,
         "measured_duration": 0.5},
    ]

    result = analyze_performance(
        expected_events=expected,
        performed_events=performed,
        seconds_per_beat=0.5,
    )

    assert "rhythmic_accuracy" in result
    assert result["rhythmic_accuracy"]["accuracy_percent"] == 100.0
    assert result["rhythmic_accuracy"]["onset_intervals_evaluated"] == 2
    assert result["rhythmic_accuracy"]["durations_evaluated"] == 3