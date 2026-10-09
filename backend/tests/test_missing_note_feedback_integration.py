
import pytest

from music_analysis.score_parser import (
    extract_note_details,
    extract_rest_details,
)
from music_analysis.note_events import (
    detect_note_events,
    detect_silence_regions,
)
from music_analysis.performance_segmentation import segment_performance
from music_analysis.performance_analysis import analyze_performance
from music_analysis.feedback_formatter import format_note_feedback


BASE = "test_music/Minuet_in_F"


@pytest.fixture(scope="module")
def score_data():
    score_path = f"{BASE}/minuet_in_f.mxl"

    return (
        extract_note_details(score_path)[:12],
        extract_rest_details(score_path),
    )


@pytest.mark.parametrize(
    "instrument,scenario,expected_behavior",
    [
        ("violin", "missing_pause", "paused"),
        ("violin", "missing_continuous", "continued"),
        ("flute", "missing_pause", "paused"),
        ("flute", "missing_continuous", "continued"),
        ("piano", "missing_pause", "paused"),
        ("piano", "missing_continuous", "continued"),
    ],
)
def test_missing_e4_student_feedback(
    score_data,
    instrument,
    scenario,
    expected_behavior,
):
    expected, rest_details = score_data

    audio_path = (
        f"{BASE}/performances/"
        f"minuet_measures_1_4_{instrument}_{scenario}.wav"
    )

    raw = detect_note_events(audio_path)
    segmented = segment_performance(expected, raw)

    performed = segmented["performed_events"]

    silence_regions = detect_silence_regions(audio_path)

    first_event = performed[0]
    performance_start = first_event.get(
        "measured_onset",
        first_event["onset"],
    )

    analysis = analyze_performance(
        expected,
        performed,
        silence_regions=silence_regions,
        seconds_per_beat=segmented["seconds_per_beat"],
        performance_start=performance_start,
        audio_path=audio_path,
        rest_details=rest_details,
    )

    feedback = format_note_feedback(expected, analysis)

    missing_e4 = [
        item
        for item in feedback
        if (
            item["measure"] == 2
            and item["beat"] == 1.5
            and item["expected_note"] == "E4"
        )
    ]

    assert len(missing_e4) == 1

    result = missing_e4[0]

    assert result["pitch_status"] == "missing"
    assert (
        result["missing_note_behavior"]
        == expected_behavior
    )
    assert "missing_note_pause_duration" in result
