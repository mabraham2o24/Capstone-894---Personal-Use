"""
Generate reference WAV audio from parsed MusicXML score data.

Tempo selection priority:
1. Tempo specified in the MusicXML score.
2. Estimated tempo from the user's performance.
3. Default tempo when neither is available.
"""

import io
import math
import wave

import numpy as np
from music21 import pitch


DEFAULT_TEMPO_BPM = 120.0
SAMPLE_RATE = 44100
MAX_DURATION_SECONDS = 300


def positive_number(value):
    """Return a finite positive number, or None."""

    try:
        value = float(value)
    except (TypeError, ValueError, OverflowError):
        return None

    if not math.isfinite(value) or value <= 0:
        return None

    return value


def resolve_reference_tempo(
    score_summary,
    performance_analysis=None,
):
    """
    Determine the reference playback tempo and its source.

    Returns:
        Dictionary containing bpm and source.
    """

    score_summary = score_summary or {}
    performance_analysis = performance_analysis or {}

    # Priority 1: Explicit MusicXML tempo.
    score_bpm = positive_number(
        score_summary.get("tempo_bpm")
    )

    if score_bpm is not None:
        return {
            "bpm": score_bpm,
            "source": "score",
        }

    # Priority 2: Estimated performance tempo.
    timing = performance_analysis.get("timing") or {}

    seconds_per_beat = positive_number(
        timing.get("seconds_per_beat")
    )

    if seconds_per_beat is not None:
        estimated_bpm = positive_number(
            60.0 / seconds_per_beat
        )

        if estimated_bpm is not None:
            return {
                "bpm": estimated_bpm,
                "source": "performance",
            }

    # Priority 3: Default tempo.
    return {
        "bpm": DEFAULT_TEMPO_BPM,
        "source": "default",
    }


def note_to_frequency(note_name):
    """Convert a MusicXML pitch into frequency in Hz."""

    return float(pitch.Pitch(note_name).frequency)


def synthesize_note(
    frequency,
    duration,
    sample_rate=SAMPLE_RATE,
):
    """
    Generate a musical tone using harmonic synthesis
    and a short attack/release envelope.
    """

    sample_count = int(round(duration * sample_rate))

    if sample_count <= 0:
        return np.zeros(0, dtype=np.float32)

    time = np.arange(sample_count) / sample_rate
    signal = np.zeros(sample_count, dtype=np.float64)

    harmonics = [
        (1, 1.00),
        (2, 0.35),
        (3, 0.20),
        (4, 0.10),
        (5, 0.05),
    ]

    for harmonic, amplitude in harmonics:
        harmonic_frequency = frequency * harmonic

        if harmonic_frequency < sample_rate / 2:
            signal += amplitude * np.sin(
                2 * np.pi * harmonic_frequency * time
            )

    signal /= sum(
        amplitude for _, amplitude in harmonics
    )

    attack_samples = min(
        int(0.015 * sample_rate),
        sample_count // 2,
    )

    release_samples = min(
        int(0.030 * sample_rate),
        sample_count // 2,
    )

    if attack_samples > 0:
        signal[:attack_samples] *= np.linspace(
            0, 1, attack_samples
        )

    if release_samples > 0:
        signal[-release_samples:] *= np.linspace(
            1, 0, release_samples
        )

    return signal.astype(np.float32)


def generate_reference_audio(
    score_summary,
    start_measure=None,
    end_measure=None,
    performance_analysis=None,
    sample_rate=SAMPLE_RATE,
):
    """
    Generate WAV audio for a complete score or selected
    measure range.

    Returns:
        Dictionary containing:
        - audio_bytes: Generated WAV audio.
        - tempo_bpm: Selected playback tempo.
        - tempo_source: score, performance, or default.
        - duration_seconds: Generated audio duration.
    """

    if not score_summary:
        raise ValueError("No score information is available.")

    notes = score_summary.get("note_details") or []
    rests = score_summary.get("rest_details") or []

    if not notes:
        raise ValueError("No score notes are available.")

    if (start_measure is None) != (end_measure is None):
        raise ValueError(
            "start_measure and end_measure must be provided together."
        )

    if start_measure is not None:
        if start_measure < 1 or start_measure > end_measure:
            raise ValueError("Invalid measure range.")

        notes = [
            note for note in notes
            if start_measure <= note["measure"] <= end_measure
        ]

        rests = [
            rest for rest in rests
            if start_measure <= rest["measure"] <= end_measure
        ]

    if not notes:
        raise ValueError(
            "No score notes found in the selected measure range."
        )

    tempo_info = resolve_reference_tempo(
        score_summary,
        performance_analysis,
    )

    tempo_bpm = tempo_info["bpm"]
    seconds_per_quarter = 60.0 / tempo_bpm

    # Include written rests in the playback boundaries.
    events = notes + rests

    for event in events:
        offset = float(event["offset"])
        duration = float(event["duration"])

        if (
            not math.isfinite(offset)
            or not math.isfinite(duration)
            or offset < 0
            or duration < 0
        ):
            raise ValueError("Invalid score event timing.")

    start_offset = min(
        float(event["offset"]) for event in events
    )

    end_offset = max(
        float(event["offset"]) + float(event["duration"])
        for event in events
    )

    total_duration = (
        end_offset - start_offset
    ) * seconds_per_quarter

    if not math.isfinite(total_duration) or total_duration <= 0:
        raise ValueError("Invalid playable score duration.")

    if total_duration > MAX_DURATION_SECONDS:
        raise ValueError(
            "Selected reference audio exceeds the five-minute limit."
        )

    total_samples = int(
        math.ceil(total_duration * sample_rate)
    )

    audio = np.zeros(total_samples, dtype=np.float32)

    # Generate each note at its expected musical position.
    for note in notes:
        frequency = note_to_frequency(note["pitch"])

        onset = (
            float(note["offset"]) - start_offset
        ) * seconds_per_quarter

        duration = (
            float(note["duration"]) * seconds_per_quarter
        )

        note_audio = synthesize_note(
            frequency,
            duration,
            sample_rate,
        )

        start_sample = int(round(onset * sample_rate))

        end_sample = min(
            start_sample + len(note_audio),
            total_samples,
        )

        audio[start_sample:end_sample] += note_audio[
            :end_sample - start_sample
        ]

    # Normalize to prevent clipping.
    peak = float(np.max(np.abs(audio)))

    if peak > 0:
        audio = 0.8 * audio / peak

    pcm_audio = (audio * 32767).astype("<i2")

    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_audio.tobytes())

    return {
        "audio_bytes": buffer.getvalue(),
        "tempo_bpm": round(tempo_bpm, 2),
        "tempo_source": tempo_info["source"],
        "duration_seconds": round(
            total_samples / sample_rate, 3
        ),
    }