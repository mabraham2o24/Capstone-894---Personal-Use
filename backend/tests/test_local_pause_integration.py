
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


BASE = "test_music/Minuet_in_F"


@pytest.fixture(scope="module")
def score_data():
    score_path = f"{BASE}/minuet_in_f.mxl"

    return (
        extract_note_details(score_path)[:12],
        extract_rest_details(score_path),
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
def test_local_pause_integration(
    score_data,
    instrument,
    scenario,
    expected_pause,
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
    performance_start = first_event.get("measured_onset")

    if performance_start is None:
        performance_start = first_event["onset"]

    analysis = analyze_performance(
        expected,
        performed,
        silence_regions=silence_regions,
        seconds_per_beat=segmented["seconds_per_beat"],
        performance_start=performance_start,
        audio_path=audio_path,
        rest_details=rest_details,
    )

    e4_results = [
        result
        for result in analysis["missing_note_timing"]
        if result["expected_index"] == 4
    ]

    assert len(e4_results) == 1

    result = e4_results[0]

    assert result["local_pause_detected"] is expected_pause
    assert "local_quiet_duration" in result
    assert "local_quiet_intervals" in result

    # Verify the original global analysis is preserved.
    assert "pause_detected" in result
    assert "silence_regions" in result
