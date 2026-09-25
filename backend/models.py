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

from sqlalchemy import JSON, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class User(Base):
    """
    Login is handled via Google OAuth, so there's no password to store -
    google_id is the stable "sub" claim from Google's ID token, used to
    look up the same user on future logins.
    """

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    google_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Populated once a MusicXML score has been uploaded (US-02/US-03/US-04)
    score_filename = Column(String, nullable=True)
    score_summary = Column(JSON, nullable=True)  # notes/measures/tempo, etc.

    # Populated once a performance audio file has been uploaded and analyzed
    # (US-05/US-07/US-08)
    audio_filename = Column(String, nullable=True)
    detected_pitches = Column(JSON, nullable=True)
    note_events = Column(JSON, nullable=True)

    status = Column(String, default="created")  # created -> score_uploaded -> ...
