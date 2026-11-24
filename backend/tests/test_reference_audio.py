"""Unit tests for MusicXML reference audio generation."""

import io
import wave

import numpy as np
import pytest

from music_analysis.reference_audio import (
    DEFAULT_TEMPO_BPM,
    generate_reference_audio,
    note_to_frequency,
    resolve_reference_tempo,
    synthesize_note,
)


@pytest.fixture
def score_summary():
    return {
        "tempo_bpm": 120,
        "note_details": [
            {
                "pitch": "C4",
                "duration": 1.0,
                "offset": 0.0,
                "measure": 1,
                "beat": 1.0,
            },
            {
                "pitch": "D4",
                "duration": 1.0,
                "offset": 1.0,
                "measure": 1,
                "beat": 2.0,
            },
            {
                "pitch": "E4",
                "duration": 1.0,
                "offset": 2.0,
                "measure": 2,
                "beat": 1.0,
            },
            {
                "pitch": "G4",
                "duration": 1.0,
                "offset": 4.0,
                "measure": 2,
                "beat": 3.0,
            },
            {
                "pitch": "A4",
                "duration": 2.0,
                "offset": 5.0,
                "measure": 3,
                "beat": 1.0,
            },
        ],
        "rest_details": [
            {
                "duration": 1.0,
                "offset": 3.0,
                "measure": 2,
                "beat": 2.0,
            },
        ],
    }


def read_wav(result):
    """Return decoded PCM samples and sample rate."""

    with wave.open(
        io.BytesIO(result["audio_bytes"]), "rb"
    ) as audio:
        sample_rate = audio.getframerate()

        samples = np.frombuffer(
            audio.readframes(audio.getnframes()),
            dtype="<i2",
        )

    return samples, sample_rate


def dominant_frequency(samples, sample_rate):
    """Estimate the dominant frequency using FFT."""

    signal = samples.astype(float)
    signal *= np.hanning(len(signal))

    spectrum = np.abs(np.fft.rfft(signal))

    frequencies = np.fft.rfftfreq(
        len(signal),
        d=1 / sample_rate,
    )

    return frequencies[np.argmax(spectrum)]


@pytest.mark.parametrize(
    "note, expected_frequency",
    [
        ("A4", 440.0),
        ("C4", 261.63),
        ("F#4", 369.99),
        ("B-4", 466.16),
    ],
)
def test_note_to_frequency(note, expected_frequency):
    assert note_to_frequency(note) == pytest.approx(
        expected_frequency,
        abs=0.02,
    )


def test_synthesize_note_frequency():
    sample_rate = 44100

    samples = synthesize_note(
        frequency=440,
        duration=1.0,
        sample_rate=sample_rate,
    )

    assert dominant_frequency(
        samples,
        sample_rate,
    ) == pytest.approx(440, abs=1)


def test_synthesize_note_duration():
    samples = synthesize_note(
        frequency=440,
        duration=0.75,
        sample_rate=44100,
    )

    assert len(samples) == 33075


def test_synthesize_note_zero_duration():
    samples = synthesize_note(
        frequency=440,
        duration=0,
    )

    assert len(samples) == 0


def test_synthesize_note_envelope():
    samples = synthesize_note(
        frequency=440,
        duration=1.0,
    )

    assert samples[0] == pytest.approx(0)
    assert samples[-1] == pytest.approx(0)


def test_reference_audio_selected_pitches(score_summary):
    result = generate_reference_audio(
        score_summary,
        start_measure=2,
        end_measure=2,
    )

    samples, sample_rate = read_wav(result)

    # Measure 2 contains E4, a rest, and G4.
    first_note = samples[:sample_rate // 2]
    second_note = samples[sample_rate:sample_rate * 3 // 2]

    assert dominant_frequency(
        first_note,
        sample_rate,
    ) == pytest.approx(329.63, abs=3)

    assert dominant_frequency(
        second_note,
        sample_rate,
    ) == pytest.approx(392.0, abs=3)


def test_reference_audio_preserves_written_rest(score_summary):
    result = generate_reference_audio(
        score_summary,
        start_measure=2,
        end_measure=2,
    )

    samples, sample_rate = read_wav(result)

    rest_samples = samples[
        sample_rate // 2:sample_rate
    ]

    assert np.all(rest_samples == 0)


def test_reference_audio_removes_preceding_measures(
    score_summary,
):
    result = generate_reference_audio(
        score_summary,
        start_measure=3,
        end_measure=3,
    )

    samples, sample_rate = read_wav(result)

    # Measure 3 starts at offset 5 in the original score,
    # but reference playback must begin immediately.
    assert len(samples) / sample_rate == pytest.approx(
        1.0,
        abs=0.001,
    )

    assert np.any(samples[:sample_rate // 10] != 0)

    assert dominant_frequency(
        samples,
        sample_rate,
    ) == pytest.approx(440, abs=1)


def test_reference_audio_preserves_note_duration(
    score_summary,
):
    result = generate_reference_audio(
        score_summary,
        start_measure=3,
        end_measure=3,
    )

    # Two quarter-note beats at 120 BPM = one second.
    assert result["duration_seconds"] == pytest.approx(
        1.0,
        abs=0.001,
    )


def test_reference_audio_full_score(score_summary):
    result = generate_reference_audio(score_summary)

    # Seven quarter-note beats at 120 BPM.
    assert result["duration_seconds"] == pytest.approx(
        3.5,
        abs=0.001,
    )


def test_reference_audio_prevents_clipping(score_summary):
    result = generate_reference_audio(score_summary)

    samples, _ = read_wav(result)

    assert np.max(
        np.abs(samples.astype(float))
    ) <= 32767 * 0.8 + 1


def test_score_tempo_takes_priority():
    result = resolve_reference_tempo(
        {"tempo_bpm": 100},
        {"timing": {"seconds_per_beat": 0.75}},
    )

    assert result["bpm"] == 100
    assert result["source"] == "score"


@pytest.mark.parametrize(
    "seconds_per_beat, expected_bpm",
    [
        (0.5, 120),
        (0.75, 80),
        (1.0, 60),
    ],
)
def test_estimated_performance_tempo(
    seconds_per_beat,
    expected_bpm,
):
    result = resolve_reference_tempo(
        {"tempo_bpm": None},
        {
            "timing": {
                "seconds_per_beat": seconds_per_beat,
            },
        },
    )

    assert result["bpm"] == pytest.approx(expected_bpm)
    assert result["source"] == "performance"


@pytest.mark.parametrize(
    "invalid_tempo",
    [
        None,
        0,
        -1,
        float("nan"),
        float("inf"),
        "invalid",
    ],
)
def test_invalid_performance_tempo_uses_default(
    invalid_tempo,
):
    result = resolve_reference_tempo(
        {"tempo_bpm": None},
        {
            "timing": {
                "seconds_per_beat": invalid_tempo,
            },
        },
    )

    assert result["bpm"] == DEFAULT_TEMPO_BPM
    assert result["source"] == "default"


def test_invalid_score_tempo_uses_performance():
    result = resolve_reference_tempo(
        {"tempo_bpm": -100},
        {"timing": {"seconds_per_beat": 0.75}},
    )

    assert result["bpm"] == 80
    assert result["source"] == "performance"


def test_reference_audio_estimated_tempo_duration(
    score_summary,
):
    score_summary["tempo_bpm"] = None

    result = generate_reference_audio(
        score_summary,
        start_measure=2,
        end_measure=2,
        performance_analysis={
            "timing": {
                "seconds_per_beat": 0.75,
            },
        },
    )

    assert result["tempo_bpm"] == 80
    assert result["tempo_source"] == "performance"

    # Three quarter-note beats at 80 BPM.
    assert result["duration_seconds"] == pytest.approx(
        2.25,
        abs=0.001,
    )


@pytest.mark.parametrize(
    "start_measure, end_measure",
    [
        (3, 1),
        (0, 2),
        (None, 2),
        (1, None),
        (10, 12),
    ],
)
def test_invalid_measure_ranges(
    score_summary,
    start_measure,
    end_measure,
):
    with pytest.raises(ValueError):
        generate_reference_audio(
            score_summary,
            start_measure=start_measure,
            end_measure=end_measure,
        )


def test_reference_audio_missing_score():
    with pytest.raises(ValueError):
        generate_reference_audio(None)


def test_reference_audio_empty_score():
    with pytest.raises(ValueError):
        generate_reference_audio(
            {"note_details": []}
        )


def test_reference_audio_invalid_event_timing(
    score_summary,
):
    score_summary["note_details"][0]["duration"] = -1

    with pytest.raises(ValueError):
        generate_reference_audio(score_summary)


def test_reference_audio_duration_limit(score_summary):
    score_summary["note_details"][0]["duration"] = 1000

    with pytest.raises(ValueError, match="five-minute"):
        generate_reference_audio(score_summary)