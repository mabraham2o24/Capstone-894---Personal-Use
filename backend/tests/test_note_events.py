from music_analysis.note_events import is_valid_note_duration


def test_rejects_very_short_note_event():
    assert is_valid_note_duration(0.10) is False


def test_accepts_normal_note_event():
    assert is_valid_note_duration(0.50) is True


def test_accepts_minimum_note_duration():
    assert is_valid_note_duration(0.15) is True