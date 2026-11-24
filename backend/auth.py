"""
User authentication: email/password and Google sign-in.

Both login methods return the same signed access token (a JWT). The
frontend sends it back as "Authorization: Bearer <token>" on every
request, and get_current_user turns it back into the logged-in User.

Environment variables (see .env.example):
    JWT_SECRET        - secret used to sign access tokens (required,
                        at least 32 characters)
    GOOGLE_CLIENT_ID  - OAuth client ID from Google Cloud Console
                        (required only for Google sign-in)
"""

import os
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User


ACCESS_TOKEN_LIFETIME = timedelta(hours=24)
JWT_ALGORITHM = "HS256"

# HS256 signing keys should be at least 32 bytes.
MIN_JWT_SECRET_LENGTH = 32

MIN_PASSWORD_LENGTH = 8

# bcrypt only uses the first 72 bytes of a password.
MAX_PASSWORD_BYTES = 72

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Shown when an email belongs to an account created with Google sign-in,
# which has no password.
GOOGLE_ONLY_LOGIN_MESSAGE = (
    "This account uses Google sign-in. "
    "Use the Sign in with Google button."
)
GOOGLE_ONLY_SIGNUP_MESSAGE = (
    "This email is already registered with Google. "
    "Use Sign in with Google."
)

# Compared against when an email is not registered, so a failed login
# takes the same time whether or not the account exists.
_UNUSED_PASSWORD_HASH = bcrypt.hashpw(b"unused", bcrypt.gensalt()).decode()

router = APIRouter(prefix="/auth", tags=["auth"])

bearer_scheme = HTTPBearer(auto_error=False)


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleLoginRequest(BaseModel):
    # The ID token Google Identity Services gives the frontend.
    credential: str


def _jwt_secret():
    secret = os.getenv("JWT_SECRET")

    if not secret:
        raise RuntimeError(
            "JWT_SECRET is not set. Add it to backend/.env."
        )

    if len(secret) < MIN_JWT_SECRET_LENGTH:
        raise RuntimeError(
            f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} "
            "characters long."
        )

    return secret


def normalize_email(email):
    return email.strip().lower()


def hash_password(password):
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password, password_hash):
    password_bytes = password.encode("utf-8")

    if len(password_bytes) > MAX_PASSWORD_BYTES:
        return False

    return bcrypt.checkpw(
        password_bytes,
        password_hash.encode("utf-8"),
    )


def create_access_token(user):
    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user.id),
        "iat": now,
        "exp": now + ACCESS_TOKEN_LIFETIME,
    }

    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def verify_google_credential(credential):
    """
    Verify a Google ID token and return its claims.

    Checks the signature, expiry, and that the token was issued for this
    app's client ID.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID")

    if not client_id:
        raise HTTPException(
            status_code=503,
            detail="Google sign-in is not configured.",
        )

    try:
        return id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Google sign-in could not be verified.",
        )


def _unauthorized(detail):
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """FastAPI dependency - returns the logged-in User or responds 401."""
    if credentials is None:
        raise _unauthorized("Not logged in.")

    try:
        payload = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=[JWT_ALGORITHM],
        )
        user_id = UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise _unauthorized("Your session has expired. Please log in again.")

    user = db.get(User, user_id)

    if user is None:
        raise _unauthorized("Your session has expired. Please log in again.")

    return user


def _user_response(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
    }


def _token_response(user):
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": _user_response(user),
    }


@router.post("/signup", status_code=201)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    """Create an account with an email and password, and log it in."""
    email = normalize_email(request.email)

    if not EMAIL_PATTERN.match(email):
        raise HTTPException(
            status_code=400,
            detail="Enter a valid email address.",
        )

    if len(request.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Password must be at least {MIN_PASSWORD_LENGTH} "
                "characters."
            ),
        )

    if len(request.password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Password is too long.",
        )

    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user is not None:
        # Sign-up cannot add a password to an existing account: anyone
        # who knew the email could then take the account over.
        if existing_user.google_id and not existing_user.password_hash:
            detail = GOOGLE_ONLY_SIGNUP_MESSAGE
        else:
            detail = "An account with this email already exists."

        raise HTTPException(status_code=409, detail=detail)

    name = (request.name or "").strip() or None

    user = User(
        email=email,
        name=name,
        password_hash=hash_password(request.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Log in with an email and password."""
    email = normalize_email(request.email)

    user = db.query(User).filter(User.email == email).first()

    password_hash = (
        user.password_hash
        if user is not None and user.password_hash
        else _UNUSED_PASSWORD_HASH
    )

    password_matches = verify_password(request.password, password_hash)

    # The account exists but has no password to check against.
    # Sign-up already reveals that an email is registered, so saying so
    # here exposes nothing new.
    if user is not None and not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail=GOOGLE_ONLY_LOGIN_MESSAGE,
        )

    if user is None or not password_matches:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    return _token_response(user)


@router.post("/google")
def google_login(
    request: GoogleLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Log in with Google, creating the account on first use.

    A Google account whose verified email matches an existing
    email/password account is linked to it, so both methods reach the
    same user and practice sessions.
    """
    claims = verify_google_credential(request.credential)

    google_id = claims["sub"]
    email = normalize_email(claims.get("email", ""))

    user = db.query(User).filter(User.google_id == google_id).first()

    if user is None and email:
        user = db.query(User).filter(User.email == email).first()

        if user is not None:
            if not claims.get("email_verified"):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "An account with this email already exists. "
                        "Log in with your email and password."
                    ),
                )

            user.google_id = google_id

    if user is None:
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Your Google account did not share an email address.",
            )

        user = User(
            google_id=google_id,
            email=email,
            name=claims.get("name"),
        )
        db.add(user)

    if user.name is None and claims.get("name"):
        user.name = claims["name"]

    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """Return the logged-in user."""
    return _user_response(user)
