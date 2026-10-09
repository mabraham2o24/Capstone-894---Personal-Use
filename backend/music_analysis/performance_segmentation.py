"""
Score-aware segmentation of detected audio events.

The low-level audio detector can produce multiple acoustic events for a
single musical note because of bow changes, pitch transitions, or other
performance artifacts.

This module uses the expected MusicXML note positions to interpret those
raw events as musical notes.
"""


import statistics


DEFAULT_TIMING_TOLERANCE_RATIO = 0.55
DEFAULT_FRAGMENT_GAP = 0.75


def _estimate_seconds_per_beat(expected_events, detected_events):
    """
    Estimate the performed duration of one quarter-note beat.

    The score provides positions in quarter-note units. Since the Canon
    score has no tempo marking, estimate the performance tempo from the
    total performed span.
    """
    if len(expected_events) < 2:
        raise ValueError(
            "At least two expected events are required."
        )

    if len(detected_events) < 2:
        raise ValueError(
            "At least two detected events are required."
        )

    expected_span = (
        expected_events[-1]["offset"]
        - expected_events[0]["offset"]
    )

    performed_span = (
        detected_events[-1]["onset"]
        - detected_events[0]["onset"]
    )

    if expected_span <= 0:
        raise ValueError(
            "Expected events must span a positive duration."
        )

    if performed_span <= 0:
        raise ValueError(
            "Detected events must span a positive duration."
        )

    return performed_span / expected_span


def _group_acoustic_events(
    detected_events,
    max_fragment_gap=DEFAULT_FRAGMENT_GAP
):
    """
    Group nearby raw events having the same pitch.

    This reduces bow/pitch-detection fragments without assuming that
    every raw onset represents a separate musical note.
    """
    if not detected_events:
        return []

    groups = []

    for event in detected_events:
        onset = float(event["onset"])
        duration = float(event.get("duration", 0.0))
        end = onset + duration
        pitch = event["pitch"]

        if not groups:
            groups.append({
                "pitch": pitch,
                "start": onset,
                "end": end,
                "events": [event],
            })
            continue

        previous = groups[-1]

        gap = onset - previous["end"]

        if (
            pitch == previous["pitch"]
            and gap <= max_fragment_gap
        ):
            previous["end"] = max(
                previous["end"],
                end
            )
            previous["events"].append(event)
        else:
            groups.append({
                "pitch": pitch,
                "start": onset,
                "end": end,
                "events": [event],
            })

    for group in groups:
        group["representative_onset"] = statistics.median(
            event["onset"]
            for event in group["events"]
        )

    return groups


def _overlaps_window(
    group,
    target,
    tolerance
):
    """
    Return True when an acoustic group overlaps the expected timing
    window for a musical note.
    """
    window_start = target - tolerance
    window_end = target + tolerance

    return (
        group["end"] >= window_start
        and group["start"] <= window_end
    )


def segment_performance(
    expected_events,
    detected_events,
    timing_tolerance_ratio=DEFAULT_TIMING_TOLERANCE_RATIO,
    max_fragment_gap=DEFAULT_FRAGMENT_GAP,
):
    """
    Convert low-level acoustic events into score-aware musical events.

    Args:
        expected_events:
            MusicXML note dictionaries containing pitch, offset, and
            duration.

        detected_events:
            Raw audio events containing pitch, onset, and duration.

        timing_tolerance_ratio:
            Fraction of one estimated beat used when searching for
            audio evidence around each expected note.

        max_fragment_gap:
            Maximum gap between same-pitch acoustic fragments before
            treating them as separate groups.

    Returns:
        Dictionary containing:
            - seconds_per_beat
            - tolerance
            - performed_events
            - missing_expected_indices
            - unmatched_events
    """

    if not expected_events:
        raise ValueError(
            "expected_events cannot be empty."
        )

    if not detected_events:
        return {
            "seconds_per_beat": None,
            "tolerance": None,
            "performed_events": [],
            "missing_expected_indices": list(
                range(len(expected_events))
            ),
            "unmatched_events": [],
        }

    seconds_per_beat = _estimate_seconds_per_beat(
        expected_events,
        detected_events
    )

    tolerance = (
        seconds_per_beat
        * timing_tolerance_ratio
    )

    groups = _group_acoustic_events(
        detected_events,
        max_fragment_gap=max_fragment_gap
    )

    first_expected_offset = expected_events[0]["offset"]
    first_detected_onset = detected_events[0]["onset"]

    expected_targets = []

    for index, expected in enumerate(expected_events):
        relative_offset = (
            expected["offset"]
            - first_expected_offset
        )

        target = (
            relative_offset
            * seconds_per_beat
            + first_detected_onset
        )

        expected_targets.append({
            "index": index,
            "target": target,
            "event": expected,
        })

    group_expected_counts = {}

    for group_index, group in enumerate(groups):
        count = 0

        for expected_info in expected_targets:
            expected = expected_info["event"]
            target = expected_info["target"]

            if expected["pitch"] != group["pitch"]:
                continue

            if _overlaps_window(
                group,
                target,
                tolerance
            ):
                count += 1

        group_expected_counts[group_index] = count

    performed_events = []
    matched_group_indices = set()
    matched_raw_events = set()
    missing_expected_indices = []

    for expected_info in expected_targets:

        expected = expected_info["event"]
        target = expected_info["target"]

        candidates = []

        for group_index, group in enumerate(groups):
            if group["pitch"] != expected["pitch"]:
                continue

            if not _overlaps_window(
                group,
                target,
                tolerance
            ):
                continue

            distance = abs(
                group["representative_onset"]
                - target
            )

            candidates.append(
                (distance, group_index)
            )

        if candidates:
            _, best_group_index = min(candidates)

            group = groups[best_group_index]

            raw_candidates = []

            for raw_index, raw_event in enumerate(
                group["events"]
            ):
                raw_key = (
                    best_group_index,
                    raw_index
                )

                if raw_key in matched_raw_events:
                    continue

                raw_distance = abs(
                    float(raw_event["onset"])
                    - target
                )

                if raw_distance <= tolerance:
                    raw_candidates.append(
                        (raw_distance, raw_index, raw_event)
                    )

            # A single acoustic group can legitimately cover two
            # expected occurrences of the same pitch. This happens
            # when an intervening expected note was skipped and the
            # performer continues directly into the repeated pitch.
            #
            # In that situation we create a score-positioned musical
            # event rather than treating all of the raw fragments as
            # one musical note.
            if raw_candidates:
                (
                    _,
                    best_raw_index,
                    best_raw_event,
                ) = min(raw_candidates)

                onset = best_raw_event["onset"]
                if (
                    group_expected_counts[
                        best_group_index
                    ] == 1
                ):
                    measured_duration = (
                        group["end"]
                        - group["start"]
                    )
                else:
                    measured_duration = (
                        best_raw_event.get(
                            "duration"
                        )
                    )

                inferred = False

                matched_raw_events.add(
                    (best_group_index, best_raw_index)
                )
            else:
                inferred = (
                    best_group_index
                    in matched_group_indices
                )
                if inferred:
                    onset = target
                    measured_duration = None
                else:
                    onset = group["representative_onset"]
                    measured_duration = (group["end"] - group["start"])

            performed_events.append({
                "pitch": expected["pitch"],
                "onset": round(float(onset), 3),
                "measured_onset": (
                    None
                    if inferred
                    else round(float(onset), 3)
                ),
                "duration": round(
                    float(expected["duration"])
                    * seconds_per_beat,
                    3,
                ),
                "measured_duration": (
                    None
                    if measured_duration is None
                    else round(
                        float(measured_duration),
                        3
                    )
                ),
                "inferred": inferred,
                "expected_index": expected_info["index"],
            })

            matched_group_indices.add(best_group_index)

        else:
            missing_expected_indices.append(
                expected_info["index"]
            )

    # Acoustic groups that were not used to explain an expected note
    # are candidates for additional/performed notes.
    unmatched_events = []

    for group_index, group in enumerate(groups):
        if group_index in matched_group_indices:
            continue

        representative = group["events"][
            len(group["events"]) // 2
        ]

        unmatched_events.append({
            "pitch": group["pitch"],
            "onset": round(
                float(group["representative_onset"]),
                3
            ),
            "duration": round(
                float(
                    group["end"] - group["start"]
                ),
                3
            ),
            "inferred": False,
            "source_event": representative,
        })

    # Combine expected-note matches and unmatched acoustic events
    # into chronological order.
    performed_events.extend(unmatched_events)

    performed_events.sort(
        key=lambda event: event["onset"]
    )

    return {
        "seconds_per_beat": round(
            float(seconds_per_beat),
            3
        ),
        "tolerance": round(
            float(tolerance),
            3
        ),
        "performed_events": performed_events,
        "missing_expected_indices": (
            missing_expected_indices
        ),
        "unmatched_events": unmatched_events,
    }