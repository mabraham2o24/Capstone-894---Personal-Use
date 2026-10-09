from music_analysis.alignment import align_notes
from music_analysis.timing_analysis import (
    analyze_local_missing_note_pauses,
    analyze_missing_note_timing,
    analyze_note_duration,
    compare_timing,
)

def calculate_pitch_accuracy(alignment):
    """
    Calculate pitch accuracy from aligned expected and performed notes.

    Returns individual pitch results for each expected note and an
    overall pitch-accuracy percentage.

    Substitutions and deletions reduce pitch accuracy.
    Insertions do not affect the metric because they do not correspond
    to an expected score note.
    """
    note_results = []
    correct_notes = 0

    for item in alignment:
        # Additional performed notes do not correspond to an expected note.
        if item["operation"] == "insertion":
            continue

        pitch_correct = item["operation"] == "match"

        if pitch_correct:
            correct_notes += 1

        note_results.append({
            "note_index": len(note_results),
            "expected_pitch": item["expected_note"],
            "performed_pitch": item["performed_note"],
            "pitch_correct": pitch_correct,
        })

    total_expected_notes = len(note_results)

    if total_expected_notes == 0:
        accuracy_percent = 0.0
    else:
        accuracy_percent = round(
            (correct_notes / total_expected_notes) * 100,
            2
        )

    return {
        "correct_notes": correct_notes,
        "total_expected_notes": total_expected_notes,
        "accuracy_percent": accuracy_percent,
        "note_results": note_results,
    }

def analyze_performance(
        expected_events,
        performed_events,
        silence_regions=None,
        seconds_per_beat=None,
        performance_start=None,
        audio_path=None,
        rest_details=None,
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
    duration_analysis = []

    for item in alignment:
        operation = item["operation"]

        if operation == "match":
            expected_event = expected_events[expected_index]
            performed_event = performed_events[performed_index]
            
            timing_expected.append(
                expected_events[expected_index]
            )
            timing_performed.append(
                performed_events[performed_index]
            )

            if seconds_per_beat is not None:
                is_inferred = performed_event.get("inferred", False)

                if not is_inferred:
                    performed_duration=performed_event.get(
                        "measured_duration",
                    )

                    if performed_duration is None:
                        performed_duration = performed_event["duration"]
                    
                    duration_result = analyze_note_duration(
                        expected_duration_beats=expected_event["duration"],
                        performed_duration_seconds=performed_duration,
                        seconds_per_beat=seconds_per_beat,
                    )

                    duration_analysis.append({
                        "pitch": expected_event["pitch"],
                        "measure": expected_event.get("measure"),
                        "beat": expected_event.get("beat"),
                        **duration_result,
                    })
    

            expected_index += 1
            performed_index += 1

        elif operation == "substitution":
            expected_event = expected_events[expected_index]
            performed_event = performed_events[performed_index]

            if seconds_per_beat is not None:
                is_inferred = performed_event.get("inferred", False)

                if not is_inferred:
                    performed_duration=performed_event.get(
                        "measured_duration"
                    )

                    if performed_duration is None:
                        performed_duration = performed_event["duration"]
                
                    duration_result = analyze_note_duration(
                        expected_duration_beats=expected_event["duration"],
                        performed_duration_seconds=performed_duration,
                        seconds_per_beat=seconds_per_beat,
                    )

                    duration_analysis.append({
                        "pitch": expected_event["pitch"],
                        "measure": expected_event.get("measure"),
                        "beat": expected_event.get("beat"),
                        **duration_result,
                    })

            incorrect_pitch.append({
                "expected_note": item["expected_note"],
                "performed_note": item["performed_note"],
                "note_index": expected_index,
                "measure": expected_event.get("measure"),
                "beat": expected_event.get("beat"),
                "expected_duration": expected_event["duration"],
                "performed_duration": performed_event["duration"],
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
            expected_event = expected_events[expected_index]
            missing_notes.append({
                "expected_note": item["expected_note"],
                "note_index": expected_index,
                "measure": expected_event.get("measure"),
                "beat": expected_event.get("beat"),
                "expected_duration": expected_event["duration"],
                "error_type": "missing_note"
            })

            expected_index += 1

        elif operation == "insertion":
            performed_event = performed_events[performed_index]

            additional_note = {
                "performed_note": item["performed_note"],
                "performed_index": performed_index,
                "performed_duration": performed_event["duration"],
                "error_type": "additional_note"
            }

            if (
                seconds_per_beat is not None
                and performance_start is not None
            ):
                relative_onset = (
                    performed_event["onset"] - performance_start
                )

                score_offset = (
                    expected_events[0]["offset"]
                    + relative_onset / seconds_per_beat
                )

                # Find the score event immediately before the extra note.
                previous_expected = None

                for expected_event in expected_events:
                    if expected_event["offset"] <= score_offset:
                        previous_expected = expected_event
                    else:
                        break

                if previous_expected is not None:
                    beat_offset = (
                        score_offset - previous_expected["offset"]
                    )

                    additional_note["measure"] = (
                        previous_expected.get("measure")
                    )

                    previous_beat = previous_expected.get("beat")

                    additional_note["beat"] = (
                        round(previous_beat + beat_offset, 2)
                        if previous_beat is not None
                        else None
                    )

            additional_notes.append(additional_note)

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

    # Optional local acoustic analysis around missing notes.
    # This complements the existing global silence analysis.
    if missing_notes and audio_path is not None:

        local_pause_results = analyze_local_missing_note_pauses(
            audio_path,
            alignment,
            performed_events,
            expected_notes=expected_events,
            rest_details=rest_details,
        )

        local_results_by_index = {
            result["expected_index"]: result
            for result in local_pause_results
        }

        # Preserve any existing global missing-note timing results.
        timing_by_index = {
            result["expected_index"]: result
            for result in missing_note_timing
        }

        for missing_note in missing_notes:
            note_index = missing_note["note_index"]

            local_result = local_results_by_index.get(
                note_index
            )

            if local_result is None:
                continue

            if note_index not in timing_by_index:
                timing_by_index[note_index] = {
                    "expected_index": note_index,
                    "pitch": missing_note["expected_note"],
                }

            timing_result = timing_by_index[note_index]

            timing_result["local_pause_detected"] = (
                local_result["pause_detected"]
            )

            timing_result["local_quiet_duration"] = (
                local_result["longest_quiet_duration"]
            )

            timing_result["local_quiet_intervals"] = (
                local_result["quiet_intervals"]
            )

            if "reason" in local_result:
                timing_result["local_pause_reason"] = (
                    local_result["reason"]
                )

        missing_note_timing = [
            timing_by_index[note["note_index"]]
            for note in missing_notes
            if note["note_index"] in timing_by_index
        ]

    pitch_accuracy = calculate_pitch_accuracy(alignment)

    return {
        "alignment": alignment,
        "errors": {
            "incorrect_pitch": incorrect_pitch,
            "missing_notes": missing_notes,
            "additional_notes": additional_notes
        },
        "pitch_accuracy": pitch_accuracy,
        "timing": timing,
        "missing_note_timing": missing_note_timing,
        "duration_analysis": duration_analysis,
    }