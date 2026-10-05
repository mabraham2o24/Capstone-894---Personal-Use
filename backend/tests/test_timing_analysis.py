from unittest import result

from music_analysis.note_events import (
    detect_note_events,
    detect_silence_regions,
)
from music_analysis.performance_segmentation import (
    segment_performance,
)
from music_analysis.score_parser import (
    extract_note_details,
)
from music_analysis.timing_analysis import (
    analyze_missing_note_timing, 
    compare_timing,
    classify_note_length,
    analyze_note_duration
)


def test_notes_within_tolerance_are_on_time():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 1.0},
        {"pitch": "E4", "offset": 2.0},
        {"pitch": "F4", "offset": 3.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
        {"pitch": "D4", "onset": 1.05},
        {"pitch": "E4", "onset": 1.95},
        {"pitch": "F4", "onset": 3.0},
    ]

    result = compare_timing(expected, performed)

    assert result["seconds_per_beat"] == 1.0
    assert result["tolerance"] == 0.2

    assert all(
        note["timing"] == "on_time"
        for note in result["results"]
    )


def test_early_note_is_detected():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 1.0, "measure": 3, "beat": 2.0,},
        {"pitch": "E4", "offset": 2.0},
        {"pitch": "F4", "offset": 3.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
        {"pitch": "D4", "onset": 0.7},
        {"pitch": "E4", "onset": 2.0},
        {"pitch": "F4", "onset": 3.0},
    ]

    result = compare_timing(expected, performed)

    assert result["results"][1]["timing"] == "early"
    assert result["results"][1]["timing_difference"] == -0.3
    assert result["results"][1]["measure"] == 3
    assert result["results"][1]["beat"] == 2.0


def test_late_note_is_detected():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 1.0},
        {"pitch": "E4", "offset": 2.0},
        {"pitch": "F4", "offset": 3.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
        {"pitch": "D4", "onset": 1.0},
        {"pitch": "E4", "onset": 2.3},
        {"pitch": "F4", "onset": 3.0},
    ]

    result = compare_timing(expected, performed)

    assert result["results"][2]["timing"] == "late"
    assert result["results"][2]["timing_difference"] == 0.3

def test_timing_uses_musicxml_offsets():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 0.5},
        {"pitch": "E4", "offset": 1.0},
        {"pitch": "F4", "offset": 1.5},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
        {"pitch": "D4", "onset": 0.5},
        {"pitch": "E4", "onset": 1.0},
        {"pitch": "F4", "onset": 1.5},
    ]

    result = compare_timing(expected, performed)

    assert result["seconds_per_beat"] == 1.0

    assert [
        note["expected_interval"]
        for note in result["results"]
    ] == [0.0, 0.5, 0.5, 0.5]

    assert [
        note["performed_interval"]
        for note in result["results"]
    ] == [0.0, 0.5, 0.5, 0.5]

    assert [
        note["timing"]
        for note in result["results"]
    ] == [
        "on_time",
        "on_time",
        "on_time",
        "on_time",
    ]

def test_mismatched_event_counts_raise_error():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 1.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
    ]

    try:
        compare_timing(expected, performed)
        assert False, "Expected ValueError"
    except ValueError:
        pass


def test_at_least_two_notes_are_required():
    expected = [
        {"pitch": "C4", "offset": 0.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
    ]

    try:
        compare_timing(expected, performed)
        assert False, "Expected ValueError"
    except ValueError:
        pass


def test_expected_offsets_must_span_positive_duration():
    expected = [
        {"pitch": "C4", "offset": 0.0},
        {"pitch": "D4", "offset": 0.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.0},
        {"pitch": "D4", "onset": 1.0},
    ]

    try:
        compare_timing(expected, performed)
        assert False, "Expected ValueError"
    except ValueError:
        pass

def test_missing_note_with_pause_is_detected():
    expected = extract_note_details(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )[:16]

    audio_file = (
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    segmentation = segment_performance(
        expected,
        detect_note_events(audio_file),
    )

    results = analyze_missing_note_timing(
        expected,
        segmentation["missing_expected_indices"],
        detect_silence_regions(audio_file),
        segmentation["seconds_per_beat"],
        segmentation["performed_events"][0]["onset"],
    )

    assert len(results) == 1
    assert results[0]["expected_index"] == 5
    assert results[0]["pitch"] == "A4"
    assert results[0]["pause_detected"] is True
    assert results[0]["silence_regions"]
    assert results[0]["measure"] == expected[5]["measure"]
    assert results[0]["beat"] == expected[5]["beat"]


def test_missing_note_without_pause_is_detected():
    expected = extract_note_details(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )[:16]

    audio_file = (
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_continuous2.wav"
    )

    segmentation = segment_performance(
        expected,
        detect_note_events(audio_file),
    )

    results = analyze_missing_note_timing(
        expected,
        segmentation["missing_expected_indices"],
        detect_silence_regions(audio_file),
        segmentation["seconds_per_beat"],
        segmentation["performed_events"][0]["onset"],
    )

    assert len(results) == 1
    assert results[0]["expected_index"] == 5
    assert results[0]["pitch"] == "A4"
    assert results[0]["pause_detected"] is False
    assert results[0]["silence_regions"] == []

def test_classify_exact_note_lengths():
    assert classify_note_length(0.25) == "sixteenth note"
    assert classify_note_length(0.5) == "eighth note"
    assert classify_note_length(1.0) == "quarter note"
    assert classify_note_length(1.5) == "dotted quarter note"
    assert classify_note_length(2.0) == "half note"
    assert classify_note_length(3.0) == "dotted half note"
    assert classify_note_length(4.0) == "whole note"


def test_classify_slightly_imperfect_quarter_note():
    assert classify_note_length(0.92) == "quarter note"
    assert classify_note_length(1.08) == "quarter note"


def test_classify_slightly_imperfect_half_note():
    assert classify_note_length(1.85) == "half note"
    assert classify_note_length(2.15) == "half note"


def test_classify_note_length_rejects_nonpositive_duration():
    import pytest

    with pytest.raises(ValueError):
        classify_note_length(0)

    with pytest.raises(ValueError):
        classify_note_length(-1.0)

def test_analyze_note_duration_correct():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=0.48,
        seconds_per_beat=0.5,
    )

    assert result["expected_note_length"] == "quarter note"
    assert result["played_note_length"] == "quarter note"
    assert result["duration_status"] == "correct"


def test_analyze_note_duration_too_short():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=0.25,
        seconds_per_beat=0.5,
    )

    assert result["expected_note_length"] == "quarter note"
    assert result["played_note_length"] == "eighth note"
    assert result["duration_status"] == "too_short"


def test_analyze_note_duration_too_long():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=1.0,
        seconds_per_beat=0.5,
    )

    assert result["expected_note_length"] == "quarter note"
    assert result["played_note_length"] == "half note"
    assert result["duration_status"] == "too_long"


def test_analyze_note_duration_allows_small_variation():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=0.42,
        seconds_per_beat=0.5,
    )

    assert result["played_note_length"] == "quarter note"
    assert result["duration_status"] == "correct"

def test_analyze_note_duration_at_lower_tolerance_boundary():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=0.4,
        seconds_per_beat=0.5,
    )

    # 0.4 / 0.5 = 0.8 beats, exactly 20% short
    assert result["duration_status"] == "correct"


def test_analyze_note_duration_at_upper_tolerance_boundary():
    result = analyze_note_duration(
        expected_duration_beats=1.0,
        performed_duration_seconds=0.6,
        seconds_per_beat=0.5,
    )

    # 0.6 / 0.5 = 1.2 beats, exactly 20% long
    assert result["duration_status"] == "correct"


def test_analyze_note_duration_rejects_invalid_expected_duration():
    import pytest

    with pytest.raises(ValueError):
        analyze_note_duration(
            expected_duration_beats=0,
            performed_duration_seconds=0.5,
            seconds_per_beat=0.5,
        )


def test_analyze_note_duration_rejects_invalid_performed_duration():
    import pytest

    with pytest.raises(ValueError):
        analyze_note_duration(
            expected_duration_beats=1.0,
            performed_duration_seconds=0,
            seconds_per_beat=0.5,
        )


def test_analyze_note_duration_rejects_invalid_seconds_per_beat():
    import pytest

    with pytest.raises(ValueError):
        analyze_note_duration(
            expected_duration_beats=1.0,
            performed_duration_seconds=0.5,
            seconds_per_beat=0,
        )

def test_compare_timing_does_not_accumulate_tempo_drift():
    expected = [
        {"pitch": "C4", "offset": 0.0, "measure": 1, "beat": 1.0},
        {"pitch": "D4", "offset": 1.0, "measure": 1, "beat": 2.0},
        {"pitch": "E4", "offset": 2.0, "measure": 1, "beat": 3.0},
        {"pitch": "F4", "offset": 3.0, "measure": 1, "beat": 4.0},
        {"pitch": "G4", "offset": 4.0, "measure": 2, "beat": 1.0},
        {"pitch": "A4", "offset": 5.0, "measure": 2, "beat": 2.0},
    ]

    performed = [
        {"pitch": "C4", "onset": 0.00},
        {"pitch": "D4", "onset": 0.95},
        {"pitch": "E4", "onset": 1.90},
        {"pitch": "F4", "onset": 2.85},
        {"pitch": "G4", "onset": 3.80},
        {"pitch": "A4", "onset": 5.00},
    ]

    result = compare_timing(
        expected,
        performed,
        tolerance_ratio=0.20,
    )

    assert result["results"][1]["timing"] == "on_time"
    assert result["results"][2]["timing"] == "on_time"
    assert result["results"][3]["timing"] == "on_time"
    assert result["results"][4]["timing"] == "on_time"

def test_compare_timing_prefers_measured_onset():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
        },
        {
            "pitch": "E4",
            "offset": 2.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "measured_onset": 0.0,
        },
        {
            "pitch": "D4",
            # Score-aware onset is misleadingly late.
            "onset": 1.4,
            "measured_onset": 1.0,
        },
        {
            "pitch": "E4",
            "onset": 2.0,
            "measured_onset": 2.0,
        },
    ]

    result = compare_timing(
        expected,
        performed,
        tolerance_ratio=0.20,
    )

    assert result["results"][1]["timing"] == "on_time"
    assert (
        result["results"][1]["performed_interval"]
        == 1.0
    )