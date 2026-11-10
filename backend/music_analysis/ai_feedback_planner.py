
"""Prepare verified performance data for AI practice feedback."""

from collections import Counter

import math


ERROR_LABELS = {
    "incorrect": "incorrect_pitch",
    "missing": "missing_note",
    "additional": "additional_note",
    "early": "early_note",
    "late": "late_note",
    "too_short": "short_duration",
    "too_long": "long_duration",
}

ERROR_PRIORITY = {
    "incorrect_pitch": 0,
    "missing_note": 0,
    "additional_note": 0,
    "late_note": 1,
    "early_note": 1,
    "short_duration": 2,
    "long_duration": 2,
}

PRACTICE_STRATEGIES = {
    "incorrect_pitch": {
        "technique": "reference_pitch_comparison",
        "method": (
            "Listen to the correct pitch from a reference source, "
            "then play the note and compare the two. Practice the "
            "transition from the preceding note slowly."
        ),
        "progression": (
            "Repeat the transition accurately three times, then "
            "reintroduce the surrounding passage."
        ),
    },
    "late_note": {
        "technique": "slow_tempo_rhythm_practice",
        "method": (
            "Start one beat before the late note. Clap the rhythm "
            "with a metronome, then play the same passage slowly."
        ),
        "progression": (
            "After three accurate repetitions, increase the "
            "metronome by 5 BPM."
        ),
    },
    "early_note": {
        "technique": "subdivision_practice",
        "method": (
            "Count or clap subdivisions before the early entry. "
            "Then play the passage with a metronome, waiting for "
            "the correct beat before starting the note."
        ),
        "progression": (
            "Increase the tempo by 5 BPM after three accurate "
            "repetitions."
        ),
    },
    "short_duration": {
        "technique": "note_sustain_practice",
        "method": (
            "Practice the affected note slowly while counting "
            "its full written duration aloud. Use a metronome "
            "to maintain the pulse."
        ),
        "progression": (
            "Once the note is sustained correctly three times, "
            "practice it within the complete measure."
        ),
    },
    "long_duration": {
        "technique": "controlled_note_release",
        "method": (
            "Practice releasing the note precisely at its "
            "written duration. Count aloud and use a metronome "
            "to avoid holding the note too long."
        ),
        "progression": (
            "Practice the transition into the following note "
            "at gradually increasing tempos."
        ),
    },
    "missing_note": {
        "technique": "passage_reconstruction",
        "method": (
            "Isolate the missing note and the notes immediately "
            "before and after it. Practice the short sequence "
            "slowly while counting each note."
        ),
        "progression": (
            "Expand to the full measure once the sequence "
            "is accurate three times consecutively."
        ),
    },
    "additional_note": {
        "technique": "sequence_simplification",
        "method": (
            "Practice the written note sequence slowly, "
            "removing the unintended note. Compare the passage "
            "with the score before increasing speed."
        ),
        "progression": (
            "Increase the tempo gradually once the written "
            "sequence is consistently correct."
        ),
    },
}

def extract_metrics(summary):
    """Extract only numeric, supported accuracy percentages."""
    metrics = {}

    for name, value in (summary.get("metrics") or {}).items():
        if not isinstance(value, dict):
            continue

        percent = value.get("accuracy_percent")

        if percent is None and name == "tempo_consistency":
            percent = value.get("consistency_percent")

        if (
            isinstance(percent, (int, float))
            and not isinstance(percent, bool)
            and 0 <= percent <= 100
        ):
            metrics[name] = float(percent)

    return metrics


def extract_errors(summary):
    """Extract actual note-level errors with known locations."""
    errors = []

    for note in summary.get("note_feedback") or []:
        measure = note.get("measure")
        beat = note.get("beat")

        for field in (
            "pitch_status",
            "timing_status",
            "duration_status",
        ):
            status = note.get(field)
            error_type = ERROR_LABELS.get(status)

            if error_type is not None:
                errors.append({
                    "measure": measure,
                    "beat": beat,
                    "error_type": error_type,
                })

    return errors

def build_tempo_practice_plan(score_summary):
    """Create a gradual practice progression from verified score tempo."""
    if not isinstance(score_summary, dict):
        return None

    score_bpm = score_summary.get("tempo_bpm")

    if (
        isinstance(score_bpm, bool)
        or not isinstance(score_bpm, (int, float))
        or not math.isfinite(score_bpm)
        or score_bpm <= 0
    ):
        return None

    score_bpm = float(score_bpm)

    # Begin at 60% of the score tempo, rounded to a whole BPM.
    starting_bpm = max(1, round(score_bpm * 0.60))

    # Avoid a starting tempo above the score tempo.
    starting_bpm = min(starting_bpm, max(1, round(score_bpm)))

    return {
        "score_bpm": score_bpm,
        "starting_bpm": starting_bpm,
        "increment_bpm": 10,
        "advance_after_accurate_repetitions": 3,
    }

def build_feedback_plan(summary, score_summary=None):
    """Build grounded inputs for the local language model."""
    if not isinstance(summary, dict):
        raise ValueError("A performance summary is required.")

    metrics = extract_metrics(summary)

    errors = sorted(
        extract_errors(summary),
        key=lambda error: ERROR_PRIORITY.get(
            error["error_type"], 99
        ),
    )


    # Select up to three unique errors, prioritizing pitch and note errors.
    selected_errors = []
    seen = set()

    for error in errors:
        key = (error["measure"], error["error_type"])

        if key in seen:
            continue

        seen.add(key)
        selected_errors.append(error)

        if len(selected_errors) == 3:
            break


    weakest_metric = (
        min(metrics, key=metrics.get)
        if metrics else None
    )

    error_counts = Counter(
        error["error_type"] for error in errors
    )

    problem_measures = sorted({
        area["measure"]
        for area in summary.get("problem_areas") or []
        if isinstance(area.get("measure"), int)
    })

    goal = None

    if weakest_metric is not None:
        current = metrics[weakest_metric]
        target = min(100.0, current + 5.0)

        goal = {
            "metric": weakest_metric,
            "current_percent": current,
            "target_percent": target,
        }

    tempo_practice = build_tempo_practice_plan(score_summary)

    practice_candidates = []

    for error in errors:
        strategy = PRACTICE_STRATEGIES.get(error["error_type"])

        if strategy is None:
            continue

        practice_candidates.append({
            "measure": error["measure"],
            "beat": error["beat"],
            "error_type": error["error_type"],
            "technique": strategy["technique"],
            "method": strategy["method"],
            "progression": strategy["progression"],
        })
    return {
        "metrics": metrics,
        "weakest_metric": weakest_metric,
        "detected_errors": errors,
        "selected_errors": selected_errors,
        "error_counts": dict(error_counts),
        "problem_measures": problem_measures,
        "tempo_practice": tempo_practice,
        "practice_candidates": practice_candidates,
        "suggested_goal": goal,
    }
