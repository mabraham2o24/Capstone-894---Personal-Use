from music_analysis.performance_segmentation import (
    segment_performance,
)


def test_matched_event_preserves_measured_duration():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
        },
        {
            "pitch": "E4",
            "offset": 2.0,
            "duration": 1.0,
        },
    ]

    detected = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.8,
        },
        {
            "pitch": "D4",
            "onset": 1.0,
            "duration": 1.5,
        },
        {
            "pitch": "E4",
            "onset": 2.0,
            "duration": 0.9,
        },
    ]

    result = segment_performance(
        expected,
        detected,
    )

    performed = result["performed_events"]

    assert performed[0]["measured_duration"] == 0.8
    assert performed[1]["measured_duration"] == 1.5
    assert performed[2]["measured_duration"] == 0.9


def test_inferred_event_has_no_measured_duration():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
        },
        {
            "pitch": "C4",
            "offset": 2.0,
            "duration": 1.0,
        },
    ]

    detected = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 2.5,
        },
        {
            "pitch": "D4",
            "onset": 3.0,
            "duration": 0.5,
        },
    ]

    result = segment_performance(
        expected,
        detected,
        timing_tolerance_ratio=1.0,
    )

    inferred_events = [
        event
        for event in result["performed_events"]
        if event.get("inferred")
    ]

    assert len(inferred_events) == 1
    assert inferred_events[0]["measured_duration"] is None

def test_repeated_same_pitch_notes_are_preserved():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "C4",
            "offset": 1.0,
            "duration": 1.0,
        },
        {
            "pitch": "C4",
            "offset": 2.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 3.0,
            "duration": 1.0,
        },
    ]

    detected = [
        {
            "pitch": "C4",
            "onset": 0.046,
            "duration": 1.045,
        },
        {
            "pitch": "C4",
            "onset": 1.161,
            "duration": 0.975,
        },
        {
            "pitch": "C4",
            "onset": 2.136,
            "duration": 1.045,
        },
        {
            "pitch": "D4",
            "onset": 3.320,
            "duration": 2.088,
        },
    ]

    result = segment_performance(
        expected,
        detected,
    )

    performed = result["performed_events"]

    assert len(performed) == 4

    assert [
        event["pitch"]
        for event in performed
    ] == [
        "C4",
        "C4",
        "C4",
        "D4",
    ]

    assert all(
        event["inferred"] is False
        for event in performed
    )

def test_fragmented_note_uses_full_acoustic_duration():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
        },
    ]

    detected = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.3,
        },
        {
            "pitch": "C4",
            "onset": 0.3,
            "duration": 0.4,
        },
        {
            "pitch": "C4",
            "onset": 0.7,
            "duration": 0.3,
        },
        {
            "pitch": "D4",
            "onset": 1.0,
            "duration": 1.0,
        },
    ]

    result = segment_performance(
        expected,
        detected,
    )

    performed = result["performed_events"]

    assert performed[0]["pitch"] == "C4"
    assert performed[0]["measured_duration"] == 1.0

def test_segmented_event_preserves_measured_onset():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
        },
    ]

    detected = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.4,
        },
        {
            "pitch": "C4",
            "onset": 0.4,
            "duration": 0.4,
        },
        {
            "pitch": "D4",
            "onset": 1.0,
            "duration": 0.8,
        },
    ]

    result = segment_performance(
        expected,
        detected,
    )

    first = result["performed_events"][0]

    assert first["pitch"] == "C4"
    assert first["measured_onset"] == 0.0