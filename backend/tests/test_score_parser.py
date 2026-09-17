import pytest

from music_analysis.score_parser import extract_expected_notes


def test_extract_expected_notes_from_first_part():
    notes = extract_expected_notes("sample.xml", part_index=0)

    # Make sure notes were extracted
    assert len(notes) > 0

    # Verify the first notes from Part 0 of sample.xml
    assert notes[:10] == [
        "C#5",
        "B4",
        "A4",
        "B4",
        "C#5",
        "E5",
        "C#5",
        "B4",
        "A4",
        "C#5"
    ]


def test_extracted_notes_are_strings():
    notes = extract_expected_notes("sample.xml", part_index=0)

    for note in notes:
        assert isinstance(note, str)


def test_invalid_part_index():
    with pytest.raises(ValueError):
        extract_expected_notes("sample.xml", part_index=99)