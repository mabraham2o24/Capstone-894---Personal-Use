
import pytest

from music_analysis.score_parser import extract_note_details
from music_analysis.note_events import detect_note_events
from music_analysis.performance_segmentation import segment_performance
from music_analysis.performance_analysis import analyze_performance
from music_analysis.timing_analysis import analyze_local_missing_note_pauses
from music_analysis.score_parser import extract_rest_details


BASE = "test_music/Minuet_in_F"
EXPECTED = extract_note_details(f"{BASE}/minuet_in_f.mxl")[:12]
REST_DETAILS = extract_rest_details(
    f"{BASE}/minuet_in_f.mxl"
)


@pytest.mark.parametrize(
    "instrument,scenario,expected_pause",
    [
        ("violin", "missing_pause", True),
        ("violin", "missing_continuous", False),
        ("flute", "missing_pause", True),
        ("flute", "missing_continuous", False),
        ("piano", "missing_pause", True),
        ("piano", "missing_continuous", False),
    ],
)
def test_production_local_pause_detection(
    instrument,
    scenario,
    expected_pause,
):
    audio_path = (
        f"{BASE}/performances/"
        f"minuet_measures_1_4_{instrument}_{scenario}.wav"
    )

    raw = detect_note_events(audio_path)
    segmented = segment_performance(EXPECTED, raw)

    performed = segmented["performed_events"]

    analysis = analyze_performance(EXPECTED, performed)

    results = analyze_local_missing_note_pauses(
        audio_path,
        analysis["alignment"],
        performed,
        expected_notes=EXPECTED,
        rest_details=REST_DETAILS,
    )

    e4_results = [
        result
        for result in results
        if result["expected_index"] == 4
    ]

    assert len(e4_results) == 1
    assert e4_results[0]["pause_detected"] is expected_pause

def test_missing_first_note_returns_unknown():
    alignment = [
        {
            "expected_note": "C4",
            "performed_note": None,
            "operation": "deletion",
        },
        {
            "expected_note": "D4",
            "performed_note": "D4",
            "operation": "match",
        },
    ]

    performed = [
        {
            "pitch": "D4",
            "onset": 0.5,
            "duration": 0.5,
        },
    ]

    results = analyze_local_missing_note_pauses(
        "test_audio/c_major_test.wav",
        alignment,
        performed,
    )

    assert len(results) == 1
    assert results[0]["expected_index"] == 0
    assert results[0]["pause_detected"] is None


def test_missing_last_note_returns_unknown():
    alignment = [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match",
        },
        {
            "expected_note": "D4",
            "performed_note": None,
            "operation": "deletion",
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
        },
    ]

    results = analyze_local_missing_note_pauses(
        "test_audio/c_major_test.wav",
        alignment,
        performed,
    )

    assert len(results) == 1
    assert results[0]["expected_index"] == 1
    assert results[0]["pause_detected"] is None


def test_consecutive_missing_notes_return_separate_results():
    alignment = [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match",
        },
        {
            "expected_note": "D4",
            "performed_note": None,
            "operation": "deletion",
        },
        {
            "expected_note": "E4",
            "performed_note": None,
            "operation": "deletion",
        },
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match",
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
        },
        {
            "pitch": "F4",
            "onset": 1.5,
            "duration": 0.5,
        },
    ]

    results = analyze_local_missing_note_pauses(
        "test_audio/c_major_test.wav",
        alignment,
        performed,
    )

    assert len(results) == 2
    assert [r["expected_index"] for r in results] == [1, 2]
    assert all(
        result["pause_detected"] is None
        for result in results
    )

    assert all(
        "Consecutive missing notes" in result["reason"]
        for result in results
    )


def test_substitution_can_be_timing_anchor():
    alignment = [
        {
            "expected_note": "G4",
            "performed_note": "F#4",
            "operation": "substitution",
        },
        {
            "expected_note": "E4",
            "performed_note": None,
            "operation": "deletion",
        },
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match",
        },
    ]

    performed = [
        {
            "pitch": "F#4",
            "onset": 0.0,
            "duration": 0.3,
            "measured_onset": 0.0,
        },
        {
            "pitch": "F4",
            "onset": 0.7,
            "duration": 0.5,
            "measured_onset": 0.7,
        },
    ]

    results = analyze_local_missing_note_pauses(
        "test_audio/c_major_test.wav",
        alignment,
        performed,
    )

    assert len(results) == 1

    result = results[0]

    assert result["expected_index"] == 1
    assert result["previous_expected_index"] == 0
    assert result["following_expected_index"] == 2
    assert result["previous_pitch"] == "F#4"
    assert result["following_pitch"] == "F4"
    assert result["pause_detected"] is not None

def test_written_rest_returns_unknown():
    from music_analysis.score_parser import extract_rest_details

    expected_notes = extract_note_details(
        f"{BASE}/minuet_in_f.mxl"
    )[:12]

    rest_details = extract_rest_details(
        f"{BASE}/minuet_in_f.mxl"
    )

    # Simulate a missing note before the written rest
    # at offset 5.0, with the next aligned note after it.
    alignment = [
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match",
        },
        {
            "expected_note": "F5",
            "performed_note": None,
            "operation": "deletion",
        },
        {
            "expected_note": "C5",
            "performed_note": "C5",
            "operation": "match",
        },
    ]

    performed = [
        {
            "pitch": "F4",
            "onset": 2.0,
            "duration": 0.5,
        },
        {
            "pitch": "C5",
            "onset": 3.5,
            "duration": 0.5,
        },
    ]

    # Supply score details corresponding to the synthetic
    # three-operation alignment.
    selected_expected = [
        expected_notes[5],  # F4, offset 4.0
        expected_notes[6],  # F5, offset 6.0
        expected_notes[7],  # C5, offset 7.0
    ]

    results = analyze_local_missing_note_pauses(
        "test_audio/c_major_test.wav",
        alignment,
        performed,
        expected_notes=selected_expected,
        rest_details=rest_details,
    )

    assert len(results) == 1
    assert results[0]["pause_detected"] is None
    assert "Written rest" in results[0]["reason"]


def test_violin_missing_a4_is_not_classified_as_pause():
    audio_path = (
        f"{BASE}/performances/"
        "minuet_measures_1_4_violin_missing_pause.wav"
    )

    raw = detect_note_events(audio_path)
    segmented = segment_performance(EXPECTED, raw)

    performed = segmented["performed_events"]
    analysis = analyze_performance(EXPECTED, performed)

    results = analyze_local_missing_note_pauses(
        audio_path,
        analysis["alignment"],
        performed,
        expected_notes=EXPECTED,
        rest_details=REST_DETAILS,
    )

    a4_results = [
        result
        for result in results
        if result["expected_index"] == 8
    ]

    assert len(a4_results) == 1
    assert a4_results[0]["pause_detected"] is False


@pytest.mark.parametrize(
    "scenario",
    ["missing_pause", "missing_continuous"],
)
def test_piano_missing_bb4_is_not_classified_as_pause(
    scenario,
):
    audio_path = (
        f"{BASE}/performances/"
        f"minuet_measures_1_4_piano_{scenario}.wav"
    )

    raw = detect_note_events(audio_path)
    segmented = segment_performance(EXPECTED, raw)

    performed = segmented["performed_events"]
    analysis = analyze_performance(EXPECTED, performed)

    results = analyze_local_missing_note_pauses(
        audio_path,
        analysis["alignment"],
        performed,
        expected_notes=EXPECTED,
        rest_details=REST_DETAILS,
    )

    bb4_results = [
        result
        for result in results
        if result["expected_index"] == 9
    ]

    assert len(bb4_results) == 1
    assert bb4_results[0]["pause_detected"] is False
