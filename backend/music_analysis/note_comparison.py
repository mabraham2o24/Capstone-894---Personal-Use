from music_analysis.alignment import align_notes


def compare_notes(expected, performed):
    """
    Compare an expected note sequence with a performed sequence
    using sequence alignment.

    Detects:
        - correct notes
        - incorrect pitches
        - missing notes
        - additional notes
    """

    alignment = align_notes(expected, performed)

    errors = []
    correct_notes = 0
    expected_index = 0
    performed_index = 0

    for item in alignment:
        operation = item["operation"]

        if operation == "match":
            correct_notes += 1
            expected_index += 1
            performed_index += 1

        elif operation == "substitution":
            errors.append({
                "note_index": expected_index,
                "expected_note": item["expected_note"],
                "performed_note": item["performed_note"],
                "error_type": "incorrect_pitch"
            })
            expected_index += 1
            performed_index += 1

        elif operation == "deletion":
            errors.append({
                "note_index": expected_index,
                "expected_note": item["expected_note"],
                "performed_note": None,
                "error_type": "missing_note"
            })
            expected_index += 1

        elif operation == "insertion":
            errors.append({
                "note_index": expected_index,
                "expected_note": None,
                "performed_note": item["performed_note"],
                "error_type": "additional_note"
            })
            performed_index += 1

    total_notes = len(expected)

    accuracy = (
        correct_notes / total_notes * 100
        if total_notes > 0
        else 0
    )

    return {
        "total_notes": total_notes,
        "correct_notes": correct_notes,
        "accuracy": accuracy,
        "errors": errors
    }