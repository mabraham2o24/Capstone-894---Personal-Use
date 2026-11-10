
from music_analysis.ai_feedback import generate_ai_feedback

sample_summary = {
    "metrics": {
        "pitch_accuracy": {"accuracy_percent": 85},
        "rhythmic_accuracy": {"accuracy_percent": 72},
        "tempo_consistency": {"consistency_percent": 78},
        "note_sequence_accuracy": {"accuracy_percent": 90},
    },
    "error_counts": {
        "incorrect_pitch": 1,
        "missing_notes": 0,
        "additional_notes": 0,
    },
    "detected_errors": {
        "incorrect_pitch": [
            {"measure": 3, "beat": 2}
        ],
        "missing_notes": [],
        "additional_notes": [],
    },
    "note_feedback": [
        {
            "measure": 2,
            "beat": 1,
            "pitch_status": "correct",
            "timing_status": "late",
        },
        {
            "measure": 2,
            "beat": 3,
            "pitch_status": "correct",
            "timing_status": "late",
        },
        {
            "measure": 3,
            "beat": 2,
            "pitch_status": "incorrect",
            "timing_status": "on_time",
        },
        {
            "measure": 4,
            "beat": 1,
            "pitch_status": "correct",
            "duration_status": "too_long",
        },
    ],
    "problem_areas": [
        {
            "measure": 2,
            "error_notes": 2,
            "error_types": {"timing": 2},
            "requires_practice": True,
        }
    ],
    "problem_area_count": 1,
}

if __name__ == "__main__":
    feedback = generate_ai_feedback(sample_summary)
    print(feedback.model_dump_json(indent=2))
