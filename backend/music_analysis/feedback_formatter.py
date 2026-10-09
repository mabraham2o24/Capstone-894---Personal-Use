from music_analysis.timing_analysis import classify_note_length

def format_note_feedback(expected_events, analysis):
    """
    Convert detailed performance analysis into musician-friendly
    per-note feedback for the frontend.
    """

    feedback = []

    alignment = analysis["alignment"]
    timing_results = (
        analysis["timing"]["results"]
        if analysis.get("timing")
        else []
    )
    duration_results = analysis.get(
        "duration_analysis",
        []
    )
    missing_timing_by_index = {
        result["expected_index"]: result
        for result in analysis.get("missing_note_timing", [])
    }

    expected_index = 0
    performed_index = 0

    for item in alignment:
        operation = item["operation"]

        if operation in ("match", "substitution"):
            expected = expected_events[expected_index]

            timing_result = next(
                (
                    result
                    for result in timing_results
                    if (
                        result.get("measure")
                        == expected.get("measure")
                        and result.get("beat")
                        == expected.get("beat")
                    )
                ),
                None,
            )

            duration_result = next(
                (
                    result
                    for result in duration_results
                    if (
                        result.get("measure")
                        == expected.get("measure")
                        and result.get("beat")
                        == expected.get("beat")
                    )
                ),
                None,
            )

            feedback.append({
                "measure": expected.get("measure"),
                "beat": expected.get("beat"),
                "expected_note": expected["pitch"],
                "played_note": item["performed_note"],
                "pitch_status": (
                    "correct"
                    if operation == "match"
                    else "incorrect"
                ),
                "expected_note_length": (
                    duration_result.get(
                        "expected_note_length"
                    )
                    if duration_result
                    else None
                ),
                "played_note_length": (
                    duration_result.get(
                        "played_note_length"
                    )
                    if duration_result
                    else None
                ),
                "duration_status": (
                    duration_result.get(
                        "duration_status"
                    )
                    if duration_result
                    else None
                ),
                "timing_status": (
                    timing_result.get("timing")
                    if timing_result
                    else None
                ),
            })

            expected_index += 1
            performed_index += 1

        elif operation == "deletion":
            expected_event = expected_events[expected_index]

            missing_timing = missing_timing_by_index.get(
                expected_index,
                {}
            )

            # Prefer local acoustic evidence when available.
            # An uncertain local result must remain uncertain.
            if "local_pause_detected" in missing_timing:
                pause_detected = missing_timing[
                    "local_pause_detected"
                ]
            else:
                pause_detected = missing_timing.get(
                    "pause_detected"
                )

            if pause_detected is True:
                missing_note_behavior = "paused"
            elif pause_detected is False:
                missing_note_behavior = "continued"
            else:
                missing_note_behavior = "unknown"

            feedback.append({
                "measure": expected_event.get("measure"),
                "beat": expected_event.get("beat"),
                "expected_note": expected_event["pitch"],
                "played_note": None,
                "pitch_status": "missing",
                "expected_note_length": classify_note_length(
                    expected_event["duration"]
                ),
                "played_note_length": None,
                "duration_status": None,
                "timing_status": None,
                "missing_note_behavior": missing_note_behavior,
                "missing_note_pause_duration": (
                    missing_timing.get(
                        "local_quiet_duration"
                    )
                ),
            })

            expected_index += 1

        elif operation == "insertion":
            additional_note = next(
                (
                    error
                    for error in analysis["errors"]["additional_notes"]
                    if error["performed_index"] == performed_index
                ),
                None,
            )

            feedback.append({
                "measure": (
                    additional_note.get("measure")
                    if additional_note is not None
                    else None
                ),
                "beat": (
                    additional_note.get("beat")
                    if additional_note is not None
                    else None
                ),
                "expected_note": None,
                "played_note": item["performed_note"],
                "pitch_status": "additional",
                "expected_note_length": None,
                "played_note_length": None,
                "duration_status": None,
                "timing_status": None,
            })

            performed_index += 1

    return feedback

