from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from pathlib import Path


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

    # Measures 3-6 contain 16 expected notes.
    assert len(analysis["alignment"]) == 16

    # The deliberately omitted A4 should be the only missing note.
    assert analysis["errors"]["missing_notes"] == [
        {
            "expected_note": "A4",
            "note_index": 5,
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