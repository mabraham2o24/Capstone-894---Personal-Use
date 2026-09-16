def compare_notes(expected, performed):
    """
    Compare an expected sequence of notes with a performed sequence.

    This initial version assumes the two sequences are aligned
    and contain the same number of notes.
    """

    errors = []
    correct_notes = 0

    for index, (expected_note, performed_note) in enumerate(
        zip(expected, performed)
    ):
        if expected_note == performed_note:
            correct_notes += 1
        else:
            errors.append({
                "note_index": index,
                "expected_note": expected_note,
                "performed_note": performed_note,
                "error_type": "incorrect_pitch"
            })

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