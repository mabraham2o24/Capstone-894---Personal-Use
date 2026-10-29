from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from pathlib import Path
import pytest


TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
)

Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_create_session():
    response = client.post("/sessions")

    assert response.status_code == 200

    data = response.json()

    assert "session_id" in data
    assert data["status"] == "created"

def test_upload_audio_uses_selected_measure_range():
    # Create a practice session.
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    # Upload the full Canon score.
    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    # Upload the measures 3-6 performance.
    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()
    analysis = data["performance_analysis"]

    rhythm = analysis["rhythmic_accuracy"]

    assert rhythm["status"] == "calculated"
    assert rhythm["duration_accuracy_percent"] is not None
    assert rhythm["duration_accuracy_percent"] < 100.0
    assert rhythm["durations_evaluated"] > 0


    # US-17: Problem-area identification
    assert "problem_areas" in data
    assert isinstance(data["problem_areas"], list)

    for area in data["problem_areas"]:
        assert "measure" in area
        assert "error_notes" in area
        assert "error_rate" in area
        assert area["requires_practice"] is True

    # IT-06: Verify problem areas identify actual score locations.
    problem_areas = data["problem_areas"]

    assert len(problem_areas) > 0

    for area in problem_areas:
        assert 3 <= area["measure"] <= 6
        assert area["error_notes"] > 0
        assert area["error_rate"] > 0

    # US-18: Performance summary
    assert "performance_summary" in data

    summary = data["performance_summary"]
    assert summary is not None

    assert "metrics" in summary
    assert "error_counts" in summary
    assert "detected_errors" in summary
    assert "note_feedback" in summary
    assert "problem_areas" in summary

    # Verify existing metric data is preserved.
    assert summary["metrics"]["pitch_accuracy"] == (
        data["performance_analysis"]["pitch_accuracy"]
    )
    assert summary["metrics"]["rhythmic_accuracy"] == (
        data["performance_analysis"]["rhythmic_accuracy"]
    )
    assert summary["metrics"]["tempo_consistency"] == (
        data["performance_analysis"]["tempo_consistency"]
    )

    # Verify US-17 and US-18 agree.
    assert summary["problem_areas"] == data["problem_areas"]
    assert summary["problem_area_count"] == len(
        data["problem_areas"]
    )

    # Verify existing note feedback is preserved.
    assert summary["note_feedback"] == data["note_feedback"]

    # IT-08: Verify complete analysis response consistency.
    assert "pitch_accuracy" in analysis
    assert "rhythmic_accuracy" in analysis
    assert "tempo_consistency" in analysis
    assert "errors" in analysis

    summary = data["performance_summary"]

    assert summary["metrics"]["pitch_accuracy"] == analysis["pitch_accuracy"]
    assert summary["metrics"]["rhythmic_accuracy"] == analysis["rhythmic_accuracy"]
    assert summary["metrics"]["tempo_consistency"] == analysis["tempo_consistency"]

    assert summary["problem_areas"] == data["problem_areas"]
    assert summary["note_feedback"] == data["note_feedback"]

    # Measures 3-6 contain 16 expected notes.
    assert len(analysis["alignment"]) == 16

    # The deliberately omitted A4 should be the only missing note.
    assert analysis["errors"]["missing_notes"] == [
        {
            "expected_note": "A4",
            "note_index": 5,
            "measure": 4,
            "beat": 2.0,
            "expected_duration": 1.0,
            "error_type": "missing_note",
        }
    ]

    assert analysis["errors"]["incorrect_pitch"] == []
    assert analysis["errors"]["additional_notes"] == []

    # The missing A4 occurs during the intentional pause.
    assert analysis["missing_note_timing"][0][
        "expected_index"
    ] == 5

    assert analysis["missing_note_timing"][0][
        "pitch"
    ] == "A4"

    assert analysis["missing_note_timing"][0][
        "pause_detected"
    ] is True

def test_upload_audio_rejects_invalid_measure_range():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "6",
                "end_measure": "3",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "Could not analyze audio file: "
        "start_measure cannot be greater than end_measure"
    )

def test_upload_audio_requires_both_measure_values():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_missing_pause2.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "Could not analyze audio file: "
        "start_measure and end_measure must be provided together"
    )

def test_upload_audio_returns_short_note_duration_feedback():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_short_note.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()
    analysis = data["performance_analysis"]

    target = next(
        item
        for item in analysis["duration_analysis"]
        if item["measure"] == 4
        and item["beat"] == 2.0
    )

    assert target == {
        "pitch": "A4",
        "measure": 4,
        "beat": 2.0,
        "expected_note_length": "quarter note",
        "played_note_length": "sixteenth note",
        "duration_status": "too_short",
    }

def test_upload_audio_returns_long_note_duration_feedback():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_long_note.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()
    analysis = data["performance_analysis"]

    target = next(
        item
        for item in analysis["duration_analysis"]
        if item["measure"] == 4
        and item["beat"] == 2.0
    )

    assert target == {
        "pitch": "A4",
        "measure": 4,
        "beat": 2.0,
        "expected_note_length": "quarter note",
        "played_note_length": "half note",
        "duration_status": "too_long",
    }

def test_upload_audio_requires_score_first():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_correct.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "Could not analyze audio file: "
        "Upload a score before uploading audio"
    )

def test_upload_audio_returns_late_note_timing_feedback():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_late_note.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    analysis = response.json()["performance_analysis"]

    # IT-05: Verify tempo variation is reflected in the API response.
    tempo = analysis["tempo_consistency"]

    assert tempo["status"] == "calculated"
    assert tempo["consistency_percent"] < 100.0
    assert tempo["variation_percent"] > 0.0
    assert tempo["intervals_evaluated"] > 0

    timing_results = analysis["timing"]["results"]

    rhythm = analysis["rhythmic_accuracy"]

    assert rhythm["status"] == "calculated"
    assert rhythm["onset_accuracy_percent"] is not None
    assert rhythm["onset_accuracy_percent"] < 100.0
    assert rhythm["onset_intervals_evaluated"] > 0

    late_notes = [
        note
        for note in timing_results
        if note["timing"] == "late"
    ]

    assert len(late_notes) == 1

    late_note = late_notes[0]

    assert late_note["pitch"] == "A4"
    assert late_note["measure"] == 4
    assert late_note["beat"] == 2.0
    assert late_note["timing"] == "late"

def test_upload_audio_returns_note_feedback():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_short_note.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert "note_feedback" in data

    feedback = data["note_feedback"]

    assert len(feedback) == 16

    shortened_a4 = feedback[5]

    assert shortened_a4["measure"] == 4
    assert shortened_a4["beat"] == 2.0
    assert shortened_a4["expected_note"] == "A4"
    assert shortened_a4["played_note"] == "A4"
    assert shortened_a4["pitch_status"] == "correct"
    assert shortened_a4["expected_note_length"] == "quarter note"
    assert shortened_a4["played_note_length"] == "sixteenth note"
    assert shortened_a4["duration_status"] == "too_short"

def test_upload_audio_returns_pitch_accuracy():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Canon_in_D/canon-in-d.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Canon_in_D/performances/"
        "canon_measures_3_6_incorrect_pitch.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "3",
                "end_measure": "6",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    analysis = response.json()["performance_analysis"]

    pitch_accuracy = analysis["pitch_accuracy"]


    assert pitch_accuracy["correct_notes"] == 15
    assert pitch_accuracy["total_expected_notes"] == 16
    assert pitch_accuracy["accuracy_percent"] == 93.75
    assert len(pitch_accuracy["note_results"]) == 16

    sequence_accuracy = analysis["note_sequence_accuracy"]

    assert sequence_accuracy["correct_notes"] == 15
    assert sequence_accuracy["total_expected_notes"] == 16
    assert sequence_accuracy["additional_notes"] == 0
    assert sequence_accuracy["total_notes"] == 16
    assert sequence_accuracy["accuracy_percent"] == 93.75

    incorrect_pitch_result = pitch_accuracy["note_results"][7]

    assert incorrect_pitch_result == {
        "note_index": 7,
        "expected_pitch": "C#5",
        "performed_pitch": "C5",
        "pitch_correct": False,
    }
    incorrect_note = analysis["errors"]["incorrect_pitch"][0]

    assert incorrect_note["expected_note"] == "C#5"
    assert incorrect_note["performed_note"] == "C5"
    assert incorrect_note["measure"] == 4
    assert incorrect_note["beat"] == 4.0


def test_upload_score_stores_rest_details():
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Minuet_in_F/minuet_in_f.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    # Verify persisted session information through the API.
    response = client.get(f"/sessions/{session_id}")
    assert response.status_code == 200

    score_summary = response.json()["score_summary"]

    assert "rest_details" in score_summary

    rests = score_summary["rest_details"]

    assert any(
        rest["measure"] == 2
        and rest["beat"] == 3.0
        and rest["duration"] == 1.0
        for rest in rests
    )

    assert any(
        rest["measure"] == 4
        and rest["beat"] == 3.0
        and rest["duration"] == 1.0
        for rest in rests
    )


@pytest.mark.parametrize(
    "instrument,scenario,expected_behavior",
    [
        ("violin", "missing_pause", "paused"),
        ("violin", "missing_continuous", "continued"),
        ("flute", "missing_pause", "paused"),
        ("flute", "missing_continuous", "continued"),
        ("piano", "missing_pause", "paused"),
        ("piano", "missing_continuous", "continued"),
    ],
)
def test_upload_audio_returns_missing_note_behavior(
    instrument,
    scenario,
    expected_behavior,
):
    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    score_path = Path(
        "test_music/Minuet_in_F/minuet_in_f.mxl"
    )

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    audio_path = Path(
        "test_music/Minuet_in_F/performances/"
        f"minuet_measures_1_4_{instrument}_{scenario}.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "1",
                "end_measure": "4",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert "performance_analysis" in data
    assert "note_feedback" in data

    feedback = data["note_feedback"]

    missing_e4 = [
        item
        for item in feedback
        if (
            item["measure"] == 2
            and item["beat"] == 1.5
            and item["expected_note"] == "E4"
        )
    ]

    assert len(missing_e4) == 1

    result = missing_e4[0]

    assert result["pitch_status"] == "missing"
    assert (
        result["missing_note_behavior"]
        == expected_behavior
    )

    assert "missing_note_pause_duration" in result

def test_complete_workflow_with_multiple_errors():
    """IT-08: Verify complete analysis with mixed performance errors."""

    # Create session.
    response = client.post("/sessions")
    assert response.status_code == 200
    session_id = response.json()["session_id"]

    # Upload Minuet in F score.
    score_path = Path("test_music/Minuet_in_F/minuet_in_f.mxl")

    with score_path.open("rb") as score_file:
        response = client.post(
            f"/sessions/{session_id}/upload-score",
            files={
                "file": (
                    score_path.name,
                    score_file,
                    "application/octet-stream",
                )
            },
        )

    assert response.status_code == 200

    # Upload performance containing multiple errors.
    audio_path = Path(
        "test_music/Minuet_in_F/performances/"
        "minuet_measures_1_4_violin_multiple_errors.wav"
    )

    with audio_path.open("rb") as audio_file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            data={
                "start_measure": "1",
                "end_measure": "4",
            },
            files={
                "file": (
                    audio_path.name,
                    audio_file,
                    "audio/wav",
                )
            },
        )

    assert response.status_code == 200

    data = response.json()
    analysis = data["performance_analysis"]
    summary = data["performance_summary"]

    # Verify all Sprint 3 metrics are returned.
    for metric in (
        "pitch_accuracy",
        "rhythmic_accuracy",
        "tempo_consistency",
    ):
        assert metric in analysis
        assert summary["metrics"][metric] == analysis[metric]

    # Verify errors and feedback are available.
    assert "errors" in analysis
    assert "note_feedback" in data
    assert isinstance(data["note_feedback"], list)

    # Verify multiple error types were detected.
    detected_error_types = {
        error_type
        for error_type, errors in analysis["errors"].items()
        if isinstance(errors, list) and len(errors) > 0
    }

    assert len(detected_error_types) >= 2

    # Verify problem-area identification.
    assert "problem_areas" in data
    assert isinstance(data["problem_areas"], list)

    for area in data["problem_areas"]:
        assert 1 <= area["measure"] <= 4
        assert area["requires_practice"] is True

    # Verify summary consistency.
    assert summary["problem_areas"] == data["problem_areas"]
    assert summary["note_feedback"] == data["note_feedback"]
    assert summary["problem_area_count"] == len(data["problem_areas"])
