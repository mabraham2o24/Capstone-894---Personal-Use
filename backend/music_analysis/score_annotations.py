"""
Error annotations for the Annotated Sheet Music view.

Turns note-level feedback into the errors to show on the rendered
score. Each annotated note carries the fields that locate it in the
MusicXML (part, measure, position within the measure, and MIDI pitch),
so the frontend can find the exact notehead to highlight.
"""

from music_analysis.feedback_formatter import NOTE_LOCATION_FIELDS


def _article(note_length):
    """Return 'an' or 'a' for a note-length name."""
    return "an" if note_length[:1].lower() in "aeiou" else "a"


def _duration_description(item, too_short):
    expected = item.get("expected_note_length")
    played = item.get("played_note_length")
    direction = "short" if too_short else "long"

    if expected and played and expected != played:
        return (
            f"Held too {direction}: expected {_article(expected)} "
            f"{expected}, played about {_article(played)} {played}."
        )

    if expected:
        return f"Held too {direction} for {_article(expected)} {expected}."

    return f"Held too {direction}."


def _missing_description(item):
    behavior = item.get("missing_note_behavior")

    if behavior == "paused":
        return "This note was not played; there was a pause in its place."

    if behavior == "continued":
        return (
            "This note was not played; the performance continued "
            "to the next note without a pause."
        )

    return "This note was not played."


def _note_errors(item):
    """Return the errors recorded for one expected note."""
    errors = []

    pitch_status = item.get("pitch_status")

    if pitch_status == "missing":
        errors.append({
            "type": "missing_note",
            "category": "missing",
            "description": _missing_description(item),
        })

    elif pitch_status == "incorrect":
        errors.append({
            "type": "incorrect_pitch",
            "category": "pitch",
            "description": (
                f"Played {item.get('played_note')} instead of "
                f"{item.get('expected_note')}."
            ),
        })

    timing_status = item.get("timing_status")

    if timing_status == "early":
        errors.append({
            "type": "early",
            "category": "timing",
            "description": "Played early.",
        })

    elif timing_status == "late":
        errors.append({
            "type": "late",
            "category": "timing",
            "description": "Played late.",
        })

    duration_status = item.get("duration_status")

    if duration_status in ("too_short", "too_long"):
        errors.append({
            "type": duration_status,
            "category": "duration",
            "description": _duration_description(
                item,
                too_short=duration_status == "too_short",
            ),
        })

    return errors


def build_score_annotations(note_feedback):
    """
    Build sheet-music annotations from note-level feedback.

    Args:
        note_feedback: Items from format_note_feedback.

    Returns:
        Dictionary containing:
            - notes: one entry per score note with at least one error,
              with its location fields and a list of errors
            - additional_notes: notes played that are not in the score,
              located by measure and beat only

    Feedback without a note_id (from scores uploaded before notes were
    located in the score) cannot be placed on the sheet music and is
    left out.
    """
    notes = []
    additional_notes = []

    for item in note_feedback or []:
        if item.get("pitch_status") == "additional":
            played = item.get("played_note")

            additional_notes.append({
                "measure": item.get("measure"),
                "beat": item.get("beat"),
                "played_note": played,
                "description": (
                    f"An extra {played} was played that is not in the score."
                ),
            })
            continue

        if not item.get("note_id"):
            continue

        errors = _note_errors(item)

        if not errors:
            continue

        notes.append({
            **{
                field: item.get(field)
                for field in NOTE_LOCATION_FIELDS
            },
            "measure": item.get("measure"),
            "beat": item.get("beat"),
            "expected_note": item.get("expected_note"),
            "played_note": item.get("played_note"),
            "errors": errors,
        })

    return {
        "notes": notes,
        "additional_notes": additional_notes,
    }
