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