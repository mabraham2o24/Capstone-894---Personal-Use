# Virtual Music Instructor (VMI)

**SWENG 894 Capstone | Penn State | Instructor setup and demonstration guide**

VMI is a local web application that compares a recorded musical performance against a MusicXML score. A React/Vite interface lets you upload a score, select a measure range, and upload a WAV recording. A FastAPI backend extracts musical features, compares performed and expected notes, and reports accuracy metrics, timing/duration differences, and note-level feedback. PostgreSQL stores practice sessions and analysis results.

> **Start here:** For an instructor demonstration, follow [1. Prerequisites](#1-prerequisites), [2. Install and configure](#2-install-and-configure), [3. Start the application](#3-start-the-application), then [4. Run a sample performance](#4-run-a-sample-performance). The repository includes a matching MusicXML/WAV test pair; you do not need to record live audio.

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
4. Upload `canon_measures_3_6_correct.wav`. Audio processing can take longer than a normal web request because pitch and note events are extracted from the recording.
5. Review **Performance Results**. The page displays available performance metrics (pitch, rhythm, tempo, and note sequence), note-level pitch/timing/duration statuses, error counts, and problem areas. Exact values depend on the recording and analysis outcome; an unavailable metric can appear as `N/A`.
6. For a deliberate-error comparison, start a **new practice session** with the same score and measure range and upload `canon_measures_3_6_late_note.wav` or `canon_measures_3_6_incorrect_pitch.wav` instead.

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

**Frontend:** Navigate to the repository root. Check the `scripts` section in `package.json` for the available test command. If a `test` script is defined, run:

```
npm test
```

If a `test:run` script is defined instead, run:

```
npm run test:run
```

Use the command supported by the current `package.json`.

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
| AI feedback has generic text | Ollama may be unavailable and the deterministic fallback may have been used; inspect the backend log. |
| Annotated notation or colored errors do not match the upload | Expected for this revision: the notation and its highlights are mock/demo data. |
| A results page goes blank after refresh | Start a new session from the dashboard; results are passed between frontend pages through navigation state. |

To stop the application, press **Ctrl+C** in both server terminals. Run `deactivate` to exit the Python virtual environment. PostgreSQL may remain running.

## 8. Repository reference

```text
Capstone-894---Personal-Use/
├── README.md                         # Primary instructor run guide
├── package.json, package-lock.json   # React/Vite dependencies
├── src/                              # Frontend pages and visualization
├── public/                           # Static sample MusicXML assets
├── backend/
│   ├── main.py                       # FastAPI entry point and endpoints
│   ├── database.py, models.py        # PostgreSQL persistence
│   ├── .env.example                  # Configuration template (no secrets)
│   ├── requirements.txt             # Python dependencies
│   ├── music_analysis/              # Score/audio analysis and AI feedback
│   ├── migrations/                  # Existing-database SQL migration
│   ├── test_music/                  # Sample MusicXML/WAV pairs
│   └── tests/                       # Backend automated tests
└── .github/workflows/backend-ci.yml # Backend CI
```

### Current scope and limitations

- **Integrated in the browser:** create practice session, upload MusicXML, choose measures, analyze WAV performance, and inspect numeric/note-level results.
- **Backend-only optional feature:** AI recommendations are available via API, with optional local Ollama and a deterministic fallback.
- **Demonstration-only visualization:** annotated sheet music and its colored highlights do not correspond to the current uploaded score/recording.
- **Prototype login:** no real authentication in the current browser UI.
- **Local installation:** no hosted service or preconfigured database is included; the instructor creates their own PostgreSQL database.

This README reflects the code inspected on the repository's `main` branch on **November 23, 2026**. If code or dependencies change, reconcile these instructions with the current implementation before submitting the final capstone build.
