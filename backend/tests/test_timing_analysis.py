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
        {"pitch": "D4", "offset": 1.0},
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
        note["expected_onset"]
        for note in result["results"]
    ] == [0.0, 0.5, 1.0, 1.5]

    assert all(
        note["timing"] == "on_time"
        for note in result["results"]
    )

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