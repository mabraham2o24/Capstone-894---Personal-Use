import librosa
import numpy as np

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

            current_measured = performed.get("measured_onset")
            previous_measured = previous_performed.get("measured_onset")

            # Use segmented onsets when the measured onsets cannot
            # represent a reliable interval between these two notes.
            use_segmented_onsets = (
                current_measured is None
                or previous_measured is None
                or performed.get("inferred", False)
                or previous_performed.get("inferred", False)
                or current_measured == previous_measured
            )

            if use_segmented_onsets:
                current_onset = performed["onset"]
                previous_onset = previous_performed["onset"]
            else:
                current_onset = current_measured
                previous_onset = previous_measured
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


def analyze_local_missing_note_pauses(
    audio_path,
    alignment,
    performed_events,
    window_seconds=0.02,
    low_energy_ratio=0.15,
    min_quiet_duration=0.08,
    expected_notes=None,
    rest_details=None,
):
    """
    Analyze acoustic pauses surrounding missing notes.

    Uses dynamic-programming alignment to identify missing notes
    and their neighboring performed notes.

    Returns one result per missing expected note.

    pause_detected:
        True  - a qualifying quiet interval was detected
        False - no qualifying quiet interval was detected
        None  - insufficient evidence to classify
    """

    if window_seconds <= 0:
        raise ValueError("window_seconds must be positive.")

    if low_energy_ratio <= 0:
        raise ValueError("low_energy_ratio must be positive.")

    if min_quiet_duration <= 0:
        raise ValueError("min_quiet_duration must be positive.")

    audio, sample_rate = librosa.load(
        audio_path,
        mono=True,
    )

    audio, _ = librosa.effects.trim(
        audio,
        top_db=30,
    )

    if len(audio) == 0:
        return []

    recording_rms = float(
        np.sqrt(np.mean(audio ** 2))
    )

    if recording_rms <= 0:
        return []

    threshold = recording_rms * low_energy_ratio

    # Associate alignment operations with their original indices.
    mapped = []

    expected_index = 0
    performed_index = 0

    for item in alignment:
        operation = item["operation"]

        if operation == "deletion":
            mapped.append({
                "expected_index": expected_index,
                "performed_index": None,
                "operation": operation,
            })
            expected_index += 1

        elif operation == "insertion":
            mapped.append({
                "expected_index": None,
                "performed_index": performed_index,
                "operation": operation,
            })
            performed_index += 1

        elif operation in ("match", "substitution"):
            mapped.append({
                "expected_index": expected_index,
                "performed_index": performed_index,
                "operation": operation,
            })
            expected_index += 1
            performed_index += 1

        else:
            raise ValueError(
                f"Unsupported alignment operation: {operation}"
            )

    def measured_onset(event):
        onset = event.get("measured_onset")

        if onset is None:
            onset = event["onset"]

        return float(onset)

    def find_quiet_intervals(start_time, end_time):
        start_sample = max(
            0,
            int(start_time * sample_rate),
        )

        end_sample = min(
            len(audio),
            int(end_time * sample_rate),
        )

        segment = audio[start_sample:end_sample]

        window_size = max(
            1,
            int(window_seconds * sample_rate),
        )

        intervals = []
        quiet_start = None

        for start in range(
            0,
            len(segment) - window_size + 1,
            window_size,
        ):
            window = segment[start:start + window_size]

            rms = float(
                np.sqrt(np.mean(window ** 2))
            )

            window_time = (
                start_sample + start
            ) / sample_rate

            if rms < threshold:
                if quiet_start is None:
                    quiet_start = window_time

            elif quiet_start is not None:
                intervals.append({
                    "start": quiet_start,
                    "end": window_time,
                    "duration": window_time - quiet_start,
                })

                quiet_start = None

        if quiet_start is not None:
            analyzed_samples = (
                len(segment) // window_size
            ) * window_size

            end = (
                start_sample + analyzed_samples
            ) / sample_rate

            intervals.append({
                "start": quiet_start,
                "end": end,
                "duration": end - quiet_start,
            })

        return intervals

    results = []

    for position, item in enumerate(mapped):

        if item["operation"] != "deletion":
            continue

        missing_index = item["expected_index"]

        result = {
            "expected_index": missing_index,
            "pause_detected": None,
            "longest_quiet_duration": 0.0,
            "quiet_intervals": [],
        }

        # Matches and substitutions can both provide
        # useful measured timing anchors.
        valid_operations = ("match", "substitution")

        previous = next(
            (
                candidate
                for candidate in reversed(mapped[:position])
                if candidate["operation"] in valid_operations
            ),
            None,
        )

        following = next(
            (
                candidate
                for candidate in mapped[position + 1:]
                if candidate["operation"] in valid_operations
            ),
            None,
        )

        if previous is None or following is None:
            result["reason"] = (
                "Missing neighboring performed notes"
            )
            results.append(result)
            continue

        # A group of consecutive missing notes shares the same
        # neighboring timing anchors. A detected quiet interval
        # cannot reliably be assigned to one specific missing note.
        consecutive_deletions = (
            (
                position > 0
                and mapped[position - 1]["operation"] == "deletion"
            )
            or
            (
                position + 1 < len(mapped)
                and mapped[position + 1]["operation"] == "deletion"
            )
        )

        if consecutive_deletions:
            result["reason"] = (
                "Consecutive missing notes: pause attribution ambiguous"
            )
            results.append(result)
            continue

        previous_event = performed_events[
            previous["performed_index"]
        ]

        following_event = performed_events[
            following["performed_index"]
        ]

        # Inferred events do not provide reliable acoustic anchors.
        if (
            previous_event.get("inferred", False)
            or following_event.get("inferred", False)
        ):
            result["reason"] = "Inferred timing anchor"
            results.append(result)
            continue

        # Check whether a written rest overlaps the score interval
        # between the neighboring aligned notes.
        if expected_notes is not None and rest_details is not None:

            previous_index = previous["expected_index"]
            following_index = following["expected_index"]

            previous_note = expected_notes[previous_index]
            following_note = expected_notes[following_index]

            previous_offset = float(previous_note["offset"])
            following_offset = float(following_note["offset"])

            if following_offset <= previous_offset:
                result["reason"] = "Invalid score timing"
                results.append(result)
                continue

            overlapping_rests = []

            for rest in rest_details:
                rest_start = float(rest["offset"])
                rest_end = rest_start + float(rest["duration"])

                if (
                    rest_start < following_offset
                    and rest_end > previous_offset
                ):
                    overlapping_rests.append(rest)

            if overlapping_rests:
                result["reason"] = (
                    "Written rest makes pause attribution ambiguous"
                )
                result["overlapping_rests"] = overlapping_rests
                results.append(result)
                continue

        start_time = measured_onset(previous_event)
        end_time = measured_onset(following_event)

        if end_time <= start_time:
            result["reason"] = "Invalid neighboring note timing"
            results.append(result)
            continue

        quiet_intervals = find_quiet_intervals(
            start_time,
            end_time,
        )

        longest_quiet = max(
            (
                interval["duration"]
                for interval in quiet_intervals
            ),
            default=0.0,
        )

        result.update({
            "previous_expected_index": previous["expected_index"],
            "following_expected_index": following["expected_index"],
            "previous_pitch": previous_event["pitch"],
            "following_pitch": following_event["pitch"],
            "previous_onset": round(start_time, 3),
            "following_onset": round(end_time, 3),
            "longest_quiet_duration": round(longest_quiet, 3),
            "quiet_intervals": [
                {
                    "start": round(interval["start"], 3),
                    "end": round(interval["end"], 3),
                    "duration": round(interval["duration"], 3),
                }
                for interval in quiet_intervals
            ],
            "pause_detected": (
                longest_quiet >= min_quiet_duration
            ),
        })

        results.append(result)

    return results
