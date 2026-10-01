from music_analysis.alignment import align_notes
from music_analysis.timing_analysis import (
    analyze_missing_note_timing,
    compare_timing,
)


def analyze_performance(
        expected_events, 
        performed_events, 
        silence_regions=None, 
        seconds_per_beat=None, 
        performance_start=None,
):
    """
    Compare a performed sequence against the expected score.

    Expected events must contain:
        - pitch
        - offset
        - duration

    Performed events must contain:
        - pitch
        - onset
        - duration

    Returns alignment results, pitch/missing/additional errors,
    and timing results for corresponding notes.
    """

    expected_pitches = [
        event["pitch"]
        for event in expected_events
    ]

    performed_pitches = [
        event["pitch"]
        for event in performed_events
    ]

    alignment = align_notes(
        expected_pitches,
        performed_pitches
    )

    incorrect_pitch = []
    missing_notes = []
    additional_notes = []

    # Track positions in the original event lists.
    expected_index = 0
    performed_index = 0

    timing_expected = []
    timing_performed = []

    for item in alignment:
        operation = item["operation"]

        if operation == "match":
            timing_expected.append(
                expected_events[expected_index]
            )
            timing_performed.append(
                performed_events[performed_index]
            )

            expected_index += 1
            performed_index += 1

        elif operation == "substitution":
            incorrect_pitch.append({
                "expected_note": item["expected_note"],
                "performed_note": item["performed_note"],
                "note_index": expected_index,
                "error_type": "incorrect_pitch"
            })

            timing_expected.append(
                expected_events[expected_index]
            )
            timing_performed.append(
                performed_events[performed_index]
            )

            expected_index += 1
            performed_index += 1

        elif operation == "deletion":
            missing_notes.append({
                "expected_note": item["expected_note"],
                "note_index": expected_index,
                "error_type": "missing_note"
            })

            expected_index += 1

        elif operation == "insertion":
            additional_notes.append({
                "performed_note": item["performed_note"],
                "performed_index": performed_index,
                "error_type": "additional_note"
            })

            performed_index += 1

    timing = None

    if len(timing_expected) >= 2:
        timing = compare_timing(
            timing_expected,
            timing_performed
        )

    missing_note_timing = []

    if (
        missing_notes
        and silence_regions is not None
        and seconds_per_beat is not None
        and performance_start is not None
    ):
        missing_indices = [
            note["note_index"]
            for note in missing_notes
        ]

        missing_note_timing = analyze_missing_note_timing(
            expected_events,
            missing_indices,
            silence_regions,
            seconds_per_beat,
            performance_start,
        )

    return {
        "alignment": alignment,
        "errors": {
            "incorrect_pitch": incorrect_pitch,
            "missing_notes": missing_notes,
            "additional_notes": additional_notes
        },
        "timing": timing,
        "missing_note_timing": missing_note_timing
    }