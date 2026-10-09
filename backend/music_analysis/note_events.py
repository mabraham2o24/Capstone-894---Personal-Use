
from collections import Counter

import librosa
import numpy as np


MIN_NOTE_DURATION = 0.15

PRIMARY_CONFIDENCE_THRESHOLD = 0.8
FALLBACK_CONFIDENCE_THRESHOLD = 0.3
MIN_FALLBACK_FRAMES = 2
MIN_PITCH_AGREEMENT = 0.8
MIN_RELATIVE_RMS = 0.15

HOP_LENGTH = 512


def is_valid_note_duration(duration):
    """
    Return True if a detected note event is long enough
    to be considered a valid note.
    """
    return duration >= MIN_NOTE_DURATION


def detect_silence_regions(
    file_path,
    silence_ratio=0.10,
    min_silence_duration=0.30
):
    """
    Detect sustained low-energy regions in an audio recording.

    Silence is defined relative to the recording's median RMS energy
    so that detection is less sensitive to overall recording volume.
    """

    audio, sample_rate = librosa.load(
        file_path,
        mono=True
    )

    audio, _ = librosa.effects.trim(
        audio,
        top_db=30
    )

    rms = librosa.feature.rms(
        y=audio,
        frame_length=2048,
        hop_length=512
    )[0]

    if len(rms) == 0:
        return []

    median_rms = np.median(rms)

    if median_rms <= 0:
        return []

    silence_threshold = (
        median_rms * silence_ratio
    )

    silent_frames = rms < silence_threshold

    silence_regions = []
    start_frame = None

    for frame_index, is_silent in enumerate(
        silent_frames
    ):
        if is_silent and start_frame is None:
            start_frame = frame_index

        elif not is_silent and start_frame is not None:
            start_time = librosa.frames_to_time(
                start_frame,
                sr=sample_rate,
                hop_length=512
            )

            end_time = librosa.frames_to_time(
                frame_index,
                sr=sample_rate,
                hop_length=512
            )

            duration = end_time - start_time

            if duration >= min_silence_duration:
                silence_regions.append({
                    "start": round(float(start_time), 3),
                    "end": round(float(end_time), 3),
                    "duration": round(float(duration), 3)
                })

            start_frame = None

    # Handle silence continuing through the final frame.
    if start_frame is not None:
        start_time = librosa.frames_to_time(
            start_frame,
            sr=sample_rate,
            hop_length=512
        )

        end_time = librosa.get_duration(
            y=audio,
            sr=sample_rate
        )

        duration = end_time - start_time

        if duration >= min_silence_duration:
            silence_regions.append({
                "start": round(float(start_time), 3),
                "end": round(float(end_time), 3),
                "duration": round(float(duration), 3)
            })

    return silence_regions


def detect_note_events(file_path):
    """
    Detect individual note events in a monophonic audio recording.

    Uses high-confidence pYIN pitch estimates first.

    If an onset segment has no high-confidence pitch frames,
    a lower-confidence fallback may be used when:
        - At least 2 valid fallback frames are available.
        - At least 80% agree on the pitch.
        - Segment RMS is at least 15% of recording RMS.

    Returns a list of dictionaries containing:
        - pitch
        - onset
        - duration
    """

    # ---------------------------------------------------------
    # 1. Load and trim audio
    # ---------------------------------------------------------

    audio, sample_rate = librosa.load(
        file_path,
        mono=True
    )

    audio, _ = librosa.effects.trim(
        audio,
        top_db=30
    )

    if len(audio) == 0:
        return []

    recording_rms = float(
        np.sqrt(np.mean(audio ** 2))
    )

    if recording_rms == 0:
        return []

    # ---------------------------------------------------------
    # 2. Detect note onsets
    # ---------------------------------------------------------

    onset_frames = librosa.onset.onset_detect(
        y=audio,
        sr=sample_rate,
        hop_length=HOP_LENGTH,
        backtrack=True
    )

    onset_times = librosa.frames_to_time(
        onset_frames,
        sr=sample_rate,
        hop_length=HOP_LENGTH
    )

    # ---------------------------------------------------------
    # 3. Detect frame-level pitches
    # ---------------------------------------------------------

    frequencies, voiced_flag, voiced_prob = librosa.pyin(
        audio,
        fmin=librosa.note_to_hz("C3"),
        fmax=librosa.note_to_hz("C6"),
        sr=sample_rate,
        hop_length=HOP_LENGTH
    )

    audio_duration = librosa.get_duration(
        y=audio,
        sr=sample_rate
    )

    note_events = []

    # ---------------------------------------------------------
    # 4. Analyze each onset segment
    # ---------------------------------------------------------

    for index, onset_frame in enumerate(onset_frames):

        if index + 1 < len(onset_frames):
            end_frame = onset_frames[index + 1]
            end_time = float(onset_times[index + 1])
        else:
            end_frame = len(frequencies)
            end_time = float(audio_duration)

        onset = float(onset_times[index])
        duration = end_time - onset

        if not is_valid_note_duration(duration):
            continue

        segment_frequencies = frequencies[
            onset_frame:end_frame
        ]

        segment_voiced = voiced_flag[
            onset_frame:end_frame
        ]

        segment_probabilities = voiced_prob[
            onset_frame:end_frame
        ]

        # -----------------------------------------------------
        # 5. Primary high-confidence pitch detection
        # -----------------------------------------------------

        primary_frequencies = [
            frequency
            for frequency, voiced, probability in zip(
                segment_frequencies,
                segment_voiced,
                segment_probabilities
            )
            if (
                voiced
                and np.isfinite(frequency)
                and probability >= PRIMARY_CONFIDENCE_THRESHOLD
            )
        ]

        if primary_frequencies:

            # Use the median to reduce the influence
            # of brief pitch fluctuations.
            median_frequency = np.median(
                primary_frequencies
            )

            pitch = librosa.hz_to_note(
                median_frequency,
                unicode=False
            )

        else:

            # -------------------------------------------------
            # 6. Low-confidence pitch fallback
            # -------------------------------------------------

            fallback_frequencies = [
                frequency
                for frequency, voiced, probability in zip(
                    segment_frequencies,
                    segment_voiced,
                    segment_probabilities
                )
                if (
                    voiced
                    and np.isfinite(frequency)
                    and probability >= FALLBACK_CONFIDENCE_THRESHOLD
                )
            ]

            if len(fallback_frequencies) < MIN_FALLBACK_FRAMES:
                continue

            fallback_pitches = [
                librosa.hz_to_note(
                    frequency,
                    unicode=False
                )
                for frequency in fallback_frequencies
            ]

            pitch_counts = Counter(
                fallback_pitches
            )

            dominant_pitch, dominant_count = (
                pitch_counts.most_common(1)[0]
            )

            pitch_agreement = (
                dominant_count / len(fallback_pitches)
            )

            if pitch_agreement < MIN_PITCH_AGREEMENT:
                continue

            # -------------------------------------------------
            # 7. RMS energy safeguard
            # -------------------------------------------------

            start_sample = int(onset * sample_rate)
            end_sample = int(end_time * sample_rate)

            segment_audio = audio[
                start_sample:end_sample
            ]

            if len(segment_audio) == 0:
                continue

            segment_rms = float(
                np.sqrt(np.mean(segment_audio ** 2))
            )

            relative_rms = (
                segment_rms / recording_rms
            )

            # Reject low-energy fallback detections.
            if relative_rms < MIN_RELATIVE_RMS:
                continue

            pitch = dominant_pitch

        # -----------------------------------------------------
        # 8. Store the detected note event
        # -----------------------------------------------------

        note_events.append({
            "pitch": pitch,
            "onset": round(onset, 3),
            "duration": round(duration, 3)
        })

    return note_events
