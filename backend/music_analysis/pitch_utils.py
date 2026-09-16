NOTE_TO_SEMITONE = {
    "C": 0,
    "C#": 1,
    "D": 2,
    "D#": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "G": 7,
    "G#": 8,
    "A": 9,
    "A#": 10,
    "B": 11
}


def note_to_midi(note):
    """
    Convert a note name such as C4 or F#4 to its MIDI note number.
    """

    # Last character represents the octave
    octave = int(note[-1])

    # Everything before the octave is the pitch name
    pitch = note[:-1]

    if pitch not in NOTE_TO_SEMITONE:
        raise ValueError(f"Invalid note: {note}")

    return 12 * (octave + 1) + NOTE_TO_SEMITONE[pitch]


def pitch_distance(expected_note, performed_note):
    """
    Calculate the pitch difference between two notes in semitones.
    """

    expected_midi = note_to_midi(expected_note)
    performed_midi = note_to_midi(performed_note)

    return abs(expected_midi - performed_midi)