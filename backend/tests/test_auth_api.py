"""Integration tests for login, sign-up, and practice-session ownership."""

import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from auth import JWT_ALGORITHM, get_current_user
from database import Base, get_db
from main import app
from models import User


PASSWORD = "correct-horse-battery"


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


@pytest.fixture
def google_configured(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")


def signup(client, email="student@example.com", password=PASSWORD, name="Student"):
    return client.post(
        "/auth/signup",
        json={"email": email, "password": password, "name": name},
    )


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def google_login(client, claims):
    with patch(
        "auth.id_token.verify_oauth2_token",
        return_value=claims,
    ):
        return client.post(
            "/auth/google",
            json={"credential": "google-id-token"},
        )


# Sign-up

def test_signup_creates_account_and_logs_in(client):
    response = signup(client)

    assert response.status_code == 201

    data = response.json()

    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student@example.com"
    assert data["user"]["name"] == "Student"

    me = client.get("/auth/me", headers=auth_header(data["access_token"]))

    assert me.status_code == 200
    assert me.json() == data["user"]


def test_signup_stores_password_as_hash(client, test_db):
    signup(client)

    with test_db() as db:
        user = db.query(User).one()

    assert user.password_hash is not None
    assert PASSWORD not in user.password_hash
    assert user.google_id is None


def test_signup_normalizes_email(client):
    response = signup(client, email="  Student@Example.COM ")

    assert response.status_code == 201
    assert response.json()["user"]["email"] == "student@example.com"


def test_signup_rejects_duplicate_email(client):
    signup(client)

    response = signup(client, email="STUDENT@example.com")

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "An account with this email already exists."
    )


@pytest.mark.parametrize("email", ["", "not-an-email", "a@b", "a b@c.com"])
def test_signup_rejects_invalid_email(client, email):
    response = signup(client, email=email)

    assert response.status_code == 400
    assert response.json()["detail"] == "Enter a valid email address."


def test_signup_rejects_short_password(client):
    response = signup(client, password="short")

    assert response.status_code == 400
    assert "at least 8 characters" in response.json()["detail"]


def test_signup_rejects_password_longer_than_bcrypt_limit(client):
    response = signup(client, password="x" * 73)

    assert response.status_code == 400
    assert response.json()["detail"] == "Password is too long."


# Email and password login

def test_login_with_correct_password(client):
    signup(client)

    response = client.post(
        "/auth/login",
        json={"email": "Student@Example.com", "password": PASSWORD},
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    assert client.get("/auth/me", headers=auth_header(token)).status_code == 200


def test_login_with_wrong_password(client):
    signup(client)

    response = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_login_with_unknown_email_gives_same_error(client):
    response = client.post(
        "/auth/login",
        json={"email": "nobody@example.com", "password": PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_password_login_fails_for_google_only_account(
    client,
    google_configured,
):
    google_login(
        client,
        {
            "sub": "google-123",
            "email": "student@example.com",
            "email_verified": True,
        },
    )

    response = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "This account uses Google sign-in. "
        "Use the Sign in with Google button."
    )


def test_signup_with_google_only_email_points_to_google(
    client,
    google_configured,
    test_db,
):
    google_login(
        client,
        {
            "sub": "google-123",
            "email": "student@example.com",
            "email_verified": True,
        },
    )

    response = signup(client)

    assert response.status_code == 409
    assert response.json()["detail"] == (
        "This email is already registered with Google. "
        "Use Sign in with Google."
    )

    # The Google account did not gain a password.
    with test_db() as db:
        assert db.query(User).one().password_hash is None


# Access tokens

def test_me_requires_login(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "Not logged in."


def test_me_rejects_tampered_token(client):
    token = signup(client).json()["access_token"]

    response = client.get("/auth/me", headers=auth_header(token + "x"))

    assert response.status_code == 401


def test_me_rejects_expired_token(client, test_db):
    signup(client)

    with test_db() as db:
        user = db.query(User).one()

    expired = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        os.environ["JWT_SECRET"],
        algorithm=JWT_ALGORITHM,
    )

    response = client.get("/auth/me", headers=auth_header(expired))

    assert response.status_code == 401
    assert "expired" in response.json()["detail"]


# Google sign-in

def test_google_login_creates_account(client, google_configured, test_db):
    response = google_login(
        client,
        {
            "sub": "google-123",
            "email": "Student@Example.com",
            "email_verified": True,
            "name": "Google Student",
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "student@example.com"
    assert response.json()["user"]["name"] == "Google Student"

    with test_db() as db:
        user = db.query(User).one()

    assert user.google_id == "google-123"
    assert user.password_hash is None


def test_google_login_returns_same_account_next_time(
    client,
    google_configured,
):
    claims = {
        "sub": "google-123",
        "email": "student@example.com",
        "email_verified": True,
    }

    first = google_login(client, claims).json()["user"]
    second = google_login(client, claims).json()["user"]

    assert first["id"] == second["id"]


def test_google_login_links_existing_password_account(
    client,
    google_configured,
    test_db,
):
    password_user = signup(client).json()["user"]

    response = google_login(
        client,
        {
            "sub": "google-123",
            "email": "student@example.com",
            "email_verified": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["id"] == password_user["id"]

    # Both login methods still work for the linked account.
    password_login = client.post(
        "/auth/login",
        json={"email": "student@example.com", "password": PASSWORD},
    )

    assert password_login.status_code == 200

    with test_db() as db:
        assert db.query(User).count() == 1


def test_google_login_does_not_link_unverified_email(
    client,
    google_configured,
):
    signup(client)

    response = google_login(
        client,
        {
            "sub": "google-123",
            "email": "student@example.com",
            "email_verified": False,
        },
    )

    assert response.status_code == 409


def test_google_login_rejects_invalid_token(client, google_configured):
    with patch(
        "auth.id_token.verify_oauth2_token",
        side_effect=ValueError("bad token"),
    ):
        response = client.post(
            "/auth/google",
            json={"credential": "not-a-real-token"},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == (
        "Google sign-in could not be verified."
    )


def test_google_login_when_not_configured(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)

    response = client.post(
        "/auth/google",
        json={"credential": "google-id-token"},
    )

    assert response.status_code == 503


# Practice-session ownership

def test_creating_a_session_requires_login(client):
    response = client.post("/sessions")

    assert response.status_code == 401


def test_user_can_open_own_session(client):
    token = signup(client).json()["access_token"]

    session_id = client.post(
        "/sessions",
        headers=auth_header(token),
    ).json()["session_id"]

    response = client.get(
        f"/sessions/{session_id}",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["session_id"] == session_id


def test_user_cannot_open_another_users_session(client):
    owner_token = signup(client).json()["access_token"]
    other_token = signup(
        client,
        email="other@example.com",
    ).json()["access_token"]

    session_id = client.post(
        "/sessions",
        headers=auth_header(owner_token),
    ).json()["session_id"]

    for method, path in [
        ("get", f"/sessions/{session_id}"),
        ("post", f"/sessions/{session_id}/ai-feedback"),
    ]:
        response = getattr(client, method)(
            path,
            headers=auth_header(other_token),
        )

        assert response.status_code == 404

    upload = client.post(
        f"/sessions/{session_id}/upload-score",
        headers=auth_header(other_token),
        files={"file": ("score.musicxml", b"<score/>", "application/xml")},
    )

    assert upload.status_code == 404


def test_invalid_session_id_is_not_found(client):
    token = signup(client).json()["access_token"]

    response = client.get(
        "/sessions/not-a-uuid",
        headers=auth_header(token),
    )

    assert response.status_code == 404
