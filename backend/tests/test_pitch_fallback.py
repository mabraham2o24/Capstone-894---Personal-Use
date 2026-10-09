
import pytest

from music_analysis.score_parser import extract_note_details
from music_analysis.performance_segmentation import segment_performance
from music_analysis.performance_analysis import analyze_performance
from music_analysis.note_events import detect_note_events


SCORE_PATH = "test_music/Minuet_in_F/minuet_in_f.mxl"
AUDIO_DIR = "test_music/Minuet_in_F/performances"


def get_audio_path(instrument, scenario):
    return (
        f"{AUDIO_DIR}/minuet_measures_1_4_"
        f"{instrument}_{scenario}.wav"
    )


def detect_and_analyze(instrument, scenario):
    expected = extract_note_details(SCORE_PATH)[:12]

    events = detect_note_events(
        get_audio_path(instrument, scenario)
    )

    raw_events = [
        {
            "pitch": event["pitch"],
            "onset": event["onset"],
            "duration": event["duration"],
        }
        for event in events
    ]

    segmented = segment_performance(expected, raw_events)

    analysis = analyze_performance(
        expected,
        segmented["performed_events"],
    )

    return events, segmented, analysis


def test_piano_correct_recovers_all_notes():
    events, segmented, analysis = detect_and_analyze(
        "piano", "correct"
    )

    assert len(segmented["performed_events"]) == 12

    assert analysis["errors"]["incorrect_pitch"] == []
    assert analysis["errors"]["missing_notes"] == []
    assert analysis["errors"]["additional_notes"] == []

    detected_pitches = [
        event["pitch"]
        for event in events
    ]

    assert detected_pitches == [
        "C5", "A4", "F4", "G4",
        "E4", "F4", "F5", "C5",
        "A4", "A#4", "G4", "A4"
    ]


def test_piano_wrong_pitch_detects_substitution():
    _, _, analysis = detect_and_analyze(
        "piano", "wrong_pitch"
    )

    errors = analysis["errors"]["incorrect_pitch"]

    assert any(
        error["expected_note"] == "A4"
        and error["performed_note"] == "B4"
        for error in errors
    )


def test_piano_extra_note_detects_d5():
    _, _, analysis = detect_and_analyze(
        "piano", "extra_note"
    )

    additional = analysis["errors"]["additional_notes"]

    assert any(
        error["performed_note"] == "D5"
        for error in additional
    )


def test_piano_multiple_errors_detects_b4_and_d5():
    _, _, analysis = detect_and_analyze(
        "piano", "multiple_errors"
    )

    incorrect = analysis["errors"]["incorrect_pitch"]
    additional = analysis["errors"]["additional_notes"]

    assert any(
        error["expected_note"] == "A4"
        and error["performed_note"] == "B4"
        for error in incorrect
    )

    assert any(
        error["performed_note"] == "D5"
        for error in additional
    )


@pytest.mark.parametrize(
    "scenario",
    ["missing_pause", "missing_continuous"],
)
def test_violin_missing_note_rejects_false_d4(scenario):
    events, _, analysis = detect_and_analyze(
        "violin", scenario
    )

    assert not any(
        event["pitch"] == "D4"
        for event in events
    )

    assert analysis["errors"]["incorrect_pitch"] == []

    assert any(
        error["expected_note"] == "E4"
        for error in analysis["errors"]["missing_notes"]
    )


def test_violin_wrong_pitch_recovers_e4():
    _, segmented, analysis = detect_and_analyze(
        "violin", "wrong_pitch"
    )

    pitches = [
        event["pitch"]
        for event in segmented["performed_events"]
    ]

    assert "E4" in pitches

    assert not any(
        error["expected_note"] == "E4"
        for error in analysis["errors"]["missing_notes"]
    )

    assert any(
        error["expected_note"] == "A4"
        and error["performed_note"] == "B4"
        for error in analysis["errors"]["incorrect_pitch"]
    )


def test_flute_correct_remains_accurate():
    _, segmented, analysis = detect_and_analyze(
        "flute", "correct"
    )

    assert len(segmented["performed_events"]) == 12

    assert analysis["errors"]["incorrect_pitch"] == []
    assert analysis["errors"]["missing_notes"] == []
    assert analysis["errors"]["additional_notes"] == []
