import pytest

from music_analysis.score_parser import (extract_expected_notes, extract_note_details, extract_tempo)


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

def test_note_details_invalid_part_index():
    with pytest.raises(ValueError):
        extract_note_details("sample.xml", part_index=99)


def test_extract_note_durations():
    notes = extract_note_details("sample.xml", part_index=0)

    # Make sure note details were extracted
    assert len(notes) > 0

    # Every extracted note should contain a positive duration
    for note in notes:
        assert "duration" in note
        assert isinstance(note["duration"], float)
        assert note["duration"] > 0


def test_extract_note_offsets():
    notes = extract_note_details("sample.xml", part_index=0)

    # Make sure note details were extracted
    assert len(notes) > 0

    # Every extracted note should contain a non-negative offset
    for note in notes:
        assert "offset" in note
        assert isinstance(note["offset"], float)
        assert note["offset"] >= 0

    # Notes should appear in chronological order
    offsets = [note["offset"] for note in notes]
    assert offsets == sorted(offsets)


def test_extract_tempo():
    tempo_bpm = extract_tempo("sample.xml")

    assert tempo_bpm is not None
    assert isinstance(tempo_bpm, float)
    assert tempo_bpm == 96.0