
def generate_performance_summary(
    performance_analysis,
    note_feedback,
    problem_areas,
):
    """
    Consolidate existing performance analysis into a
    frontend-ready summary without recalculating metrics.
    """

    if performance_analysis is None:
        return None

    errors = performance_analysis.get("errors") or {}

    incorrect_pitch = errors.get("incorrect_pitch") or []
    missing_notes = errors.get("missing_notes") or []
    additional_notes = errors.get("additional_notes") or []

    feedback = note_feedback or []
    areas = problem_areas or []

    return {
        "metrics": {
            "pitch_accuracy": performance_analysis.get(
                "pitch_accuracy"
            ),
            "rhythmic_accuracy": performance_analysis.get(
                "rhythmic_accuracy"
            ),
            "tempo_consistency": performance_analysis.get(
                "tempo_consistency"
            ),
            "note_sequence_accuracy": performance_analysis.get(
                "note_sequence_accuracy"
            ),
        },
        "error_counts": {
            "incorrect_pitch": len(incorrect_pitch),
            "missing_notes": len(missing_notes),
            "additional_notes": len(additional_notes),
        },
        "detected_errors": {
            "incorrect_pitch": incorrect_pitch,
            "missing_notes": missing_notes,
            "additional_notes": additional_notes,
        },
        "note_feedback": feedback,
        "problem_areas": areas,
        "problem_area_count": len(areas),
    }
