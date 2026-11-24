# Virtual Music Instructor (VMI)

**SWENG 894 Capstone | Penn State | Instructor setup and demonstration guide**

VMI is a local web application that compares a musical performance against a MusicXML score. A React/Vite interface allows users to upload sheet music, select a measure range, and either upload an existing WAV recording or record a new performance directly through their microphone.

A FastAPI backend extracts musical features, compares performed and expected notes, and reports pitch, rhythm, tempo, and note-sequence accuracy, along with timing/duration differences and note-level feedback. PostgreSQL stores practice sessions and analysis results.

The Performance Results page provides audio playback for comparing the original performance with computer-generated reference audio synthesized from the uploaded MusicXML score. Reference audio is generated for the selected measure range without requiring an additional recording.

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

Edit `backend/.env` to contain a **local** connection string (replacing the password) and a `JWT_SECRET`, which signs user logins (see [E. Configure login](#e-configure-login)):

```dotenv
DATABASE_URL=postgresql://vmi_user:choose_a_local_password@localhost:5432/vmi_dev
JWT_SECRET=<random value of at least 32 characters>
```

The repository's `.env.example` shows a **remote/shared PostgreSQL example** with `sslmode=require`. For a standard local PostgreSQL installation, use the local URL above and omit that shared-server SSL setting. Database configuration is read using `python-dotenv` from `backend/database.py`. **Never commit `.env`, passwords, or database connection secrets.**

On startup, `backend/main.py` calls `Base.metadata.create_all(bind=engine)` to create any missing mapped tables. This works for a **new database**, but it does **not** add missing columns to an existing table. For an older VMI database, run the included migrations in order (from the repository root): `001` adds the AI-feedback/analysis columns, and `002` adds user login and links practice sessions to users.

```bash
psql -U vmi_user -h localhost -d vmi_dev -f backend/migrations/001_add_ai_feedback_columns.sql
psql -U vmi_user -h localhost -d vmi_dev -f backend/migrations/002_add_user_login.sql
```

You will be prompted for the password. These migrations are typically unnecessary for a fresh database because the current model creates the columns. Both are safe to rerun. See `backend/migrations/README.md` for more detail.

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

### E. Configure login

**Required: login secret.** `JWT_SECRET` in `backend/.env` signs each user's login. Use a random value of at least 32 characters; the backend refuses to log users in without one. Generate a value with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

**Optional: Google sign-in.** Email and password accounts work without this step; the **Sign in with Google** button is hidden until a client ID is configured.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, then open **Google Auth Platform** (or **APIs & Services > OAuth consent screen**) and configure an **External** app.
2. Under **Audience > Test users**, add every Google account that will sign in. While the app is in testing mode, other accounts are blocked.
3. Under **Clients** (or **APIs & Services > Credentials**), create an **OAuth client ID** of type **Web application** with these **Authorized JavaScript origins**: `http://localhost` and `http://localhost:5173`. No redirect URIs or client secret are needed.
4. Add the client ID to both configuration files:
   - `backend/.env`: `GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com`
   - `.env` in the repository root (copy `.env.example`): `VITE_GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com`

Restart both servers after changing either `.env` file. **Never commit `.env` files.**

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

1. At `http://localhost:5173/`, click **Sign Up** and create an account with an email and a password of at least 8 characters, or click **Sign in with Google** if Google sign-in is configured. You are taken to the dashboard and stay logged in for 24 hours. Use **Logout** on the dashboard to end the login.
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

   Under **Audio Review**, compare the two recordings:

   - **Your Performance:** Plays the original uploaded WAV file or microphone recording.
   - **Expected Audio:** Plays computer-generated audio synthesized from the uploaded MusicXML score for the selected measure range.

   Both players provide native browser playback controls, including play, pause, and seeking. Starting either recording automatically pauses the other.

   Reference audio uses the first available valid tempo in this order:

   1. Tempo specified in the MusicXML score.
   2. Tempo estimated from the analyzed performance when the score does not provide one.
   3. Default tempo of 120 BPM when neither is available.

   The expected audio player displays the BPM and its source. No additional reference recording or external audio-generation service is required.

6. To test intentional performance errors, start a new practice session using the same score and measure range, then upload one of the provided test recordings:

   - `canon_measures_3_6_late_note.wav` — timing error
   - `canon_measures_3_6_incorrect_pitch.wav` — pitch error
   - `canon_measures_3_6_long_note.wav` — duration error
   - `canon_measures_3_6_missing.wav` — missing-note scenario
   - `canon_measures_3_6_extra2.wav` — additional-note scenario

   These recordings are provided to exercise different analysis scenarios. Actual detected errors and accuracy values depend on the backend's analysis results.

**Important notation limitation:** The **Annotated Sheet Music** panel currently loads `public/sample_long.musicxml`, **not** the uploaded MusicXML. Its colored noteheads and clickable error descriptions are **frontend mock data** in `src/components/AnnotatedSheetMusic.jsx`, not errors from the current recording. Use the results metrics and feedback tables, rather than that visual panel, to evaluate actual backend analysis.

**Navigation and audio storage limitations:** The frontend passes the active session and original performance audio through page-navigation state. Refreshing a later workflow page or navigating directly to its URL may lose the displayed results or audio. Original WAV files are not persistently stored in PostgreSQL and are not available for historical playback. Practice session analysis results remain stored in the database.

**Reference audio limitations:** Reference audio is synthesized from parsed note pitches, durations, offsets, and rests using a single resolved tempo. It is intended for practice comparison rather than realistic instrument reproduction or complete reproduction of all MusicXML notation features. Generated reference audio is limited to five minutes.

## 5. AI practice feedback (optional API demonstration)

The backend includes `POST /sessions/{session_id}/ai-feedback`, which creates personalized practice recommendations from a **previously analyzed session**. **The current frontend does not expose this as a completed browser workflow.** For a backend demonstration, use FastAPI Swagger UI at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

After finishing the sample browser workflow:

1. Copy the **session ID** shown in the application (for example, on the performance upload/results screens).
2. Session endpoints require a login, and only the user who created a session can access it. In Swagger UI, open `POST /auth/login`, click **Try it out**, enter the email and password of the account used in the browser, and execute. Copy the `access_token` value from the response. Click **Authorize** at the top of the page, paste the token, and click **Authorize**.
3. Open `POST /sessions/{session_id}/ai-feedback`, click **Try it out**, enter the session ID, and execute.
4. Inspect the JSON response's `ai_feedback` field, which contains an assessment, recommendations, and a suggested next-session goal. You can also inspect `GET /sessions/{session_id}` for persisted results.

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

### Audio playback testing

The reference audio implementation includes tests for pitch synthesis, note duration, rests, selected measure ranges, tempo selection, WAV generation, authenticated API access, and error handling.

From `backend/`, run the targeted backend tests:

```bash
python -m pytest tests/test_reference_audio.py tests/test_reference_audio_api.py -v
```

From the repository root, run the targeted frontend tests:

```bash
npx vitest run src/test/PerformanceResults.test.jsx src/test/PerformanceUpload.test.jsx
```

To manually generate reference audio examples for Canon in D (measures 3–6) and Minuet in F (measures 1–4), run from `backend/`:

```bash
python tests/preview_reference_audio.py
```

The generated WAV files are saved locally in `backend/test_audio/`. These reproducible test artifacts are not required for normal application use.

### Latest regression results

Regression testing completed on November 24, 2026:

| Test suite | Passed | Failed |
| --- | ---: | ---: |
| Backend automated tests | 306 | 0 |
| Frontend automated tests | 155 | 0 |
| Total | 461 | 0 |

The reference audio module achieved 99% statement coverage. Overall backend statement coverage, including test files, was 98%, measured using `python -m pytest --cov=. --cov-report=term-missing`.

Manual audio playback testing passed for the supplied Canon in D and Minuet in F recordings. The microphone recording and audio transfer pipeline passed automated tests using simulated microphone input. Manual end-to-end live-recording playback verification remains planned.

## 7. Troubleshooting

| Symptom | What to check |
| --- | --- |
| Backend fails at startup with a database error | PostgreSQL is running, `backend/.env` exists, `DATABASE_URL` has the right credentials/port/database, and the user can connect with `psql`. Database access is needed when `main.py` imports. |
| `relation "practice_sessions" does not exist` or missing analysis columns | Use a fresh local database or inspect `backend/models.py` and apply the documented migration to an existing database. |
| `No module named uvicorn`, `music21`, or `librosa` | Activate `backend/.venv` and rerun `python -m pip install -r requirements.txt`. Verify that `python` points to the virtual environment. |
| Audio processing/import errors | Confirm a supported Python build and native audio libraries; check the backend terminal for the underlying exception. |
| Website says `Failed to fetch` | Confirm API health at `http://127.0.0.1:8000/`; use `http://localhost:5173/` for Vite; do not let Vite select a different port. |
| Score upload fails | Select a supported `.xml`, `.musicxml`, or `.mxl` file; try the included `canon-in-d.mxl`. |
| Login or sign-up fails with a server error mentioning `JWT_SECRET` | Add a `JWT_SECRET` of at least 32 characters to `backend/.env` (see [E. Configure login](#e-configure-login)) and restart the backend. |
| `column practice_sessions.user_id does not exist` | The database predates login. Apply `backend/migrations/002_add_user_login.sql`. |
| **Sign in with Google** button is missing | Set `VITE_GOOGLE_CLIENT_ID` in the root `.env` and restart `npm run dev`. Email and password login works without it. |
| Google shows "Access blocked" or an origin error | Open the site at `http://localhost:5173` (not `127.0.0.1`), confirm both JavaScript origins are listed for the OAuth client, and add the Google account as a test user. New origins can take a few minutes to take effect. |
| "This account uses Google sign-in" | The account was created with Google and has no password. Use **Sign in with Google**. |
| A session returns "Session not found" | Sessions are private to the user who created them. Log in as that user, or start a new session. |
| WAV analysis fails or metrics are `N/A` | Use a `.wav` file that matches the uploaded score and measure range, then inspect backend errors. Low-quality/insufficient audio may not produce reliable metrics. |
| Microphone permission is denied | Allow microphone access for `http://localhost:5173` in the browser's site permissions. If access was previously blocked, update the permission and retry recording. |
| Start Recording fails or the microphone is unavailable | Confirm that a microphone is connected, recognized by the operating system, and not blocked by privacy settings. Use a modern browser that supports `getUserMedia`, Web Audio, and AudioWorklet. Access the application through `http://localhost:5173`, which is treated as a trustworthy local origin. |
| Recording is empty or no audio is captured | Confirm that the correct microphone is selected and functioning. Record an audible passage before clicking **Stop Recording**. Empty recordings are rejected; retry the recording or upload an existing WAV file instead. |
| Recorded audio uploads but analysis fails | Play the audio preview to confirm that sound was captured. Check that the recording matches the uploaded MusicXML score and selected measure range. Inspect the backend terminal for analysis errors. |
| Original performance audio is unavailable | Start a new practice session and upload or record a performance. Original WAV files are retained during the active results workflow but are not persistently stored. |
| Expected audio fails to generate | Confirm that the backend is running, the session has been analyzed, and the selected measure range contains playable notes. Check the displayed error and backend logs. |
| Expected audio tempo differs from the recording | Check the displayed tempo source. The score tempo takes priority over the estimated performance tempo. |
| Expected audio sounds different from the original instrument | Expected audio uses synthesized tones for pitch and rhythm comparison rather than realistic instrument reproduction. |
| AI feedback has generic text | Ollama may be unavailable and the deterministic fallback may have been used; inspect the backend log. |
| Annotated notation or colored errors do not match the upload | Expected for this revision: the notation and its highlights are mock/demo data. |
| A results page goes blank after refresh | Start a new session from the dashboard; results are passed between frontend pages through navigation state. |

To stop the application, press **Ctrl+C** in both server terminals. Run `deactivate` to exit the Python virtual environment. PostgreSQL may remain running.

## 8. Repository reference


```text
Capstone-894---Personal-Use/
├── README.md                         # Instructor setup guide
├── .env.example                      # Frontend configuration template
├── package.json                      # React/Vite dependencies
├── package-lock.json
├── src/
│   ├── pages/
│   │   ├── PerformanceUpload.jsx     # WAV upload and microphone recording
│   │   └── PerformanceResults.jsx    # Analysis results and audio playback
│   ├── utils/
│   │   └── audioRecording.js          # WAV encoding utility
│   ├── test/
│   │   ├── PerformanceUpload.test.jsx # Recording and upload tests
│   │   └── PerformanceResults.test.jsx # Results and playback tests
│   └── components/                   # Frontend components
├── public/
│   └── audio-recorder-worklet.js      # Browser microphone audio capture
├── backend/
│   ├── main.py                       # FastAPI application
│   ├── auth.py                       # Login, sign-up, and Google sign-in
│   ├── database.py                   # PostgreSQL connection
│   ├── models.py                     # Database models
│   ├── .env.example                  # Configuration template
│   ├── requirements.txt              # Python dependencies
│   ├── music_analysis/               # Audio analysis and AI feedback
│   │   └── reference_audio.py        # Reference synthesis and tempo selection
│   ├── migrations/                   # Database migration scripts
│   ├── test_music/
│   │   ├── Canon_in_D/               # MusicXML, PDF, MP3, WAV samples
│   │   └── Minuet_in_F/              # MusicXML, PDF, MP3, WAV samples
│   └── tests/                        # Backend automated tests
│       ├── test_reference_audio.py   # Reference synthesis unit tests
│       ├── test_reference_audio_api.py # Reference audio API tests
│       └── preview_reference_audio.py # Manual reference audio generation
└── .github/
    └── workflows/
        └── backend-ci.yml            # Backend CI
```

### Current scope and limitations

- **Integrated browser workflow:** Create a practice session, upload a MusicXML score, select measures, upload an existing WAV recording or record audio through the microphone, and review performance analysis results with audio comparison.
- **Microphone recording:** The browser captures audio, converts it into a WAV file, provides an audio preview, and submits it through the existing performance-analysis API.
- **Performance analysis:** The backend calculates pitch, rhythm, tempo, and note-sequence accuracy and provides note-level feedback and detected performance errors.
- **Audio playback:** Users can compare their original performance recording with computer-generated reference audio for the selected measure range.
- **Reference audio generation:** The backend synthesizes WAV audio from parsed MusicXML notes and rests through the authenticated `GET /sessions/{session_id}/reference-audio?start_measure=3&end_measure=6` endpoint. Tempo is obtained from the score, estimated from the analyzed performance, or set to 120 BPM as a fallback.
- **Practice history:** Authenticated users can retrieve their previously analyzed practice sessions and stored performance results through the backend API. Historical playback of original recordings is not supported.
- **Optional AI feedback:** Personalized practice recommendations are available through the backend API using local Ollama, with deterministic fallback feedback when the model is unavailable.
- **Annotated sheet music:** The current README identifies this visualization as demonstration data rather than a dynamically annotated rendering of the uploaded score. This limitation should be verified against the latest frontend implementation.
- **User accounts:** Users sign up and log in with an email and password, or with Google when a Google OAuth client ID is configured. Each practice session belongs to the user who created it, and users can only open their own sessions.
- **Local installation:** The application runs locally and requires a PostgreSQL database. No hosted deployment or preconfigured database is included.

The README was updated on **November 24, 2026**, following implementation and verification of performance audio playback, MusicXML-based reference audio generation, and additional practice history testing. The full regression suites passed all 306 backend tests and 155 frontend tests. Reference audio playback was manually verified using Canon in D and Minuet in F sample recordings.
