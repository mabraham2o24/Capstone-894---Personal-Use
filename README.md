# Virtual Music Instructor (VMI)

**SWENG 894 Capstone | Penn State | Instructor setup and demonstration guide**

VMI is a local web application that compares a musical performance against a MusicXML score. A React/Vite interface allows users to upload sheet music, select a measure range, and either upload an existing WAV recording or record a new performance directly through their microphone.

A FastAPI backend extracts musical features, compares performed and expected notes, and reports pitch, rhythm, tempo, and note-sequence accuracy, along with timing/duration differences and note-level feedback. PostgreSQL stores practice sessions and analysis results.

The application also supports optional AI-generated practice recommendations through a local Ollama model, with deterministic fallback feedback when the model is unavailable.

> **Start here:** For an instructor demonstration, follow [1. Prerequisites](#1-prerequisites), [2. Install and configure](#2-install-and-configure), [3. Start the application](#3-start-the-application), then [4. Run a sample performance](#4-run-a-sample-performance). The repository includes sample MusicXML scores and WAV recordings for testing without a microphone. Alternatively, you can record a performance directly in the browser using the microphone-recording feature.

## 1. Prerequisites

| Software | Required for | Notes |
| --- | --- | --- |
| [Git](https://git-scm.com/downloads) | Cloning the project | Check with `git --version`. |
| [Node.js and npm](https://nodejs.org/) | React frontend | Use a current Node.js release compatible with Vite 8 (Node.js **20.19+ or 22.12+**); check `node --version` and `npm --version`. |
| [Python](https://www.python.org/downloads/) | FastAPI and audio analysis | **Python 3.14** is used by the repository's backend CI. Audio-library wheels are platform/version dependent; if installation fails, check compatibility and try the CI version. |
| [PostgreSQL](https://www.postgresql.org/download/) | Persistent sessions | PostgreSQL 16 is used in CI; other compatible modern versions may also work. |
| Optional: [Ollama](https://ollama.com/) | Local LLM-generated feedback *through the API* | **Not required** for the standard browser demo. |

The Python audio stack may require native audio support (`libsndfile` and `ffmpeg` are installed in CI). On macOS with Homebrew, `brew install libsndfile ffmpeg` is one option; Windows users should follow the audio libraries' platform-specific installation instructions if dependency or codec errors occur.

## 2. Install and configure

### A. Clone the repository

Open **PowerShell** (Windows) or **Terminal** (macOS):

```bash
git clone https://github.com/mabraham2o24/Capstone-894---Personal-Use.git
cd Capstone-894---Personal-Use
```

The **repository root** contains `package.json`, `package-lock.json`, `src/`, and `backend/`.

### B. Create a local PostgreSQL database

Start the PostgreSQL server. In pgAdmin's Query Tool, or a `psql` session connected as an administrator, execute:

```sql
CREATE USER vmi_user WITH PASSWORD 'choose_a_local_password';
CREATE DATABASE vmi_dev OWNER vmi_user;
```

Change the password to one of your own. If the database/user already exists, do not recreate it. On Windows, PostgreSQL can be started through **Services**; on a Homebrew installation of macOS, use `brew services list` to check its status.

**Database URL:** From the `backend/` directory, copy the committed template to a local file:

**Windows PowerShell:**
```powershell
cd backend
Copy-Item .env.example .env
```

**macOS:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` to contain a **local** connection string (replacing the password):

```dotenv
DATABASE_URL=postgresql://vmi_user:choose_a_local_password@localhost:5432/vmi_dev
```

The repository's `.env.example` shows a **remote/shared PostgreSQL example** with `sslmode=require`. For a standard local PostgreSQL installation, use the local URL above and omit that shared-server SSL setting. Database configuration is read using `python-dotenv` from `backend/database.py`. **Never commit `.env`, passwords, or database connection secrets.**

On startup, `backend/main.py` calls `Base.metadata.create_all(bind=engine)` to create any missing mapped tables. This works for a **new database**, but it does **not** add missing columns to an existing table. For an older VMI database that lacks the AI-feedback/analysis columns, run the included migration (from the repository root):

```bash
psql -U vmi_user -h localhost -d vmi_dev -f backend/migrations/001_add_ai_feedback_columns.sql
```

You will be prompted for the password. This migration is typically unnecessary for a fresh database because the current model creates the columns. See `backend/migrations/README.md` for more detail.

### C. Install backend dependencies

In the **`backend/`** folder, create and activate a virtual environment.

**Windows PowerShell:**
```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and try activating again.

**macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

`backend/requirements.txt` is the source of truth for Python dependencies; it includes FastAPI, Uvicorn, SQLAlchemy/PostgreSQL drivers, `music21`, `librosa`, and test dependencies. Installation may take time because the numerical/audio packages have compiled components.

### D. Install frontend dependencies

Open a **second terminal in the repository root** (the folder with `package.json`):

```bash
npm ci
```

This installs the versions resolved in `package-lock.json`. **Do not run this from `backend/`.**

## 3. Start the application

Three local components are involved: PostgreSQL, FastAPI, and React/Vite.

1. **PostgreSQL:** Verify that your local database server is running.
2. **Backend terminal (`backend/`):** Activate `.venv` if necessary and run:

   ```bash
   python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

   Confirm that [http://127.0.0.1:8000/](http://127.0.0.1:8000/) returns `{"status":"ok",...}` and that [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) opens the FastAPI documentation.
3. **Frontend terminal (repository root):** Run:

   ```bash
   npm run dev -- --host localhost --port 5173 --strictPort
   ```

   Open [http://localhost:5173/](http://localhost:5173/).

Keep **both terminals running** while using the site. The frontend calls the API at `http://127.0.0.1:8000`, and the backend allows the `http://localhost:5173` origin. The explicit `--strictPort` option avoids silently switching Vite to an unsupported port.

## 4. Run a sample performance

The repository already includes score/audio examples. This pair is a convenient starting point:

| File | Repository path | Purpose |
| --- | --- | --- |
| Sample MusicXML score | `backend/test_music/Canon_in_D/canon-in-d.mxl` | Reference musical score |
| Matching WAV recording | `backend/test_music/Canon_in_D/performances/canon_measures_3_6_correct.wav` | Recording intended for **measures 3–6** |

Other sample files in the same `performances/` folder demonstrate late notes, pitch errors, missing notes, and note-duration errors. `backend/test_music/Minuet_in_F/` also includes score/recording pairs for several instruments. **Use score and audio from the same composition, and select the measure range indicated by the recording's filename.**

Follow the browser workflow:

1. At `http://localhost:5173/`, use the **Login** button to enter the dashboard. **Authentication is a prototype:** no real account credentials or Google sign-in are required by the current frontend.
2. Click **Start Practice Session** and upload `canon-in-d.mxl`. The application creates a session and parses the score.
3. On **Score Processing**, review the extracted musical data, then enter **starting measure `3` and ending measure `6`**. Click **Upload Performance**.
4. On the **Performance Upload** page, choose one of the following methods:

   **Option A — Upload an existing WAV recording (recommended for reproducible testing)**
      - Select **Upload Audio File**.
      - Choose `backend/test_music/Canon_in_D/performances/canon_measures_3_6_correct.wav`.
      - Confirm that the selected measure range is 3–6.
      - Click **Upload Performance** to submit the audio for analysis.

   **Option B — Record a new performance using the microphone**
      - Use a computer with a working microphone and grant microphone access when prompted by the browser.
      - Click **Start Recording**.
      - Perform the selected passage of music.
      - Click **Stop Recording** when finished.
      - Play the recorded audio preview to confirm that the performance was captured correctly.
      - If necessary, discard the recording and try again.
      - Click **Upload Performance** to submit the recorded audio for analysis.

      The recording feature captures microphone audio and converts it to a WAV file before submitting it through the same backend analysis endpoint used for uploaded files.

5. Review the **Performance Results** page. The application displays available performance metrics, including pitch accuracy, rhythmic accuracy, tempo consistency, and note-sequence accuracy, along with note-level feedback and detected performance errors. Exact results depend on the recording and analysis outcome; unavailable metrics may appear as N/A.

6. To test intentional performance errors, start a new practice session using the same score and measure range, then upload one of the provided test recordings:

   - `canon_measures_3_6_late_note.wav` — timing error
   - `canon_measures_3_6_incorrect_pitch.wav` — pitch error
   - `canon_measures_3_6_long_note.wav` — duration error
   - `canon_measures_3_6_missing.wav` — missing-note scenario
   - `canon_measures_3_6_extra2.wav` — additional-note scenario

   These recordings are provided to exercise different analysis scenarios. Actual detected errors and accuracy values depend on the backend's analysis results.

**Important notation limitation:** The **Annotated Sheet Music** panel currently loads `public/sample_long.musicxml`, **not** the uploaded MusicXML. Its colored noteheads and clickable error descriptions are **frontend mock data** in `src/components/AnnotatedSheetMusic.jsx`, not errors from the current recording. Use the results metrics and feedback tables, rather than that visual panel, to evaluate actual backend analysis.

**Navigation limitation:** The frontend passes the active session in page-navigation state. Refreshing a later workflow page or navigating directly to its URL may lose the currently displayed results; restart at **Start Practice Session** if this occurs.

## 5. AI practice feedback (optional API demonstration)

The backend includes `POST /sessions/{session_id}/ai-feedback`, which creates personalized practice recommendations from a **previously analyzed session**. **The current frontend does not expose this as a completed browser workflow.** For a backend demonstration, use FastAPI Swagger UI at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

After finishing the sample browser workflow:

1. Copy the **session ID** shown in the application (for example, on the performance upload/results screens).
2. In Swagger UI, open `POST /sessions/{session_id}/ai-feedback`, click **Try it out**, enter the session ID, and execute.
3. Inspect the JSON response's `ai_feedback` field, which contains an assessment, recommendations, and a suggested next-session goal. You can also inspect `GET /sessions/{session_id}` for persisted results.

To enable **LLM-generated** recommendations, install and start [Ollama](https://ollama.com/), then pull the model used by the backend:

```bash
ollama pull llama3.2:3b
ollama list
```

Ensure the Ollama service is running (typically on port `11434`). The code defaults to `OLLAMA_URL=http://localhost:11434/api/generate` and `OLLAMA_MODEL=llama3.2:3b`; these can be overridden through environment variables before starting FastAPI. **Ollama is optional:** if its request fails or its response is invalid, the backend has deterministic fallback feedback. Therefore, an API response alone does **not** prove the LLM ran successfully; check the backend logs if demonstrating specifically the local model. If no performance summary is available, the endpoint returns an error instead of feedback.

## 6. Automated testing

**Backend** (from `backend/`, with the virtual environment active and an isolated local test database configured):

```bash
python -m pytest -q
```

To run the repository's CI-style coverage reporting, install `pytest-cov` if needed and run:

```bash
python -m pip install pytest-cov
python -m pytest --cov=music_analysis --cov-report=term-missing -q
```

The GitHub Actions workflow `.github/workflows/backend-ci.yml` runs backend tests against PostgreSQL 16 with Python 3.14 and installs `libsndfile1` and `ffmpeg`. **Tests may create or change database records; do not run them against a shared or production database.**

**Frontend:** From the repository root (the directory containing package.json), run:

```
npx vitest run
```

This executes the complete frontend test suite once without entering interactive watch mode.

## 7. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Backend fails at startup with a database error | PostgreSQL is running, `backend/.env` exists, `DATABASE_URL` has the right credentials/port/database, and the user can connect with `psql`. Database access is needed when `main.py` imports. |
| `relation "practice_sessions" does not exist` or missing analysis columns | Use a fresh local database or inspect `backend/models.py` and apply the documented migration to an existing database. |
| `No module named uvicorn`, `music21`, or `librosa` | Activate `backend/.venv` and rerun `python -m pip install -r requirements.txt`. Verify that `python` points to the virtual environment. |
| Audio processing/import errors | Confirm a supported Python build and native audio libraries; check the backend terminal for the underlying exception. |
| Website says `Failed to fetch` | Confirm API health at `http://127.0.0.1:8000/`; use `http://localhost:5173/` for Vite; do not let Vite select a different port. |
| Score upload fails | Select a supported `.xml`, `.musicxml`, or `.mxl` file; try the included `canon-in-d.mxl`. |
| WAV analysis fails or metrics are `N/A` | Use a `.wav` file that matches the uploaded score and measure range, then inspect backend errors. Low-quality/insufficient audio may not produce reliable metrics. |
| Microphone permission is denied | Allow microphone access for `http://localhost:5173` in the browser's site permissions. If access was previously blocked, update the permission and retry recording. |
| Start Recording fails or the microphone is unavailable | Confirm that a microphone is connected, recognized by the operating system, and not blocked by privacy settings. Use a modern browser that supports `getUserMedia`, Web Audio, and AudioWorklet. Access the application through `http://localhost:5173`, which is treated as a trustworthy local origin. |
| Recording is empty or no audio is captured | Confirm that the correct microphone is selected and functioning. Record an audible passage before clicking **Stop Recording**. Empty recordings are rejected; retry the recording or upload an existing WAV file instead. |
| Recorded audio uploads but analysis fails | Play the audio preview to confirm that sound was captured. Check that the recording matches the uploaded MusicXML score and selected measure range. Inspect the backend terminal for analysis errors. |
| AI feedback has generic text | Ollama may be unavailable and the deterministic fallback may have been used; inspect the backend log. |
| Annotated notation or colored errors do not match the upload | Expected for this revision: the notation and its highlights are mock/demo data. |
| A results page goes blank after refresh | Start a new session from the dashboard; results are passed between frontend pages through navigation state. |

To stop the application, press **Ctrl+C** in both server terminals. Run `deactivate` to exit the Python virtual environment. PostgreSQL may remain running.

## 8. Repository reference


```text
Capstone-894---Personal-Use/
├── README.md                         # Instructor setup guide
├── package.json                      # React/Vite dependencies
├── package-lock.json
├── src/
│   ├── pages/
│   │   └── PerformanceUpload.jsx     # WAV upload and microphone recording
│   ├── utils/
│   │   └── audioRecording.js         # WAV encoding utility
│   ├── test/
│   │   └── PerformanceUpload.test.jsx # Recording and upload tests
│   └── components/                   # Frontend components
├── public/
│   └── audio-recorder-worklet.js     # Browser microphone audio capture
├── backend/
│   ├── main.py                       # FastAPI application
│   ├── database.py                   # PostgreSQL connection
│   ├── models.py                     # Database models
│   ├── .env.example                  # Configuration template
│   ├── requirements.txt              # Python dependencies
│   ├── music_analysis/               # Audio analysis and AI feedback
│   ├── migrations/                   # Database migration scripts
│   ├── test_music/
│   │   ├── Canon_in_D/               # MusicXML, PDF, MP3, WAV samples
│   │   └── Minuet_in_F/              # MusicXML, PDF, MP3, WAV samples
│   └── tests/                        # Backend automated tests
└── .github/
    └── workflows/
        └── backend-ci.yml            # Backend CI
```

### Current scope and limitations

- **Integrated browser workflow:** Create a practice session, upload a MusicXML score, select measures, upload an existing WAV recording or record audio through the microphone, and review performance analysis results.
- **Microphone recording:** The browser captures audio, converts it into a WAV file, provides an audio preview, and submits it through the existing performance-analysis API.
- **Performance analysis:** The backend calculates pitch, rhythm, tempo, and note-sequence accuracy and provides note-level feedback and detected performance errors.
- **Optional AI feedback:** Personalized practice recommendations are available through the backend API using local Ollama, with deterministic fallback feedback when the model is unavailable.
- **Annotated sheet music:** The current README identifies this visualization as demonstration data rather than a dynamically annotated rendering of the uploaded score. This limitation should be verified against the latest frontend implementation.
- **Prototype login:** The application does not currently require real user authentication.
- **Local installation:** The application runs locally and requires a PostgreSQL database. No hosted deployment or preconfigured database is included.

The README was updated on **November 23, 2026**, following implementation and verification of US-06 microphone recording. The frontend regression suite passed all 118 tests, and microphone recording was successfully validated through manual user acceptance testing.
