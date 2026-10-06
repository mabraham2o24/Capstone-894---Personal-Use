from dbm import error

from music_analysis.performance_analysis import (
    analyze_performance,
    calculate_pitch_accuracy,
)


def make_expected(pitches):
    return [
        {
            "pitch": pitch,
            "offset": float(index),
            "duration": 1.0,
            "measure": 1,
            "beat": float (index + 1)
        }
        for index, pitch in enumerate(pitches)
    ]


def make_performed(pitches):
    return [
        {
            "pitch": pitch,
            "onset": float(index),
            "duration": 1.0
        }
        for index, pitch in enumerate(pitches)
    ]


def test_perfect_performance():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = make_performed(
        ["C4", "D4", "E4", "F4"]
    )

    result = analyze_performance(
        expected,
        performed
    )

    assert len(result["errors"]["incorrect_pitch"]) == 0
    assert len(result["errors"]["missing_notes"]) == 0
    assert len(result["errors"]["additional_notes"]) == 0
    assert result["timing"] is not None


def test_incorrect_pitch():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = make_performed(
        ["C4", "D4", "F4", "F4"]
    )

    result = analyze_performance(
        expected,
        performed
    )

    assert len(result["errors"]["incorrect_pitch"]) == 1
    assert result["errors"]["incorrect_pitch"][0]["expected_note"] == "E4"
    assert result["errors"]["incorrect_pitch"][0]["performed_note"] == "F4"
    error = result["errors"]["incorrect_pitch"][0]

    assert error["measure"] == 1
    assert error["beat"] == 3.0
    assert error["expected_duration"] == 1.0
    assert error["performed_duration"] == 1.0


def test_missing_note():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = make_performed(
        ["C4", "E4", "F4"]
    )

    result = analyze_performance(
        expected,
        performed
    )

    assert len(result["errors"]["missing_notes"]) == 1
    assert result["errors"]["missing_notes"][0]["expected_note"] == "D4"
    error = result["errors"]["missing_notes"][0]

    assert error["measure"] == 1
    assert error["beat"] == 2.0
    assert error["expected_duration"] == 1.0


def test_additional_note():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 1.0
        },
        {
            "pitch": "D4",
            "onset": 1.0,
            "duration": 1.0
        },
        {
            "pitch": "D#4",
            "onset": 1.5,
            "duration": 0.5
        },
        {
            "pitch": "E4",
            "onset": 2.0,
            "duration": 1.0
        },
        {
            "pitch": "F4",
            "onset": 3.0,
            "duration": 1.0
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=1.0,
        performance_start=0.0
    )

    assert len(result["errors"]["additional_notes"]) == 1

    error = result["errors"]["additional_notes"][0]

    assert error["performed_note"] == "D#4"
    assert error["measure"] == 1
    assert error["beat"] == 2.5
    assert error["performed_duration"] == 0.5


def test_combined_errors():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = make_performed(
        ["C4", "F4", "F4"]
    )

    result = analyze_performance(
        expected,
        performed
    )

    assert len(result["errors"]["incorrect_pitch"]) == 1
    assert len(result["errors"]["missing_notes"]) == 1
    assert len(result["errors"]["additional_notes"]) == 0

def test_missing_note_timing_with_pause():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 1.0
        },
        {
            "pitch": "E4",
            "onset": 2.0,
            "duration": 1.0
        },
        {
            "pitch": "F4",
            "onset": 3.0,
            "duration": 1.0
        },
    ]

    silence_regions = [
        {
            "start": 1.2,
            "end": 1.8,
            "duration": 0.6
        }
    ]

    result = analyze_performance(
        expected,
        performed,
        silence_regions=silence_regions,
        seconds_per_beat=1.0,
        performance_start=0.0,
    )

    assert len(result["errors"]["missing_notes"]) == 1
    assert result["errors"]["missing_notes"][0]["expected_note"] == "D4"

    assert len(result["missing_note_timing"]) == 1
    assert result["missing_note_timing"][0]["expected_index"] == 1
    assert result["missing_note_timing"][0]["pitch"] == "D4"
    assert result["missing_note_timing"][0]["pause_detected"] is True

def test_missing_note_timing_without_pause():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 1.0
        },
        {
            "pitch": "E4",
            "onset": 2.0,
            "duration": 1.0
        },
        {
            "pitch": "F4",
            "onset": 3.0,
            "duration": 1.0
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        silence_regions=[],
        seconds_per_beat=1.0,
        performance_start=0.0,
    )

    assert len(result["errors"]["missing_notes"]) == 1
    assert result["errors"]["missing_notes"][0]["expected_note"] == "D4"

    assert len(result["missing_note_timing"]) == 1
    assert result["missing_note_timing"][0]["expected_index"] == 1
    assert result["missing_note_timing"][0]["pitch"] == "D4"
    assert result["missing_note_timing"][0]["pause_detected"] is False

def test_analyze_performance_includes_duration_analysis():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 2.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
        },
        {
            "pitch": "D4",
            "onset": 0.5,
            "duration": 0.25,
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=0.5,
        performance_start=0.0,
    )

    assert len(result["duration_analysis"]) == 2

    first = result["duration_analysis"][0]

    assert first["pitch"] == "C4"
    assert first["measure"] == 1
    assert first["beat"] == 1.0
    assert first["expected_note_length"] == "quarter note"
    assert first["played_note_length"] == "quarter note"
    assert first["duration_status"] == "correct"

    second = result["duration_analysis"][1]

    assert second["pitch"] == "D4"
    assert second["measure"] == 1
    assert second["beat"] == 2.0
    assert second["expected_note_length"] == "quarter note"
    assert second["played_note_length"] == "eighth note"
    assert second["duration_status"] == "too_short"

def test_substitution_includes_duration_analysis():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 2.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
        },
        {
            "pitch": "E4",
            "onset": 0.5,
            "duration": 0.25,
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=0.5,
        performance_start=0.0,
    )

    assert len(result["errors"]["incorrect_pitch"]) == 1
    assert len(result["duration_analysis"]) == 2

    incorrect = result["errors"]["incorrect_pitch"][0]
    assert incorrect["expected_note"] == "D4"
    assert incorrect["performed_note"] == "E4"

    duration = result["duration_analysis"][1]
    assert duration["pitch"] == "D4"
    assert duration["measure"] == 1
    assert duration["beat"] == 2.0
    assert duration["expected_note_length"] == "quarter note"
    assert duration["played_note_length"] == "eighth note"
    assert duration["duration_status"] == "too_short"

def test_duration_analysis_prefers_measured_duration():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 2.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
            "measured_duration": 0.5,
            "inferred": False,
        },
        {
            "pitch": "D4",
            "onset": 0.5,

            # Score-aware duration says quarter note...
            "duration": 0.5,

            # ...but audio measurement says eighth note.
            "measured_duration": 0.25,
            "inferred": False,
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=0.5,
        performance_start=0.0,
    )

    duration = result["duration_analysis"][1]

    assert duration["expected_note_length"] == "quarter note"
    assert duration["played_note_length"] == "eighth note"
    assert duration["duration_status"] == "too_short"

def test_duration_analysis_skips_inferred_duration():
    expected = [
        {
            "pitch": "C4",
            "offset": 0.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 1.0,
        },
        {
            "pitch": "D4",
            "offset": 1.0,
            "duration": 1.0,
            "measure": 1,
            "beat": 2.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 0.5,
            "measured_duration": 0.5,
            "inferred": False,
        },
        {
            "pitch": "D4",
            "onset": 0.5,
            "duration": 0.5,
            "measured_duration": None,
            "inferred": True,
        },
    ]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=0.5,
        performance_start=0.0,
    )

    assert len(result["duration_analysis"]) == 1

    duration = result["duration_analysis"][0]

    assert duration["pitch"] == "C4"
    assert duration["expected_note_length"] == "quarter note"
    assert duration["played_note_length"] == "quarter note"
    assert duration["duration_status"] == "correct"

def test_real_audio_detects_short_note_duration():
    from music_analysis.note_events import detect_note_events
    from music_analysis.performance_segmentation import segment_performance
    from music_analysis.score_parser import extract_note_details

    score_file = (
        "test_music/Canon_in_D/canon-in-d.mxl"
    )
    audio_file = (
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_short_note.wav"
    )

    expected = [
        event
        for event in extract_note_details(score_file)
        if 3 <= event.get("measure", 0) <= 6
    ]

    detected = detect_note_events(audio_file)

    segmented = segment_performance(
        expected,
        detected,
    )

    performed = segmented["performed_events"]
    seconds_per_beat = segmented["seconds_per_beat"]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=seconds_per_beat,
        performance_start=performed[0]["onset"],
    )

    target = next(
        item
        for item in result["duration_analysis"]
        if item["measure"] == 4
        and item["beat"] == 2.0
    )

    assert target["pitch"] == "A4"
    assert target["expected_note_length"] == "quarter note"
    assert target["played_note_length"] == "sixteenth note"
    assert target["duration_status"] == "too_short"

def test_real_audio_detects_long_note_duration():
    from music_analysis.note_events import detect_note_events
    from music_analysis.performance_segmentation import segment_performance
    from music_analysis.score_parser import extract_note_details

    score_file = (
        "test_music/Canon_in_D/canon-in-d.mxl"
    )
    audio_file = (
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_long_note.wav"
    )

    expected = [
        event
        for event in extract_note_details(score_file)
        if 3 <= event.get("measure", 0) <= 6
    ]

    detected = detect_note_events(audio_file)

    segmented = segment_performance(
        expected,
        detected,
    )

    performed = segmented["performed_events"]
    seconds_per_beat = segmented["seconds_per_beat"]

    result = analyze_performance(
        expected,
        performed,
        seconds_per_beat=seconds_per_beat,
        performance_start=performed[0]["onset"],
    )

    target = next(
        item
        for item in result["duration_analysis"]
        if item["measure"] == 4
        and item["beat"] == 2.0
    )

    assert target["pitch"] == "A4"
    assert target["expected_note_length"] == "quarter note"
    assert target["played_note_length"] == "half note"
    assert target["duration_status"] == "too_long"

def test_pitch_accuracy_perfect_performance():
    alignment = [
        {"expected_note": "C4", "performed_note": "C4", "operation": "match"},
        {"expected_note": "D4", "performed_note": "D4", "operation": "match"},
        {"expected_note": "E4", "performed_note": "E4", "operation": "match"},
        {"expected_note": "F4", "performed_note": "F4", "operation": "match"},
    ]

    result = calculate_pitch_accuracy(alignment)

    assert result["correct_notes"] == 4
    assert result["total_expected_notes"] == 4
    assert result["accuracy_percent"] == 100.0


def test_pitch_accuracy_with_incorrect_pitch():
    alignment = [
        {"expected_note": "C4", "performed_note": "C4", "operation": "match"},
        {"expected_note": "D4", "performed_note": "D4", "operation": "match"},
        {"expected_note": "E4", "performed_note": "F4", "operation": "substitution"},
        {"expected_note": "F4", "performed_note": "F4", "operation": "match"},
    ]

    result = calculate_pitch_accuracy(alignment)

    assert result["correct_notes"] == 3
    assert result["total_expected_notes"] == 4
    assert result["accuracy_percent"] == 75.0

def test_pitch_accuracy_with_missing_note():
    alignment = [
        {"expected_note": "C4", "performed_note": "C4", "operation": "match"},
        {"expected_note": "D4", "performed_note": None, "operation": "deletion"},
        {"expected_note": "E4", "performed_note": "E4", "operation": "match"},
        {"expected_note": "F4", "performed_note": "F4", "operation": "match"},
    ]

    result = calculate_pitch_accuracy(alignment)

    assert result["correct_notes"] == 3
    assert result["total_expected_notes"] == 4
    assert result["accuracy_percent"] == 75.0


def test_pitch_accuracy_additional_note_does_not_reduce_accuracy():
    alignment = [
        {"expected_note": "C4", "performed_note": "C4", "operation": "match"},
        {"expected_note": "D4", "performed_note": "D4", "operation": "match"},
        {"expected_note": None, "performed_note": "D#4", "operation": "insertion"},
        {"expected_note": "E4", "performed_note": "E4", "operation": "match"},
        {"expected_note": "F4", "performed_note": "F4", "operation": "match"},
    ]

    result = calculate_pitch_accuracy(alignment)

    assert result["correct_notes"] == 4
    assert result["total_expected_notes"] == 4
    assert result["accuracy_percent"] == 100.0

def test_analyze_performance_includes_pitch_accuracy():
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
        {
            "pitch": "F4",
            "offset": 3.0,
            "duration": 1.0,
        },
    ]

    performed = [
        {
            "pitch": "C4",
            "onset": 0.0,
            "duration": 1.0,
        },
        {
            "pitch": "D4",
            "onset": 1.0,
            "duration": 1.0,
        },
        {
            "pitch": "F#4",
            "onset": 2.0,
            "duration": 1.0,
        },
        {
            "pitch": "F4",
            "onset": 3.0,
            "duration": 1.0,
        },
    ]

    result = analyze_performance(expected, performed)

    assert result["pitch_accuracy"]["correct_notes"] == 3
    assert result["pitch_accuracy"]["total_expected_notes"] == 4
    assert result["pitch_accuracy"]["accuracy_percent"] == 75.0

def test_pitch_accuracy_includes_individual_note_results():
    alignment = [
        {
            "expected_note": "C4",
            "performed_note": "C4",
            "operation": "match",
        },
        {
            "expected_note": "D4",
            "performed_note": "D#4",
            "operation": "substitution",
        },
        {
            "expected_note": "E4",
            "performed_note": None,
            "operation": "deletion",
        },
    ]

    result = calculate_pitch_accuracy(alignment)

    assert result["note_results"] == [
        {
            "note_index": 0,
            "expected_pitch": "C4",
            "performed_pitch": "C4",
            "pitch_correct": True,
        },
        {
            "note_index": 1,
            "expected_pitch": "D4",
            "performed_pitch": "D#4",
            "pitch_correct": False,
        },
        {
            "note_index": 2,
            "expected_pitch": "E4",
            "performed_pitch": None,
            "pitch_correct": False,
        },
    ]