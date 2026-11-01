
import pytest

from music_analysis.performance_analysis import (
    analyze_performance,
    calculate_tempo_consistency,
)


def make_events(offsets, onsets, inferred_indices=None):
    inferred_indices = set(inferred_indices or [])

    expected = [
        {
            "pitch": "C4",
            "offset": offset,
            "duration": 1.0,
            "measure": 1,
            "beat": offset + 1,
        }
        for offset in offsets
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": onset,
            "measured_onset": onset,
            "duration": 0.5,
            "measured_duration": 0.5,
            "inferred": index in inferred_indices,
        }
        for index, onset in enumerate(onsets)
    ]

    alignment = [
        {"operation": "match"}
        for _ in expected
    ]

    return expected, performed, alignment


def test_steady_tempo():
    expected, performed, alignment = make_events(
        [0, 1, 2, 3],
        [0, 0.5, 1.0, 1.5],
    )

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "calculated"
    assert result["consistency_percent"] == 100.0
    assert result["variation_percent"] == 0.0
    assert result["intervals_evaluated"] == 3


def test_variable_tempo():
    expected, performed, alignment = make_events(
        [0, 1, 2, 3],
        [0, 0.5, 1.2, 1.6],
    )

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "calculated"
    assert result["consistency_percent"] < 100.0
    assert result["variation_percent"] > 0.0
    assert result["intervals_evaluated"] == 3


def test_different_note_lengths_with_steady_tempo():
    expected, performed, alignment = make_events(
        [0, 0.5, 1.5, 3.5],
        [0, 0.25, 0.75, 1.75],
    )

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "calculated"
    assert result["consistency_percent"] == 100.0
    assert result["variation_percent"] == 0.0


def test_insufficient_timing_data():
    expected, performed, alignment = make_events(
        [0, 1],
        [0, 0.5],
    )

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "insufficient_timing_data"
    assert result["consistency_percent"] is None
    assert result["variation_percent"] is None
    assert result["intervals_evaluated"] == 1


def test_inferred_events_are_excluded():
    expected, performed, alignment = make_events(
        [0, 1, 2, 3],
        [0, 0.5, 1.2, 1.5],
        inferred_indices=[2],
    )

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "calculated"
    assert result["consistency_percent"] == 100.0
    assert result["intervals_evaluated"] == 2


def test_tempo_consistency_in_performance_analysis():
    expected, performed, _ = make_events(
        [0, 1, 2, 3],
        [0, 0.5, 1.0, 1.5],
    )

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=0.5,
    )

    assert "tempo_consistency" in result
    assert result["tempo_consistency"]["status"] == "calculated"
    assert result["tempo_consistency"]["consistency_percent"] == 100.0


def test_missing_and_additional_notes_excluded():
    expected = [
        {"pitch": "C4", "offset": 0.0, "duration": 1.0},
        {"pitch": "D4", "offset": 1.0, "duration": 1.0},
        {"pitch": "E4", "offset": 2.0, "duration": 1.0},
        {"pitch": "F4", "offset": 3.0, "duration": 1.0},
        {"pitch": "G4", "offset": 4.0, "duration": 1.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0, "measured_onset": 0.0},
        {"pitch": "D4", "onset": 0.5, "measured_onset": 0.5},
        {"pitch": "F4", "onset": 1.5, "measured_onset": 1.5},
        {"pitch": "G4", "onset": 2.0, "measured_onset": 2.0},
        {"pitch": "A4", "onset": 2.25, "measured_onset": 2.25},
    ]

    alignment = [
        {"operation": "match"},
        {"operation": "match"},
        {"operation": "deletion"},
        {"operation": "match"},
        {"operation": "match"},
        {"operation": "insertion"},
    ]

    result = calculate_tempo_consistency(
        expected, performed, alignment
    )

    assert result["status"] == "calculated"
    assert result["intervals_evaluated"] == 3
    assert result["consistency_percent"] == 100.0
