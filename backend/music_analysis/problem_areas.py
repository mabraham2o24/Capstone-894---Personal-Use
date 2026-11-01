
from collections import defaultdict


def identify_problem_areas(
    expected_events,
    note_feedback,
    min_error_notes=2,
    min_error_rate=0.40,
):
    """
    Identify measures requiring additional practice.

    A measure is flagged when it contains at least
    min_error_notes erroneous notes OR its error
    rate reaches min_error_rate.
    """

    measures = defaultdict(
        lambda: {
            "total_notes": 0,
            "error_notes": 0,
            "expected_error_notes": 0,
            "error_types": defaultdict(int),
            "error_locations": [],
        }
    )

    # Count expected notes per measure.
    for event in expected_events:
        measure = event.get("measure")
        if measure is not None:
            measures[measure]["total_notes"] += 1

    # Evaluate existing note-level feedback.
    for note in note_feedback:
        measure = note.get("measure")
        if measure is None:
            continue

        errors = []

        pitch = note.get("pitch_status")
        timing = note.get("timing_status")
        duration = note.get("duration_status")

        if pitch in ("incorrect", "missing", "additional"):
            errors.append(pitch)

        if timing in ("early", "late"):
            errors.append("timing")

        if duration in ("too_short", "too_long"):
            errors.append("duration")

        if not errors:
            continue

        result = measures[measure]
        result["error_notes"] += 1

        if pitch != "additional":
            result["expected_error_notes"] += 1

        for error in errors:
            result["error_types"][error] += 1

        result["error_locations"].append({
            "beat": note.get("beat"),
            "expected_note": note.get("expected_note"),
            "played_note": note.get("played_note"),
            "errors": errors,
        })

    problem_areas = []

    for measure, result in sorted(measures.items()):
        total = result["total_notes"]
        errors = result["error_notes"]

        rate = (
            result["expected_error_notes"] / total
            if total else 0.0
        )

        if errors >= min_error_notes or (
            total > 0 and rate >= min_error_rate
        ):
            problem_areas.append({
                "measure": measure,
                "total_notes": total,
                "error_notes": errors,
                "error_rate": round(rate, 3),
                "error_types": dict(result["error_types"]),
                "error_locations": result["error_locations"],
                "requires_practice": True,
            })

    return problem_areas
