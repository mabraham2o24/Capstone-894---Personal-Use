
from music_analysis.problem_areas import identify_problem_areas


def test_problem_areas_api_payload():
    """Verify the problem-area output is JSON-compatible."""
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

    problem_areas = identify_problem_areas(
        expected,
        feedback,
    )

    response = {
        "performance_analysis": {},
        "note_feedback": feedback,
        "problem_areas": problem_areas,
    }

    assert "problem_areas" in response
    assert len(response["problem_areas"]) == 1
    assert response["problem_areas"][0]["measure"] == 1
    assert response["problem_areas"][0]["requires_practice"] is True
