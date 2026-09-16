from music21 import converter


def extract_expected_notes(file_path):
    """
    Extract the expected note sequence from a MusicXML file.

    Args:
        file_path: Path to the MusicXML file.

    Returns:
        List of note names including octave.
        Example: ["C4", "D4", "E4", "F4"]
    """

    score = converter.parse(file_path)

    expected_notes = []

    for element in score.flatten().notes:
        if element.isNote:
            expected_notes.append(element.pitch.nameWithOctave)

    return expected_notes