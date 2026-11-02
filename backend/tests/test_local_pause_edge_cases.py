"""Focused regression tests for missing-note pause classification.

Place this file in backend/tests/. No production code changes required.
"""

import numpy as np
import pytest

from music_analysis import timing_analysis


@pytest.fixture
def stub_audio(monkeypatch):
    """Provide a deterministic non-silent recording without a WAV dependency."""
    sample_rate = 1000
    audio = np.ones(4000, dtype=np.float32) * 0.2
    monkeypatch.setattr(
        timing_analysis.librosa,
        "load",
        lambda *args, **kwargs: (audio, sample_rate),
    )
    monkeypatch.setattr(
        timing_analysis.librosa.effects,
        "trim",
        lambda samples, **kwargs: (samples, (0, len(samples))),
    )
    return "synthetic.wav"


@pytest.fixture
def missing_middle_note():
    alignment = [
        {"operation": "match"},
        {"operation": "deletion"},
        {"operation": "match"},
    ]
    events = [
        {"pitch": "C4", "onset": 0.5},
        {"pitch": "E4", "onset": 2.5},
    ]
    return alignment, events


@pytest.mark.parametrize("inferred_index", [0, 1])
def test_inferred_neighbor_does_not_create_false_pause(
    stub_audio, missing_middle_note, inferred_index
):
    alignment, events = missing_middle_note
    events[inferred_index]["inferred"] = True

    results = timing_analysis.analyze_local_missing_note_pauses(
        stub_audio, alignment, events
    )

    assert len(results) == 1
    assert results[0]["expected_index"] == 1
    assert results[0]["pause_detected"] is None
    assert results[0]["reason"] == "Inferred timing anchor"
    assert results[0]["quiet_intervals"] == []


def test_invalid_score_offsets_do_not_create_false_pause(
    stub_audio, missing_middle_note
):
    alignment, events = missing_middle_note
    expected_notes = [
        {"pitch": "C4", "offset": 2.0},
        {"pitch": "D4", "offset": 2.5},
        {"pitch": "E4", "offset": 1.0},
    ]

    results = timing_analysis.analyze_local_missing_note_pauses(
        stub_audio,
        alignment,
        events,
        expected_notes=expected_notes,
        rest_details=[],
    )

    assert len(results) == 1
    assert results[0]["pause_detected"] is None
    assert results[0]["reason"] == "Invalid score timing"


def test_nonincreasing_neighbor_onsets_do_not_create_false_pause(
    stub_audio, missing_middle_note
):
    alignment, events = missing_middle_note
    events[1]["onset"] = events[0]["onset"]

    results = timing_analysis.analyze_local_missing_note_pauses(
        stub_audio, alignment, events
    )

    assert len(results) == 1
    assert results[0]["pause_detected"] is None
    assert results[0]["reason"] == "Invalid neighboring note timing"
