from music_analysis.feedback_formatter import format_note_feedback
import pytest


def test_format_note_feedback_for_correct_note():
    expected = [
        {
            "pitch": "C4",
            "measure": 1,
            "beat": 1.0,
            "duration": 1.0,
        }
    ]

    analysis = {
        "alignment": [
            {
                "operation": "match",
                "expected_note": "C4",
                "performed_note": "C4",
            }
        ],
        "errors": {
            "incorrect_pitch": [],
            "missing_notes": [],
            "additional_notes": [],
        },
        "timing": {
            "results": [
                {
                    "pitch": "C4",
                    "measure": 1,
                    "beat": 1.0,
                    "timing": "on_time",
                }
            ]
        },
        "duration_analysis": [
            {
                "pitch": "C4",
                "measure": 1,
                "beat": 1.0,
                "expected_note_length": "quarter note",
                "played_note_length": "quarter note",
                "duration_status": "correct",
            }
        ],
    }

    result = format_note_feedback(
        expected,
        analysis,
    )

    assert result == [
        {
            "measure": 1,
            "beat": 1.0,
            "expected_note": "C4",
            "played_note": "C4",
            "pitch_status": "correct",
            "expected_note_length": "quarter note",
            "played_note_length": "quarter note",
            "duration_status": "correct",
            "timing_status": "on_time",
        }
    ]

def test_format_note_feedback_for_incorrect_pitch():
    expected = [
        {
            "pitch": "D4",
            "measure": 1,
            "beat": 2.0,
            "duration": 1.0,
        }
    ]

    analysis = {
        "alignment": [
            {
                "operation": "substitution",
                "expected_note": "D4",
                "performed_note": "D#4",
            }
        ],
        "errors": {
            "incorrect_pitch": [
                {
                    "expected_note": "D4",
                    "performed_note": "D#4",
                    "note_index": 0,
                    "measure": 1,
                    "beat": 2.0,
                    "expected_duration": 1.0,
                    "performed_duration": 0.5,
                    "error_type": "incorrect_pitch",
                }
            ],
            "missing_notes": [],
            "additional_notes": [],
        },
        "timing": {
            "results": [
                {
                    "pitch": "D4",
                    "measure": 1,
                    "beat": 2.0,
                    "timing": "on_time",
                }
            ]
        },
        "duration_analysis": [
            {
                "pitch": "D4",
                "measure": 1,
                "beat": 2.0,
                "expected_note_length": "quarter note",
                "played_note_length": "quarter note",
                "duration_status": "correct",
            }
        ],
    }

    result = format_note_feedback(
        expected,
        analysis,
    )

    assert result == [
        {
            "measure": 1,
            "beat": 2.0,
            "expected_note": "D4",
            "played_note": "D#4",
            "pitch_status": "incorrect",
            "expected_note_length": "quarter note",
            "played_note_length": "quarter note",
            "duration_status": "correct",
            "timing_status": "on_time",
        }
    ]

def test_format_note_feedback_for_missing_note():
    expected = [
        {
            "pitch": "A4",
            "measure": 4,
            "beat": 2.0,
            "duration": 1.0,
        }
    ]

    analysis = {
        "alignment": [
            {
                "operation": "deletion",
                "expected_note": "A4",
                "performed_note": None,
            }
        ],
        "errors": {
            "incorrect_pitch": [],
            "missing_notes": [
                {
                    "expected_note": "A4",
                    "note_index": 0,
                    "measure": 4,
                    "beat": 2.0,
                    "expected_duration": 1.0,
                    "error_type": "missing_note",
                }
            ],
            "additional_notes": [],
        },
        "timing": None,
        "duration_analysis": [],
    }

    result = format_note_feedback(
        expected,
        analysis,
    )

    assert result == [
        {
            "measure": 4,
            "beat": 2.0,
            "expected_note": "A4",
            "played_note": None,
            "pitch_status": "missing",
            "expected_note_length": "quarter note",
            "played_note_length": None,
            "duration_status": None,
            "timing_status": None,
            "missing_note_behavior": "unknown",
            "missing_note_pause_duration": None,
        }
    ]

def test_format_note_feedback_for_additional_note():
    expected = [
        {
            "pitch": "C4",
            "measure": 1,
            "beat": 1.0,
            "duration": 1.0,
        }
    ]

    analysis = {
        "alignment": [
            {
                "operation": "insertion",
                "expected_note": None,
                "performed_note": "D4",
            }
        ],
        "errors": {
            "incorrect_pitch": [],
            "missing_notes": [],
            "additional_notes": [
                {
                    "performed_note": "D4",
                    "performed_index": 0,
                    "measure": 1,
                    "beat": 1.5,
                    "performed_duration": 0.5,
                    "error_type": "additional_note",
                }
            ],
        },
        "timing": None,
        "duration_analysis": [],
    }

    result = format_note_feedback(
        expected,
        analysis,
    )

    assert result == [
        {
            "measure": 1,
            "beat": 1.5,
            "expected_note": None,
            "played_note": "D4",
            "pitch_status": "additional",
            "expected_note_length": None,
            "played_note_length": None,
            "duration_status": None,
            "timing_status": None,
        }
    ]

def test_format_note_feedback_handles_mixed_alignment_operations():
    expected = [
        {"pitch": "C4", "measure": 1, "beat": 1.0, "duration": 1.0},
        {"pitch": "D4", "measure": 1, "beat": 2.0, "duration": 1.0},
        {"pitch": "E4", "measure": 1, "beat": 3.0, "duration": 1.0},
    ]

    analysis = {
        "alignment": [
            {
                "operation": "match",
                "expected_note": "C4",
                "performed_note": "C4",
            },
            {
                "operation": "substitution",
                "expected_note": "D4",
                "performed_note": "D#4",
            },
            {
                "operation": "insertion",
                "expected_note": None,
                "performed_note": "F4",
            },
            {
                "operation": "deletion",
                "expected_note": "E4",
                "performed_note": None,
            },
        ],
        "errors": {
            "incorrect_pitch": [
                {
                    "expected_note": "D4",
                    "performed_note": "D#4",
                    "note_index": 1,
                    "measure": 1,
                    "beat": 2.0,
                    "expected_duration": 1.0,
                    "performed_duration": 0.5,
                    "error_type": "incorrect_pitch",
                }
            ],
            "missing_notes": [
                {
                    "expected_note": "E4",
                    "note_index": 2,
                    "measure": 1,
                    "beat": 3.0,
                    "expected_duration": 1.0,
                    "error_type": "missing_note",
                }
            ],
            "additional_notes": [
                {
                    "performed_note": "F4",
                    "performed_index": 2,
                    "measure": 1,
                    "beat": 2.5,
                    "performed_duration": 0.25,
                    "error_type": "additional_note",
                }
            ],
        },
        "timing": {
            "results": [
                {
                    "pitch": "C4",
                    "measure": 1,
                    "beat": 1.0,
                    "timing": "on_time",
                },
                {
                    "pitch": "D4",
                    "measure": 1,
                    "beat": 2.0,
                    "timing": "on_time",
                },
            ]
        },
        "duration_analysis": [
            {
                "pitch": "C4",
                "measure": 1,
                "beat": 1.0,
                "expected_note_length": "quarter note",
                "played_note_length": "quarter note",
                "duration_status": "correct",
            },
            {
                "pitch": "D4",
                "measure": 1,
                "beat": 2.0,
                "expected_note_length": "quarter note",
                "played_note_length": "quarter note",
                "duration_status": "correct",
            },
        ],
    }

    result = format_note_feedback(expected, analysis)

    assert len(result) == 4

    assert result[0]["expected_note"] == "C4"
    assert result[0]["played_note"] == "C4"
    assert result[0]["pitch_status"] == "correct"

    assert result[1]["expected_note"] == "D4"
    assert result[1]["played_note"] == "D#4"
    assert result[1]["pitch_status"] == "incorrect"

    assert result[2]["expected_note"] is None
    assert result[2]["played_note"] == "F4"
    assert result[2]["pitch_status"] == "additional"
    assert result[2]["measure"] == 1
    assert result[2]["beat"] == 2.5

    assert result[3]["expected_note"] == "E4"
    assert result[3]["played_note"] is None
    assert result[3]["pitch_status"] == "missing"
    assert result[3]["measure"] == 1
    assert result[3]["beat"] == 3.0

@pytest.mark.parametrize(
    "local_pause,expected_behavior",
    [
        (True, "paused"),
        (False, "continued"),
        (None, "unknown"),
    ],
)
def test_missing_note_behavior_from_local_analysis(
    local_pause,
    expected_behavior,
):
    expected = [
        {
            "pitch": "E4",
            "offset": 0.0,
            "duration": 0.5,
            "measure": 2,
            "beat": 1.5,
        }
    ]

    analysis = {
        "alignment": [
            {
                "expected_note": "E4",
                "performed_note": None,
                "operation": "deletion",
            }
        ],
        "timing": None,
        "duration_analysis": [],
        "errors": {"additional_notes": []},
        "missing_note_timing": [
            {
                "expected_index": 0,
                "pitch": "E4",
                "local_pause_detected": local_pause,
                "local_quiet_duration": (
                    0.14 if local_pause else 0.0
                ),
            }
        ],
    }

    feedback = format_note_feedback(expected, analysis)

    assert len(feedback) == 1
    assert feedback[0]["pitch_status"] == "missing"
    assert (
        feedback[0]["missing_note_behavior"]
        == expected_behavior
    )


def test_missing_note_unknown_when_local_analysis_unavailable():
    expected = [
        {
            "pitch": "E4",
            "offset": 0.0,
            "duration": 0.5,
            "measure": 2,
            "beat": 1.5,
        }
    ]

    analysis = {
        "alignment": [
            {
                "expected_note": "E4",
                "performed_note": None,
                "operation": "deletion",
            }
        ],
        "timing": None,
        "duration_analysis": [],
        "errors": {"additional_notes": []},
        "missing_note_timing": [],
    }

    feedback = format_note_feedback(expected, analysis)

    assert feedback[0]["missing_note_behavior"] == "unknown"
    assert feedback[0]["missing_note_pause_duration"] is None
