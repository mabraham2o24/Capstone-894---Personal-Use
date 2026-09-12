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


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Populated once a MusicXML score has been uploaded (US-02/US-03/US-04)
    score_filename = Column(String, nullable=True)
    score_summary = Column(JSON, nullable=True)  # notes/measures/tempo, etc.

    status = Column(String, default="created")  # created -> score_uploaded -> ...
