
"""Integration tests for the AI practice feedback endpoint."""

from uuid import uuid4
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from database import get_db
from main import app
from models import PracticeSession
from music_analysis.ai_feedback import AIPracticeFeedback, PracticeRecommendation



from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db


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
    """Use the same test database for API requests."""
    def override_get_db():
        db = test_db()
        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


@pytest.fixture
def session_factory(test_db):
    """Create practice sessions in the isolated test database."""
    def create(db, performance_summary=None):
        session = PracticeSession(
            status="audio_analyzed" if performance_summary else "created",
            performance_summary=performance_summary,
        )

        db.add(session)
        db.commit()
        db.refresh(session)

        return session

    return create



@pytest.fixture
def sample_summary():
    return {
        "metrics": {
            "pitch_accuracy": {"accuracy_percent": 85},
            "rhythmic_accuracy": {"accuracy_percent": 72},
        },
        "note_feedback": [
            {
                "measure": 2,
                "beat": 1,
                "pitch_status": "correct",
                "timing_status": "late",
            }
        ],
        "problem_areas": [],
    }


def test_ai_feedback_success(client, session_factory, sample_summary, test_db):
    db = test_db()

    try:
        session = session_factory(db, sample_summary)
        session_id = str(session.id)
    finally:
        db.close()

    mocked_feedback = AIPracticeFeedback(
        overall_assessment="Rhythmic accuracy needs improvement.",
        recommendations=[
            PracticeRecommendation(
                measure=2,
                error_type="late_note",
                exercise=(
                    "Practice measure 2 slowly with a metronome "
                    "to improve note onset timing."
                ),
            )
        ],
        next_session_goal=(
            "Increase rhythmic accuracy from 72% "
            "to at least 77% in the next practice session."
        ),
    )

    with patch(
        "main.generate_ai_feedback",
        return_value=mocked_feedback,
    ) as mock_generate:
        response = client.post(
            f"/sessions/{session_id}/ai-feedback"
        )

    assert response.status_code == 200
    assert response.json()["ai_feedback"]["recommendations"][0][
        "error_type"
    ] == "late_note"

    mock_generate.assert_called_once_with(
        sample_summary,
        score_summary=None,
    )

    # Verify that feedback was persisted in PostgreSQL.
    saved_response = client.get(f"/sessions/{session_id}")

    assert saved_response.status_code == 200
    assert saved_response.json()["ai_feedback"] == (
        mocked_feedback.model_dump(mode="json")
    )


def test_ai_feedback_missing_session(client):
    missing_id = uuid4()

    response = client.post(
        f"/sessions/{missing_id}/ai-feedback"
    )

    assert response.status_code == 404


def test_ai_feedback_without_analysis(client, session_factory, test_db):
    db = test_db()

    try:
        session = session_factory(db)
        session_id = str(session.id)
    finally:
        db.close()

    with patch("main.generate_ai_feedback") as mock_generate:
        response = client.post(
            f"/sessions/{session_id}/ai-feedback"
        )

    assert response.status_code == 409
    mock_generate.assert_not_called()


def test_ai_feedback_can_be_retrieved(
    client,
    session_factory,
    sample_summary,
    test_db,
):
    db = test_db()

    try:
        session = session_factory(db, sample_summary)
        session_id = str(session.id)
    finally:
        db.close()

    response = client.get(f"/sessions/{session_id}")

    assert response.status_code == 200
    assert response.json()["performance_summary"] == sample_summary
    assert response.json()["ai_feedback"] is None
