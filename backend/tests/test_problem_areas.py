
from music_analysis.problem_areas import identify_problem_areas


def test_multiple_errors_flag_measure():
    expected = [
        {"measure": 1, "beat": i}
        for i in range(1, 5)
    ]

    feedback = [
        {
            "measure": 1,
            "beat": 1,
            "pitch_status": "incorrect",
        },
        {
            "measure": 1,
            "beat": 2,
            "pitch_status": "missing",
        },
    ]

    result = identify_problem_areas(expected, feedback)

    assert len(result) == 1
    assert result[0]["measure"] == 1
    assert result[0]["error_notes"] == 2


def test_clean_measure_not_flagged():
    expected = [
        {"measure": 1, "beat": i}
        for i in range(1, 5)
    ]

    feedback = [
        {
            "measure": 1,
            "beat": 1,
            "pitch_status": "correct",
            "timing_status": "on_time",
            "duration_status": "correct",
        }
    ]

    result = identify_problem_areas(expected, feedback)

    assert result == []



def test_multiple_error_types_one_note():
    expected = [
        {"measure": 2, "beat": i}
        for i in range(1, 5)
    ]

    feedback = [
        {
            "measure": 2,
            "beat": 1,
            "pitch_status": "incorrect",
            "timing_status": "late",
            "duration_status": "too_short",
        }
    ]

    result = identify_problem_areas(expected, feedback)

    # One erroneous note out of four is 25%.
    # It should not meet either problem-area threshold.
    assert result == []


def test_multiple_error_types_preserved():
    expected = [
        {"measure": 2, "beat": i}
        for i in range(1, 5)
    ]

    feedback = [
        {
            "measure": 2,
            "beat": 1,
            "pitch_status": "incorrect",
            "timing_status": "late",
            "duration_status": "too_short",
        },
        {
            "measure": 2,
            "beat": 2,
            "pitch_status": "missing",
        },
    ]

    result = identify_problem_areas(expected, feedback)

    assert len(result) == 1
    assert result[0]["measure"] == 2
    assert result[0]["error_notes"] == 2
    assert result[0]["error_rate"] == 0.5

    assert result[0]["error_types"]["incorrect"] == 1
    assert result[0]["error_types"]["timing"] == 1
    assert result[0]["error_types"]["duration"] == 1
    assert result[0]["error_types"]["missing"] == 1


def test_additional_notes_do_not_inflate_error_rate():
    expected = [
        {"measure": 1, "beat": i}
        for i in range(1, 5)
    ]

    feedback = [
        {
            "measure": 1,
            "beat": 1,
            "pitch_status": "additional",
        },
        {
            "measure": 1,
            "beat": 2,
            "pitch_status": "additional",
        },
    ]

    result = identify_problem_areas(expected, feedback)

    assert len(result) == 1
    assert result[0]["error_notes"] == 2
    assert result[0]["error_rate"] == 0.0


def test_error_rate_threshold_boundary():
    expected = [
        {"measure": 3, "beat": i}
        for i in range(1, 6)
    ]

    feedback = [
        {
            "measure": 3,
            "beat": 1,
            "pitch_status": "incorrect",
        },
        {
            "measure": 3,
            "beat": 2,
            "pitch_status": "missing",
        },
    ]

    result = identify_problem_areas(expected, feedback)

    assert len(result) == 1
    assert result[0]["error_rate"] == 0.4


def test_problem_areas_grouped_by_measure():
    expected = [
        {"measure": measure, "beat": beat}
        for measure in range(1, 4)
        for beat in range(1, 5)
    ]

    feedback = [
        {"measure": 1, "beat": 1, "pitch_status": "incorrect"},
        {"measure": 1, "beat": 2, "pitch_status": "missing"},
        {"measure": 2, "beat": 1, "pitch_status": "correct"},
        {"measure": 3, "beat": 2, "pitch_status": "incorrect"},
        {"measure": 3, "beat": 3, "timing_status": "late"},
    ]

    result = identify_problem_areas(expected, feedback)

    assert len(result) == 2
    assert {area["measure"] for area in result} == {1, 3}
    assert all(area["error_notes"] == 2 for area in result)
