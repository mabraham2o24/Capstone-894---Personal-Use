import librosa
import numpy as np


def detect_pitches(file_path):
    """
    Detect a sequence of pitches from a monophonic audio recording.

    Quiet sections are trimmed before pitch detection, and consecutive
    frames representing the same note are collapsed into one note.
    """

    # Load audio as mono
    audio, sample_rate = librosa.load(file_path, mono=True)

    # Remove quiet audio from the beginning and end
    audio, _ = librosa.effects.trim(
        audio,
        top_db=30
    )

    # Estimate fundamental frequency
    frequencies, voiced_flag, voiced_prob = librosa.pyin(
        audio,
        fmin=librosa.note_to_hz("C3"),
        fmax=librosa.note_to_hz("C6"),
        sr=sample_rate
    )

    frame_notes = []

    for frequency, voiced, probability in zip(
        frequencies,
        voiced_flag,
        voiced_prob
    ):
        # Ignore unvoiced or low-confidence frames
        if (
            not voiced
            or np.isnan(frequency)
            or probability < 0.8
        ):
            continue

        note = librosa.hz_to_note(
            frequency,
            unicode=False
        )

        frame_notes.append(note)

    # Collapse consecutive duplicate notes
    detected_notes = []

    for note in frame_notes:
        if not detected_notes or note != detected_notes[-1]:
            detected_notes.append(note)

    return detected_notes