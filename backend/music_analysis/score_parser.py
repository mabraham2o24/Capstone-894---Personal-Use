from music21 import converter, tempo


def extract_expected_notes(file_path, part_index=0):
    """
    Extract expected notes from one part of a MusicXML score.

    Args:
        file_path: Path to the MusicXML file.
        part_index: Zero-based index of the part to extract.
                    Defaults to the first part.

    Returns:
        List of note names including octave.
    """

    score = converter.parse(file_path)

    if part_index < 0 or part_index >= len(score.parts):
        raise ValueError(
            f"Invalid part index {part_index}. "
            f"Score contains {len(score.parts)} parts."
        )

    part = score.parts[part_index]

    expected_notes = []

    for element in part.flatten().notes:
        if element.isNote:
            expected_notes.append(element.pitch.nameWithOctave)

    return expected_notes


def extract_note_details(file_path, part_index=0):
    """
    Extract pitch, duration, and offset information from one part
    of a MusicXML score.

    Args:
        file_path: Path to the MusicXML file.
        part_index: Zero-based index of the part to extract.
                    Defaults to the first part.

    Returns:
        List of dictionaries containing pitch, duration, and offset.
    """

    score = converter.parse(file_path)

    if part_index < 0 or part_index >= len(score.parts):
        raise ValueError(
            f"Invalid part index {part_index}. "
            f"Score contains {len(score.parts)} parts."
        )

    part = score.parts[part_index]

    note_details = []

    for element in part.flatten().notes:
        if element.isNote:
            note_details.append(
                {
                    "pitch": element.pitch.nameWithOctave,
                    "duration": float(element.duration.quarterLength),
                    "offset": float(element.offset),
                }
            )

    return note_details


def extract_tempo(file_path):
    """
    Extract the first available tempo marking from a MusicXML score.

    Args:
        file_path: Path to the MusicXML file.

    Returns:
        Tempo in beats per minute (BPM), or None if no tempo is found.
    """
    score = converter.parse(file_path)

    tempo_marks = list(
        score.flatten().getElementsByClass(tempo.MetronomeMark)
    )

    if not tempo_marks:
        return None

    bpm = tempo_marks[0].getQuarterBPM()

    if bpm is None:
        return None

    return float(bpm)