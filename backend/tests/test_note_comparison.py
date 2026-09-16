from music_analysis.note_comparison import compare_notes


def test_perfect_performance():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "D4", "E4", "F4", "G4"]

    result = compare_notes(expected, performed)

    assert result["accuracy"] == 100.0
    assert result["correct_notes"] == 5
    assert len(result["errors"]) == 0


def test_one_incorrect_pitch():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "D4", "F4", "F4", "G4"]

    result = compare_notes(expected, performed)

    assert result["accuracy"] == 80.0
    assert result["correct_notes"] == 4
    assert len(result["errors"]) == 1

    error = result["errors"][0]

    assert error["note_index"] == 2
    assert error["expected_note"] == "E4"
    assert error["performed_note"] == "F4"
    assert error["error_type"] == "incorrect_pitch"


def test_multiple_incorrect_pitches():
    expected = ["C4", "D4", "E4", "F4", "G4"]
    performed = ["C4", "E4", "F4", "F4", "A4"]

    result = compare_notes(expected, performed)

    assert result["accuracy"] == 40.0
    assert result["correct_notes"] == 2
    assert len(result["errors"]) == 3