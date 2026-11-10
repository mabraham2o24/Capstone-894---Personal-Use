from music_analysis.alignment import align_notes


def test_skipped_note():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "E4", "F4", "G4"]

    result = align_notes(expected, performed)

    assert result == [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match"
        },
        {
            "expected_note": "D4",
            "performed_note": None,
            "operation": "deletion"
        },
        {
            "expected_note": "E4",
            "performed_note": "E4",
            "operation": "match"
        },
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match"
        },
        {
            "expected_note": "G4",
            "performed_note": "G4",
            "operation": "match"
        }
    ]

def test_extra_note():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "D4", "E4", "D4", "F4", "G4"]

    result = align_notes(expected, performed)

    assert result == [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match"
        },
        {
            "expected_note": "D4",
            "performed_note": "D4",
            "operation": "match"
        },
        {
            "expected_note": "E4",
            "performed_note": "E4",
            "operation": "match"
        },
        {
            "expected_note": None,
            "performed_note": "D4",
            "operation": "insertion"
        },
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match"
        },
        {
            "expected_note": "G4",
            "performed_note": "G4",
            "operation": "match"
        }
    ]

def test_incorrect_pitch():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "D4", "F4", "F4", "G4"]

    result = align_notes(expected, performed)

    assert result == [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match"
        },
        {
            "expected_note": "D4",
            "performed_note": "D4",
            "operation": "match"
        },
        {
            "expected_note": "E4",
            "performed_note": "F4",
            "operation": "substitution"
        },
        {
            "expected_note": "F4",
            "performed_note": "F4",
            "operation": "match"
        },
        {
            "expected_note": "G4",
            "performed_note": "G4",
            "operation": "match"
        }
    ]

def test_identical_sequences_produce_only_matches():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "D4", "E4", "F4", "G4"]

    result = align_notes(expected, performed)

    assert len(result) == 5
    assert result == [
        {
            "expected_note": pitch,
            "performed_note": pitch,
            "operation": "match",
        }
        for pitch in expected
    ]


def test_multiple_extra_notes_produce_insertions():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "A4", "D4", "E4", "B4", "F4", "G4"]

    result = align_notes(expected, performed)

    assert [item["operation"] for item in result] == [
        "match",
        "insertion",
        "match",
        "match",
        "insertion",
        "match",
        "match",
    ]

    insertions = [
        item for item in result
        if item["operation"] == "insertion"
    ]

    assert insertions == [
        {
            "expected_note": None,
            "performed_note": "A4",
            "operation": "insertion",
        },
        {
            "expected_note": None,
            "performed_note": "B4",
            "operation": "insertion",
        },
    ]