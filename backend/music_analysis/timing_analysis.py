def classify_note_length(duration_beats):
    """
    Convert a duration in quarter-note units into a
    musician-friendly note length.

    Examples:
        0.25 -> sixteenth note
        0.5  -> eighth note
        1.0  -> quarter note
        2.0  -> half note
        4.0  -> whole note

    The closest standard note length is returned so that small
    performance variations still map to a familiar musical value.
    """

    if duration_beats <= 0:
        raise ValueError(
            "Note duration must be greater than zero."
        )

    note_lengths = {
        0.25: "sixteenth note",
        0.5: "eighth note",
        1.0: "quarter note",
        1.5: "dotted quarter note",
        2.0: "half note",
        3.0: "dotted half note",
        4.0: "whole note",
    }

    closest_duration = min(
        note_lengths,
        key=lambda value: abs(value - duration_beats)
    )

    return note_lengths[closest_duration]

def analyze_note_duration(
    expected_duration_beats,
    performed_duration_seconds,
    seconds_per_beat,
    tolerance_ratio=0.20,
):
    """
    Compare an expected musical note duration with the duration
    actually performed.

    Expected duration is given in quarter-note units.
    Performed duration is given in seconds and converted to
    quarter-note units using seconds_per_beat.

    Returns musician-friendly note lengths and a duration status:
        - correct
        - too_short
        - too_long
    """

    if expected_duration_beats <= 0:
        raise ValueError(
            "Expected note duration must be greater than zero."
        )

    if performed_duration_seconds <= 0:
        raise ValueError(
            "Performed note duration must be greater than zero."
        )

    if seconds_per_beat <= 0:
        raise ValueError(
            "Seconds per beat must be greater than zero."
        )

    performed_duration_beats = (
        performed_duration_seconds / seconds_per_beat
    )

    lower_bound = (
        expected_duration_beats * (1 - tolerance_ratio)
    )

    upper_bound = (
        expected_duration_beats * (1 + tolerance_ratio)
    )

    if performed_duration_beats < lower_bound:
        duration_status = "too_short"
    elif performed_duration_beats > upper_bound:
        duration_status = "too_long"
    else:
        duration_status = "correct"

    return {
        "expected_note_length": classify_note_length(
            expected_duration_beats
        ),
        "played_note_length": classify_note_length(
            performed_duration_beats
        ),
        "duration_status": duration_status,
    }

def compare_timing(
    expected_events,
    performed_events,
    tolerance_ratio=0.20
):
    """
    Compare performed note onset times with expected rhythmic offsets.

    Expected events must contain:
        - pitch
        - offset (quarter-note units)

    Performed events must contain:
        - pitch
        - onset (seconds)

    The performance tempo is estimated from the first and last
    corresponding notes. Timing tolerance is a percentage of the
    estimated duration of one quarter-note beat.
    """

    if len(expected_events) != len(performed_events):
        raise ValueError(
            "Expected and performed events must already be aligned "
            "and contain the same number of corresponding notes."
        )

    if len(expected_events) < 2:
        raise ValueError(
            "At least two corresponding notes are required "
            "for timing analysis."
        )

    expected_start = expected_events[0]["offset"]
    expected_end = expected_events[-1]["offset"]

    performed_start = performed_events[0].get(
        "measured_onset"
    )

    if performed_start is None:
        performed_start = performed_events[0]["onset"]

    performed_end = performed_events[-1].get(
        "measured_onset"
    )

    if performed_end is None:
        performed_end = performed_events[-1]["onset"]

    expected_span = expected_end - expected_start

    if expected_span <= 0:
        raise ValueError(
            "Expected note offsets must span a positive duration."
        )

    seconds_per_beat = (
        performed_end - performed_start
    ) / expected_span

    tolerance = seconds_per_beat * tolerance_ratio

    results = []

    for index, (expected, performed) in enumerate(
        zip(expected_events, performed_events)
    ):
        # The first corresponding note establishes the
        # performance starting point, so it is on time by definition.
        if index == 0:
            expected_interval = 0.0
            performed_interval = 0.0
            difference = 0.0
            timing = "on_time"

        else:
            previous_expected = expected_events[index - 1]
            previous_performed = performed_events[index - 1]

            expected_interval_beats = (
                expected["offset"] - previous_expected["offset"]
            )

            expected_interval = (
                expected_interval_beats * seconds_per_beat
            )

            current_onset = performed.get(
                "measured_onset"
            )

            if current_onset is None:
                current_onset = performed["onset"]

            previous_onset = previous_performed.get(
                "measured_onset"
            )

            if previous_onset is None:
                previous_onset = previous_performed["onset"]

            performed_interval = (
                current_onset - previous_onset
            )

            difference = performed_interval - expected_interval

            if difference < -tolerance:
                timing = "early"
            elif difference > tolerance:
                timing = "late"
            else:
                timing = "on_time"

        results.append({
            "pitch": expected["pitch"],
            "measure": expected.get("measure"),
            "beat": expected.get("beat"),
            "expected_interval": round(expected_interval, 3),
            "performed_interval": round(performed_interval, 3),
            "timing_difference": round(difference, 3),
            "timing": timing
        })

    return {
        "seconds_per_beat": round(seconds_per_beat, 3),
        "tolerance": round(tolerance, 3),
        "results": results
    }

def analyze_missing_note_timing(
    expected_events,
    missing_expected_indices,
    silence_regions,
    seconds_per_beat,
    performance_start=0.0,
):
    """
    Determine whether a missing expected note coincides with an
    acoustic pause in the performance.

    A missing note is considered to contain a pause when a detected
    silence region overlaps the expected timing window for that note.
    """

    results = []

    if not missing_expected_indices:
        return results

    first_expected_offset = expected_events[0]["offset"]


    for index in missing_expected_indices:
        expected = expected_events[index]

        relative_offset = (
            expected["offset"] - first_expected_offset
        )

        expected_onset = (
            performance_start
            + relative_offset * seconds_per_beat
        )

        expected_duration = (
            expected["duration"] * seconds_per_beat
        )

        window_start = expected_onset
        window_end = (expected_onset + expected_duration)

        overlapping_silence = []

        for region in silence_regions:
            if (
                region["end"] >= window_start
                and region["start"] <= window_end
            ):
                overlapping_silence.append(region)

        results.append({
            "expected_index": index,
            "pitch": expected["pitch"],
            "measure": expected.get("measure"),
            "beat": expected.get("beat"),
            "expected_onset": round(
                float(expected_onset),
                3
            ),
            "pause_detected": bool(
                overlapping_silence
            ),
            "silence_regions": overlapping_silence,
        })

    return results