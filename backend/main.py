"""
Virtual Music Instructor - Backend Prototype (Week 1, Sprint 1)

Goal for this week:
- Run a FastAPI server locally.
- Receive an uploaded MusicXML file from the frontend.
- Parse it with music21 and extract basic info (notes, pitches,
  durations, measures, tempo) to confirm the pipeline works end to end.

This is intentionally minimal / not production-structured yet -
error handling, validation, and persistence come in later sprints.
"""

import shutil
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from music21 import converter, tempo
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import PracticeSession

app = FastAPI(title="Virtual Music Instructor - Backend Prototype")

# Allow the local React dev server (default Vite/CRA ports) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Creates the practice_sessions table if it doesn't exist yet. Fine for
# a prototype; a real migration tool (Alembic) can replace this later.
Base.metadata.create_all(bind=engine)

ALLOWED_EXTENSIONS = {".xml", ".musicxml", ".mxl"}


@app.get("/")
def health_check():
    """Simple endpoint to confirm the server is running."""
    return {"status": "ok", "message": "Virtual Music Instructor backend is running"}


@app.post("/sessions")
def create_session(db: Session = Depends(get_db)):
    """
    US-01 - Create Practice Session.
    Creates a new (empty) practice session row and returns its id, so
    the frontend has something to attach an uploaded score to.
    """
    session = PracticeSession(status="created")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": str(session.id), "status": session.status}


@app.get("/sessions/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):
    """Fetch a stored session - groundwork for US-20 (review practice history)."""
    session = db.get(PracticeSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": str(session.id),
        "status": session.status,
        "score_filename": session.score_filename,
        "score_summary": session.score_summary,
        "created_at": session.created_at,
    }


@app.post("/sessions/{session_id}/upload-score")
async def upload_score(session_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Receive a MusicXML file, save it temporarily, parse it with music21,
    and persist the extracted summary onto the given practice session.

    This corresponds to US-02 (Upload MusicXML Score) and the start
    of US-03/US-04 (extracting pitches, durations, measures, tempo),
    now wired into US-01's session + persistent storage (AR-08).
    """
    session = db.get(PracticeSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Expected one of {ALLOWED_EXTENSIONS}.",
        )

    # Save the upload to a temp file so music21's converter can read it.
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        score = converter.parse(tmp_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse MusicXML file: {exc}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    notes_info = extract_basic_info(score)

    session.score_filename = file.filename
    session.score_summary = notes_info
    session.status = "score_uploaded"
    db.commit()
    db.refresh(session)

    return {
        "session_id": str(session.id),
        "filename": file.filename,
        "status": session.status,
        "summary": notes_info,
    }


def extract_basic_info(score) -> dict:
    """
    Pull out the basic elements the Week 1 goal calls for:
    notes, pitches, durations, measures, tempo.

    Kept intentionally simple - full extraction logic (matching FR-03
    from the requirements doc) will be built out as its own component
    in a later sprint.
    """
    flat = score.flatten()
    note_list = flat.notes

    notes_summary = []
    for n in note_list[:20]:  # cap preview to first 20 notes
        if n.isChord:
            pitches = [p.nameWithOctave for p in n.pitches]
        else:
            pitches = [n.pitch.nameWithOctave]
        notes_summary.append(
            {
                "pitches": pitches,
                "duration_quarterLength": n.duration.quarterLength,
                "offset": n.offset,
            }
        )

    # recurse() (not flatten()) is needed here - some MusicXML exports nest
    # the tempo mark inside a part rather than at the top level of the score.
    tempo_marks = score.recurse().getElementsByClass(tempo.MetronomeMark)
    tempo_bpm = tempo_marks[0].number if len(tempo_marks) > 0 else None

    num_measures = len(score.parts[0].getElementsByClass("Measure")) if score.parts else None

    return {
        "total_notes_detected": len(note_list),
        "num_measures": num_measures,
        "tempo_bpm": tempo_bpm,
        "first_notes_preview": notes_summary,
    }


# Run locally with: uvicorn main:app --reload
