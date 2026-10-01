from music_analysis.performance_analysis import analyze_performance


def make_expected(pitches):
    return [
        {
            "pitch": pitch,
            "offset": float(index),
            "duration": 1.0
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


def test_additional_note():
    expected = make_expected(
        ["C4", "D4", "E4", "F4"]
    )

    performed = make_performed(
        ["C4", "D4", "D#4", "E4", "F4"]
    )

    result = analyze_performance(
        expected,
        performed
    )

    assert len(result["errors"]["additional_notes"]) == 1
    assert result["errors"]["additional_notes"][0]["performed_note"] == "D#4"


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