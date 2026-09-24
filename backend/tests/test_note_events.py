from pathlib import Path

from music_analysis.note_events import (
    detect_note_events,
    is_valid_note_duration,
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