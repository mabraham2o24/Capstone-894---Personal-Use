from pathlib import Path

from music_analysis.note_events import (
    detect_note_events,
    is_valid_note_duration,
    detect_silence_regions
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_rejects_very_short_note_event():
    assert is_valid_note_duration(0.10) is False


def test_accepts_normal_note_event():
    assert is_valid_note_duration(0.50) is True


def test_accepts_minimum_note_duration():
    assert is_valid_note_duration(0.15) is True


def test_detect_note_events_from_c_major_audio():
    audio_file = FIXTURE_DIR / "c_major_test.wav"

    events = detect_note_events(audio_file)

    assert len(events) > 0

    for event in events:
        assert "pitch" in event
        assert "onset" in event
        assert "duration" in event
        assert event["duration"] >= 0.15

def test_detect_silence_regions_finds_internal_pause():
    regions = detect_silence_regions(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    internal_regions = [
        region
        for region in regions
        if 2.0 < region["start"] < 19.0
    ]

    assert len(internal_regions) == 1

    pause = internal_regions[0]

    assert 5.8 <= pause["start"] <= 6.4
    assert 6.8 <= pause["end"] <= 7.5
    assert pause["duration"] >= 1.0


def test_detect_silence_regions_no_internal_pause_when_continuous():
    regions = detect_silence_regions(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_continuous2.wav"
    )

    internal_regions = [
        region
        for region in regions
        if 2.0 < region["start"] < 19.0
    ]

    assert internal_regions == []


def test_detect_silence_regions_returns_expected_fields():
    regions = detect_silence_regions(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    assert regions

    for region in regions:
        assert "start" in region
        assert "end" in region
        assert "duration" in region