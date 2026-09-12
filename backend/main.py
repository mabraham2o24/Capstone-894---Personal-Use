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

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from music21 import converter, tempo

app = FastAPI(title="Virtual Music Instructor - Backend Prototype")

# Allow the local React dev server (default Vite/CRA ports) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTENSIONS = {".xml", ".musicxml", ".mxl"}


@app.get("/")
def health_check():
    """Simple endpoint to confirm the server is running."""
    return {"status": "ok", "message": "Virtual Music Instructor backend is running"}


@app.post("/upload")
async def upload_score(file: UploadFile = File(...)):
    """
    Receive a MusicXML file, save it temporarily, and parse it with
    music21 to extract basic score information.

    This corresponds to US-02 (Upload MusicXML Score) and the start
    of US-03/US-04 (extracting pitches, durations, measures, tempo).
    """
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

    return {
        "filename": file.filename,
        "status": "received_and_parsed",
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
