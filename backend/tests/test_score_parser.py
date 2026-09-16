from music_analysis.score_parser import extract_expected_notes


def test_extract_expected_notes():
    notes = extract_expected_notes("sample.xml")

    # Make sure notes were extracted
    assert len(notes) > 0

    # Check the first few notes from sample.xml
    assert notes[0] == "C#5"
    assert notes[1] == "E4"
    assert notes[2] == "A3"


def test_extracted_notes_are_strings():
    notes = extract_expected_notes("sample.xml")

    for note in notes:
        assert isinstance(note, str)