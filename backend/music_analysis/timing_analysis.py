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

    performed_start = performed_events[0]["onset"]
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

    for expected, performed in zip(
        expected_events,
        performed_events
    ):
        relative_score_offset = (
            expected["offset"] - expected_start
        )

        expected_onset = (
            relative_score_offset * seconds_per_beat
        )

        performed_onset = (
            performed["onset"] - performed_start
        )

        difference = performed_onset - expected_onset

        if difference < -tolerance:
            timing = "early"
        elif difference > tolerance:
            timing = "late"
        else:
            timing = "on_time"

        results.append({
            "pitch": expected["pitch"],
            "expected_onset": round(expected_onset, 3),
            "performed_onset": round(performed_onset, 3),
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