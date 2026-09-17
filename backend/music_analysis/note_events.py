import librosa
import numpy as np

MIN_NOTE_DURATION = 0.15


def is_valid_note_duration(duration):
    """
    Return True if a detected note event is long enough
    to be considered a valid note.
    """
    return duration >= MIN_NOTE_DURATION

def detect_note_events(file_path):
    """
    Detect individual note events in a monophonic audio recording.

    Each returned event contains:
        - pitch
        - onset time in seconds
        - duration in seconds
    """

    audio, sample_rate = librosa.load(file_path, mono=True)

    # Trim quiet audio at the beginning and end
    audio, _ = librosa.effects.trim(
        audio,
        top_db=30
    )

    # Detect note onsets
    onset_frames = librosa.onset.onset_detect(
        y=audio,
        sr=sample_rate,
        backtrack=True
    )

    onset_times = librosa.frames_to_time(
        onset_frames,
        sr=sample_rate
    )

    # Detect frame-level pitches
    frequencies, voiced_flag, voiced_prob = librosa.pyin(
        audio,
        fmin=librosa.note_to_hz("C3"),
        fmax=librosa.note_to_hz("C6"),
        sr=sample_rate
    )

    note_events = []

    for index, onset_frame in enumerate(onset_frames):

        # End of this note is the next onset,
        # or the end of the recording for the final note.
        if index + 1 < len(onset_frames):
            end_frame = onset_frames[index + 1]
        else:
            end_frame = len(frequencies)

        segment_frequencies = frequencies[onset_frame:end_frame]
        segment_voiced = voiced_flag[onset_frame:end_frame]
        segment_probabilities = voiced_prob[onset_frame:end_frame]

        valid_frequencies = []

        for frequency, voiced, probability in zip(
            segment_frequencies,
            segment_voiced,
            segment_probabilities
        ):
            if (
                voiced
                and not np.isnan(frequency)
                and probability >= 0.8
            ):
                valid_frequencies.append(frequency)

        if not valid_frequencies:
            continue

        # Median is more resistant to brief pitch fluctuations
        # than selecting one individual frame.
        median_frequency = np.median(valid_frequencies)

        pitch = librosa.hz_to_note(
            median_frequency,
            unicode=False
        )

        onset = onset_times[index]

        if index + 1 < len(onset_times):
            end_time = onset_times[index + 1]
        else:
            end_time = librosa.get_duration(
                y=audio,
                sr=sample_rate
            )

        duration = end_time - onset

        # Ignore extremely short segments that are likely
        # caused by pitch transitions or onset-detection noise.
        if not is_valid_note_duration(duration):
            continue

        note_events.append({
            "pitch": pitch,
            "onset": round(float(onset), 3),
            "duration": round(float(duration), 3)
        })

    return note_events