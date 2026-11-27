"""API tests for stored score files and sheet-music annotations."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from main import app
from models import PracticeSession, User
from music_analysis.score_parser import extract_note_details


CANON_MXL = "test_music/Canon_in_D/canon-in-d.mxl"
LATE_NOTE_WAV = (
    "test_music/Canon_in_D/performances/"
    "canon_measures_3_6_late_note.wav"
)
SAMPLE_MUSICXML = "../public/sample.musicxml"


@pytest.fixture
def test_db():
    """Create an isolated SQLite database for each test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    try:
        yield TestingSessionLocal
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(test_db):
    """
    Use the test database and the real login check.

    Other test modules replace get_current_user with a fixed user, so
    that replacement is removed here and restored afterwards.
    """
    def override_get_db():
        db = test_db()
        try:
            yield db
        finally:
            db.close()

    previous_get_db = app.dependency_overrides.get(get_db)
    previous_get_current_user = app.dependency_overrides.pop(
        get_current_user,
        None,
    )

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_get_db is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_get_db

        if previous_get_current_user is not None:
            app.dependency_overrides[get_current_user] = (
                previous_get_current_user
            )


def login(client, email="student@example.com"):
    token = client.post(
        "/auth/signup",
        json={"email": email, "password": "correct-horse-battery"},
    ).json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


def create_session(client, headers):
    return client.post("/sessions", headers=headers).json()["session_id"]


def upload_score(client, headers, session_id, path, filename):
    with open(path, "rb") as file:
        return client.post(
            f"/sessions/{session_id}/upload-score",
            headers=headers,
            files={"file": (filename, file, "application/octet-stream")},
        )


# Stored score files

def test_uploaded_mxl_is_returned_as_plain_musicxml(client, tmp_path):
    headers = login(client)
    session_id = create_session(client, headers)

    upload_score(client, headers, session_id, CANON_MXL, "canon-in-d.mxl")

    response = client.get(f"/sessions/{session_id}/score", headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"] == (
        "application/vnd.recordare.musicxml+xml"
    )
    assert response.content.startswith(b"<?xml")

    returned = tmp_path / "returned.musicxml"
    returned.write_bytes(response.content)

    assert extract_note_details(str(returned)) == extract_note_details(CANON_MXL)


def test_uploaded_musicxml_is_returned_unchanged(client):
    headers = login(client)
    session_id = create_session(client, headers)

    upload_score(client, headers, session_id, SAMPLE_MUSICXML, "sample.musicxml")

    response = client.get(f"/sessions/{session_id}/score", headers=headers)

    with open(SAMPLE_MUSICXML, "rb") as file:
        assert response.content == file.read()


def test_score_requires_login(client):
    headers = login(client)
    session_id = create_session(client, headers)

    response = client.get(f"/sessions/{session_id}/score")

    assert response.status_code == 401


def test_score_is_private_to_its_owner(client):
    owner = login(client)
    other = login(client, email="other@example.com")

    session_id = create_session(client, owner)
    upload_score(client, owner, session_id, CANON_MXL, "canon-in-d.mxl")

    response = client.get(f"/sessions/{session_id}/score", headers=other)

    assert response.status_code == 404


def test_session_without_score_file(client):
    headers = login(client)
    session_id = create_session(client, headers)

    response = client.get(f"/sessions/{session_id}/score", headers=headers)

    assert response.status_code == 404
    assert response.json()["detail"] == (
        "No score file is stored for this session."
    )


def test_invalid_score_is_not_stored(client, tmp_path):
    headers = login(client)
    session_id = create_session(client, headers)

    bad_file = tmp_path / "broken.mxl"
    bad_file.write_bytes(b"not a zip file")

    response = upload_score(client, headers, session_id, bad_file, "broken.mxl")

    assert response.status_code == 400
    assert client.get(
        f"/sessions/{session_id}/score",
        headers=headers,
    ).status_code == 404


# Annotations

def test_performance_annotations_locate_the_late_note(client):
    headers = login(client)
    session_id = create_session(client, headers)

    upload_score(client, headers, session_id, CANON_MXL, "canon-in-d.mxl")

    with open(LATE_NOTE_WAV, "rb") as file:
        response = client.post(
            f"/sessions/{session_id}/upload-audio",
            headers=headers,
            data={"start_measure": "3", "end_measure": "6"},
            files={"file": ("late.wav", file, "audio/wav")},
        )

    assert response.status_code == 200

    annotations = response.json()["score_annotations"]

    late_note = next(
        annotated for annotated in annotations["notes"]
        if annotated["note_id"] == "p0_m4_q1.0_A4"
    )

    assert late_note["measure"] == 4
    assert late_note["offset_in_measure"] == 1.0
    assert late_note["midi"] == 69
    assert {"type": "late", "category": "timing", "description": "Played late."} in (
        late_note["errors"]
    )

    # Reopening the session from practice history gives the same annotations.
    stored = client.get(f"/sessions/{session_id}", headers=headers).json()

    assert stored["score_annotations"] == annotations


def test_older_sessions_return_empty_annotations(client, test_db):
    headers = login(client)

    # Feedback stored before notes were located in the score has no
    # note_id, so nothing can be placed on the sheet music.
    with test_db() as db:
        user = db.query(User).one()
        session = PracticeSession(
            user_id=user.id,
            status="audio_analyzed",
            performance_summary={
                "note_feedback": [{
                    "measure": 4,
                    "beat": 2.0,
                    "expected_note": "A4",
                    "played_note": "A4",
                    "pitch_status": "correct",
                    "timing_status": "late",
                }],
            },
        )
        db.add(session)
        db.commit()
        session_id = str(session.id)

    response = client.get(f"/sessions/{session_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["score_annotations"] == {
        "notes": [],
        "additional_notes": [],
    }
