"""
SQLAlchemy models.

PracticeSession is the first table we need per US-01 (Create Practice
Session) and lays the groundwork for FR-14 (store and review past
results) - for now it just tracks a session and whatever score info
we've extracted from an uploaded MusicXML file. Audio/analysis fields
will be added as US-05 onward come online.
"""

import uuid
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class User(Base):
    """
    A user signs in with Google, with an email and password, or both.

    google_id is the stable "sub" claim from Google's ID token, used to
    look up the same user on future Google logins. password_hash holds a
    bcrypt hash for email/password logins; the password itself is never
    stored. A user has at least one of the two.
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # The user who created the session. Sessions created before login
    # existed have no owner.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    # Populated once a MusicXML score has been uploaded (US-02/US-03/US-04)
    score_filename = Column(String, nullable=True)
    score_summary = Column(JSON, nullable=True)  # notes/measures/tempo, etc.

    # Populated once a performance audio file has been uploaded and analyzed
    # (US-05/US-07/US-08)
    audio_filename = Column(String, nullable=True)
    detected_pitches = Column(JSON, nullable=True)
    note_events = Column(JSON, nullable=True)

    # Persist analysis results for AI feedback and practice history.
    performance_analysis = Column(JSON, nullable=True)
    performance_summary = Column(JSON, nullable=True)
    ai_feedback = Column(JSON, nullable=True)

    status = Column(String, default="created")  # created -> score_uploaded -> ...
