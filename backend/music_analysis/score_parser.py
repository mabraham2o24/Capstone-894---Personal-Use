from music21 import converter


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