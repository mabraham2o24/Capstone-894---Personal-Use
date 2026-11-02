"""Regression tests for low-confidence pitch fallback behavior."""

import numpy as np

from music_analysis import note_events


def test_rejects_low_confidence_segment_with_disagreeing_pitches(monkeypatch):
    """Five C4 and five D4 fallback frames have only 50% pitch agreement."""
    sample_rate = 1000
    audio = np.ones(400, dtype=float) * 0.5

    monkeypatch.setattr(
        note_events.librosa, "load",
        lambda *args, **kwargs: (audio.copy(), sample_rate),
    )
    monkeypatch.setattr(
        note_events.librosa.effects, "trim",
        lambda y, **kwargs: (y, (0, len(y))),
    )
    monkeypatch.setattr(
        note_events.librosa.onset, "onset_detect",
        lambda **kwargs: np.array([0], dtype=int),
    )
    monkeypatch.setattr(
        note_events.librosa, "frames_to_time",
        lambda frames, **kwargs: np.asarray(frames, dtype=float) * 0.02,
    )
    monkeypatch.setattr(
        note_events.librosa, "get_duration",
        lambda **kwargs: 0.4,
    )
    monkeypatch.setattr(
        note_events.librosa, "pyin",
        lambda *args, **kwargs: (
            np.array([261.63] * 5 + [293.66] * 5),
            np.array([True] * 10),
            np.array([0.5] * 10),
        ),
    )

    result = note_events.detect_note_events("synthetic.wav")

    assert result == [], (
        "A fallback candidate with 50% pitch agreement must be rejected "
        "because MIN_PITCH_AGREEMENT is 80%."
    )
