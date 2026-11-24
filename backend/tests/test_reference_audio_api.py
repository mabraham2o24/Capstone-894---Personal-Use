"""Integration tests for the reference audio API."""

import io
import wave
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import get_current_user
from database import Base, get_db
from main import app
from models import PracticeSession, User


TEST_USER = User(
    id=uuid4(),
    email="reference-tester@example.com",
    name="Reference Tester",
)

OTHER_USER = User(
    id=uuid4(),
    email="other-reference@example.com",
    name="Other Tester",
)


@pytest.fixture
def api_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    testing_session = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    previous_overrides = app.dependency_overrides.copy()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: TEST_USER

    try:
        with TestClient(app) as client:
            yield client, testing_session
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def analyzed_session(api_context):
    client, testing_session = api_context

    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    db = testing_session()

    try:
        session = db.get(
            PracticeSession,
            UUID(session_id),
        )

        session.score_filename = "reference_test.musicxml"

        session.score_summary = {
            "tempo_bpm": 120,
            "note_details": [
                {
                    "pitch": "C4",
                    "duration": 1.0,
                    "offset": 0.0,
                    "measure": 1,
                    "beat": 1.0,
                },
                {
                    "pitch": "D4",
                    "duration": 1.0,
                    "offset": 1.0,
                    "measure": 1,
                    "beat": 2.0,
                },
                {
                    "pitch": "E4",
                    "duration": 1.0,
                    "offset": 2.0,
                    "measure": 2,
                    "beat": 1.0,
                },
                {
                    "pitch": "F4",
                    "duration": 1.0,
                    "offset": 3.0,
                    "measure": 2,
                    "beat": 2.0,
                },
                {
                    "pitch": "G4",
                    "duration": 1.0,
                    "offset": 4.0,
                    "measure": 3,
                    "beat": 1.0,
                },
                {
                    "pitch": "A4",
                    "duration": 1.0,
                    "offset": 5.0,
                    "measure": 3,
                    "beat": 2.0,
                },
            ],
            "rest_details": [],
        }

        session.audio_filename = "performance.wav"

        session.performance_analysis = {
            "timing": {
                "seconds_per_beat": 0.75,
            },
        }

        session.status = "audio_analyzed"

        db.commit()

    finally:
        db.close()

    return session_id


def update_session(api_context, session_id, **changes):
    _, testing_session = api_context

    db = testing_session()

    try:
        session = db.get(
            PracticeSession,
            UUID(session_id),
        )

        for key, value in changes.items():
            setattr(session, key, value)

        db.commit()

    finally:
        db.close()


def remove_score_tempo(api_context, session_id):
    _, testing_session = api_context

    db = testing_session()

    try:
        session = db.get(
            PracticeSession,
            UUID(session_id),
        )

        score_summary = dict(session.score_summary)
        score_summary["tempo_bpm"] = None

        session.score_summary = score_summary

        db.commit()

    finally:
        db.close()


def request_reference(
    client,
    session_id,
    start_measure=1,
    end_measure=2,
):
    return client.get(
        f"/sessions/{session_id}/reference-audio",
        params={
            "start_measure": start_measure,
            "end_measure": end_measure,
        },
    )


def wav_duration(audio_bytes):
    with wave.open(io.BytesIO(audio_bytes), "rb") as audio:
        return audio.getnframes() / audio.getframerate()


def test_reference_audio_success(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"

    with wave.open(io.BytesIO(response.content), "rb") as audio:
        assert audio.getnchannels() == 1
        assert audio.getsampwidth() == 2
        assert audio.getframerate() == 44100
        assert audio.getnframes() > 0

        frames = audio.readframes(audio.getnframes())
        assert any(frames)


def test_reference_audio_selected_measure_range(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    selected = request_reference(
        client,
        analyzed_session,
        start_measure=2,
        end_measure=2,
    )

    full = request_reference(
        client,
        analyzed_session,
        start_measure=1,
        end_measure=3,
    )

    assert selected.status_code == 200
    assert full.status_code == 200

    assert wav_duration(selected.content) == pytest.approx(
        1.0, abs=0.001
    )

    assert wav_duration(full.content) == pytest.approx(
        3.0, abs=0.001
    )

    assert len(selected.content) < len(full.content)


def test_reference_audio_uses_score_tempo(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 200
    assert float(response.headers["X-Tempo-BPM"]) == 120
    assert response.headers["X-Tempo-Source"] == "score"

    assert wav_duration(response.content) == pytest.approx(
        2.0, abs=0.001
    )


def test_reference_audio_uses_performance_tempo(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    remove_score_tempo(
        api_context,
        analyzed_session,
    )

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 200
    assert float(response.headers["X-Tempo-BPM"]) == 80

    assert (
        response.headers["X-Tempo-Source"]
        == "performance"
    )

    assert wav_duration(response.content) == pytest.approx(
        3.0, abs=0.001
    )


def test_reference_audio_uses_default_tempo(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    remove_score_tempo(
        api_context,
        analyzed_session,
    )

    update_session(
        api_context,
        analyzed_session,
        performance_analysis=None,
    )

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 200
    assert float(response.headers["X-Tempo-BPM"]) == 120
    assert response.headers["X-Tempo-Source"] == "default"


def test_reference_audio_reversed_measure_range(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    response = request_reference(
        client,
        analyzed_session,
        start_measure=3,
        end_measure=1,
    )

    assert response.status_code == 400
    assert "measure range" in response.json()["detail"].lower()


def test_reference_audio_range_without_notes(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    response = request_reference(
        client,
        analyzed_session,
        start_measure=10,
        end_measure=12,
    )

    assert response.status_code == 400
    assert "no score notes" in response.json()["detail"].lower()


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"start_measure": 1},
        {"end_measure": 2},
    ],
)
def test_reference_audio_missing_measure_parameters(
    api_context,
    analyzed_session,
    params,
):
    client, _ = api_context

    response = client.get(
        f"/sessions/{analyzed_session}/reference-audio",
        params=params,
    )

    assert response.status_code == 422


def test_reference_audio_requires_analysis(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    update_session(
        api_context,
        analyzed_session,
        status="score_uploaded",
        performance_analysis=None,
    )

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 400
    assert "analyzed" in response.json()["detail"].lower()


def test_reference_audio_requires_score(api_context):
    client, _ = api_context

    response = client.post("/sessions")
    assert response.status_code == 200

    session_id = response.json()["session_id"]

    response = request_reference(
        client,
        session_id,
    )

    assert response.status_code == 400
    assert "score" in response.json()["detail"].lower()


def test_reference_audio_nonexistent_session(api_context):
    client, _ = api_context

    response = request_reference(
        client,
        str(uuid4()),
    )

    assert response.status_code == 404


def test_reference_audio_other_user_session(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    app.dependency_overrides[get_current_user] = (
        lambda: OTHER_USER
    )

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 404


def test_reference_audio_unauthenticated(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    app.dependency_overrides.pop(
        get_current_user,
        None,
    )

    response = request_reference(
        client,
        analyzed_session,
    )

    assert response.status_code == 401


def test_reference_audio_metadata_headers(
    api_context,
    analyzed_session,
):
    client, _ = api_context

    response = client.get(
        f"/sessions/{analyzed_session}/reference-audio",
        params={
            "start_measure": 2,
            "end_measure": 2,
        },
        headers={
            "Origin": "http://localhost:5173",
        },
    )

    assert response.status_code == 200

    assert float(response.headers["X-Tempo-BPM"]) == 120
    assert response.headers["X-Tempo-Source"] == "score"

    assert float(
        response.headers["X-Audio-Duration"]
    ) == pytest.approx(1.0, abs=0.001)

    assert (
        "reference_measures_2_2.wav"
        in response.headers["Content-Disposition"]
    )

    assert response.headers["Cache-Control"] == "no-store"

    exposed_headers = response.headers[
        "access-control-expose-headers"
    ].lower()

    assert "x-tempo-bpm" in exposed_headers
    assert "x-tempo-source" in exposed_headers
    assert "x-audio-duration" in exposed_headers