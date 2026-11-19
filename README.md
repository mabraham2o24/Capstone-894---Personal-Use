
# Virtual Music Instructor (VMI)

**SWENG 894 Capstone — Local Setup and Run Guide (Windows and macOS)**

**Documentation status:** November 2026. This guide describes the current local-development workflow. It should be updated as integrations are merged.

## 1. Project Overview

Virtual Music Instructor is a React/Vite frontend and Python/FastAPI backend application that helps musicians practice against a reference MusicXML score.

A user can create a practice session, upload a MusicXML score, choose a measure range, upload a WAV recording, and view backend-generated performance analysis and note-level feedback. PostgreSQL stores practice-session data.

### Current Annotated Sheet Music Limitation

The Performance Results page includes an annotated sheet music display using a bundled/hardcoded sample MusicXML file.

**It is not yet connected to the MusicXML file uploaded for the current session.**

The notation shown may therefore differ from the analyzed score and its feedback. This does not by itself indicate that the uploaded score or audio analysis failed.

Integration is planned for a later update.

### AI Practice Feedback

Backend AI-feedback work may be present in some commits, but the frontend button and results display are not yet integrated in the version this guide describes.

Do not expect an end-to-end AI feedback screen until the corresponding frontend changes are merged.

## 2. Repository and Project Layout

Repository:

https://github.com/mabraham2o24/Capstone-894---Personal-Use

The repository root contains the React/Vite application (`src/`, `public/`, `package.json`, `package-lock.json`, `vite.config.js`) and a separate `backend/` directory for FastAPI and Python music analysis.

Commands below assume you are in the repository root unless a step explicitly says `cd backend`.

## 3. Prerequisites

Install the following software before running the project.

| Tool | Purpose | Verify Installation |
| --- | --- | --- |
| Git | Clone the repository | `git --version` |
| Node.js and npm | Run the React frontend | `node --version` and `npm --version` |
| Python 3 | Run the FastAPI backend | Windows: `py --version`; macOS: `python3 --version` |
| PostgreSQL | Store practice-session data | `psql --version` |
| Code editor (optional) | View and edit project files | VS Code recommended |

Install compatible stable versions. Check the project's configuration files for any specific version requirements.

### Windows Installation

1. Install Git: https://git-scm.com/downloads/win
2. Install Node.js: https://nodejs.org/
3. Install Python: https://www.python.org/downloads/windows/
4. Install PostgreSQL: https://www.postgresql.org/download/windows/

During Python installation, enable **Add Python to PATH** if offered.

During PostgreSQL installation, record the administrator password and selected port (normally `5432`).

Restart PowerShell or VS Code after installing the software.

### macOS Installation

1. Install Git using:

   ```bash
   xcode-select --install
   ```

2. Install Node.js: https://nodejs.org/
3. Install Python 3: https://www.python.org/downloads/macos/
4. Install PostgreSQL: https://www.postgresql.org/download/macosx/

PostgreSQL may also be installed through Homebrew.

If using Homebrew, check the installed PostgreSQL service with:

```bash
brew services list
```

Start the appropriate PostgreSQL service before running the backend.

## 4. Clone the Repository

Open PowerShell on Windows or Terminal on macOS.

Run:

```bash
git clone https://github.com/mabraham2o24/Capstone-894---Personal-Use.git
```

Navigate into the cloned directory:

```bash
cd Capstone-894---Personal-Use
```

The repository should contain `package.json` and a `backend` folder.

If GitHub requests authentication, complete the sign-in process.

To retrieve newer changes later, navigate to the repository and run:

```bash
git pull
```

Do not run `git pull` during a demonstration unless you intend to update to the latest commit.

## 5. PostgreSQL Database Setup

The application uses PostgreSQL to store practice-session information.

A fresh clone does not include the development team's local database or private environment configuration.

The database must be configured before starting the backend.

### Step 1: Start PostgreSQL

**Windows:**

Open the Windows Services application and ensure the PostgreSQL service is running.

Alternatively, start PostgreSQL using the installation's database management tools.

**macOS:**

Start PostgreSQL using the installation instructions or the appropriate Homebrew service.

### Step 2: Create a Database

Open pgAdmin's Query Tool or connect to PostgreSQL through the terminal.

For installations with a `postgres` administrator role:

```bash
psql -U postgres -h localhost -p 5432
```

Some macOS installations use the macOS username as the initial PostgreSQL administrator instead.

The following SQL demonstrates how to create a local database user and database:

```sql
CREATE USER vmi_user WITH PASSWORD 'replace_with_a_local_password';

CREATE DATABASE vmi_db OWNER vmi_user;
```

**Important:** These are example credentials and database names, not confirmed project defaults.

Use the names and credentials required by the project's actual database configuration.

If the database already exists, it does not need to be recreated.

Exit PostgreSQL with:

```sql
\q
```

### Step 3: Configure the Backend Database Connection

Open:

```text
backend/database.py
```

Check which environment variables the application expects and where it loads its configuration.

If the backend uses a `DATABASE_URL` environment variable loaded from `backend/.env`, create that file with a connection string similar to:

```dotenv
DATABASE_URL=postgresql://vmi_user:replace_with_a_local_password@localhost:5432/vmi_db
```

Replace the example password with the actual local database password.

**This configuration is an example only.** If `database.py` uses different environment-variable names or a different `.env` location, follow the code's exact requirements.

Python does not automatically load `.env` files unless the application or startup process is configured to do so.

Never commit actual passwords or `.env` files to GitHub.

### Step 4: Database Tables

Earlier versions of the backend used SQLAlchemy to create the required database tables automatically during application startup.

If the current backend still uses:

```python
Base.metadata.create_all(bind=engine)
```

the tables should be created when the backend successfully connects to PostgreSQL.

If database migrations have been introduced, follow the project's migration instructions instead.

## 6. Backend Setup (Python and FastAPI)

Open a terminal in the cloned repository.

Navigate to the backend directory:

```bash
cd backend
```

### Step 1: Create a Python Virtual Environment

**Windows PowerShell:**

```powershell
py -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell prevents activation, run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then try activating the environment again:

```powershell
.\.venv\Scripts\Activate.ps1
```

Alternatively, Windows Command Prompt can use:

```bat
py -m venv .venv
.venv\Scripts\activate.bat
```

**macOS Terminal:**

Create the environment:

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

After activation, the terminal should indicate that the virtual environment is active.

The virtual environment must be created locally on the computer running the project.

### Step 2: Install Python Dependencies

With the virtual environment activated, upgrade pip:

```bash
python -m pip install --upgrade pip
```

If `backend/requirements.txt` exists, install the dependencies:

```bash
python -m pip install -r requirements.txt
```

If the file is missing, obtain the project's actual Python dependency list from the development team before proceeding.

The backend includes music and audio processing libraries that may require compatible Python versions or additional system dependencies.

If the project uses `pyproject.toml` or another dependency manager, follow that configuration instead.

### Step 3: Start the FastAPI Backend

Ensure PostgreSQL is running.

From the `backend` directory, with the Python virtual environment activated, run:

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend should start on:

http://localhost:8000/

Open the backend API documentation at:

http://localhost:8000/docs

The root endpoint should return a JSON response indicating that the backend is running.

**Keep this terminal open while using the application.**

If the backend reports a database connection error, verify the PostgreSQL service, database credentials, and environment configuration.

## 7. Frontend Setup (React and Vite)

Open a **second terminal**.

Navigate to the root of the cloned repository.

The frontend commands must be executed from the directory containing `package.json`, not from the `backend` directory.

### Step 1: Install Frontend Dependencies

Run:

```bash
npm ci
```

This installs the dependencies using the committed `package-lock.json`.

If the lockfile is missing or inconsistent, contact the development team before using `npm install`.

### Step 2: Start the Frontend

Run:

```bash
npm run dev
```

Vite should display a local development URL, typically:

http://localhost:5173/

Open the URL displayed in the terminal.

**Keep this terminal open while using the application.**

If Vite selects another port, such as `5174`, the backend CORS configuration may need to be updated.

The documented configuration assumes the frontend runs on port `5173` and the backend runs on port `8000`.

## 8. Running the Complete Application

After completing the initial setup, use the following startup order.

### Step 1: Start PostgreSQL

Verify that the PostgreSQL database server is running.

### Step 2: Start the Backend

Open a terminal in the `backend` directory.

Activate the Python virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**macOS:**

```bash
source .venv/bin/activate
```

Start FastAPI:

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Step 3: Start the Frontend

Open another terminal in the repository root.

Run:

```bash
npm run dev
```

### Step 4: Open the Application

Visit:

http://localhost:5173/

The application should now be accessible in the browser.

Both the backend and frontend terminals must remain running.

The repository does not need to be cloned again for subsequent sessions, and dependencies generally do not need to be reinstalled unless they change.

## 9. Testing the Application

The following walkthrough demonstrates the currently integrated application features.

Before starting, obtain a working MusicXML score and corresponding WAV recording from the development team.

The application is primarily designed for monophonic musical performances.

### Step 1: Open the Application

Navigate to:

http://localhost:5173/

The current login page is a prototype. Full authentication has not yet been implemented.

Continue through the application's available navigation.

### Step 2: Create a Practice Session

Navigate to the practice-session workflow.

Create a new practice session.

The backend generates a unique session identifier used to associate the uploaded score and audio recording.

### Step 3: Upload a MusicXML File

Choose a supported MusicXML score file.

The application supports MusicXML uploads and sends the file to the backend for processing.

The backend extracts musical information such as:

- Notes and pitches
- Note durations
- Measures
- Tempo
- Other score information used for performance analysis

### Step 4: Review the Processed Score

After processing, review the score information displayed by the application.

Select a start and end measure if the interface requests a measure range.

### Step 5: Upload a WAV Recording

Upload a WAV recording corresponding to the MusicXML score.

The recording should match the musical piece and selected measure range.

Wait for the backend to finish processing the recording.

Processing time may vary depending on the recording length and computer performance.

### Step 6: Review Performance Results

After processing, the Performance Results page displays available analysis information, including:

- Performance accuracy metrics
- Pitch and rhythm analysis
- Detected pitches
- Note-level performance feedback
- Incorrect pitches
- Missing or additional notes
- Early or late notes
- Note-duration differences
- Performance errors and problem areas

The displayed results depend on the uploaded recording and backend analysis.

### Step 7: View Annotated Sheet Music

The Performance Results page also contains an annotated sheet music display.

**Current implementation limitation:**

The annotated sheet music currently uses a hardcoded MusicXML sample file.

It does not yet load the MusicXML file uploaded during the current practice session.

Therefore, the displayed notation may not match the uploaded score or the backend-generated performance feedback.

This is an expected limitation of the current version.

The annotated sheet music will be connected to the uploaded MusicXML file in a later integration update.

### Optional: Inspect Backend API Endpoints

The FastAPI interactive documentation is available at:

http://localhost:8000/docs

The backend includes practice-session endpoints such as:

```text
POST /sessions

POST /sessions/{session_id}/upload-score

POST /sessions/{session_id}/upload-audio

GET /sessions/{session_id}
```

The session ID generated when creating a session is used for subsequent uploads.

The API documentation reflects the exact endpoints available in the checked-out backend version.

## 10. Running Automated Tests (Optional)

### Frontend Tests

Navigate to the repository root.

Check the `scripts` section in `package.json` for the available test command.

If a `test` script is defined, run:

```bash
npm test
```

If a `test:run` script is defined instead, run:

```bash
npm run test:run
```

Use the command supported by the current `package.json`.

### Backend Tests

Navigate to the backend directory and activate the Python virtual environment.

If pytest is configured and its dependencies are installed, run:

```bash
python -m pytest
```

Some backend tests may require a separate test database or additional configuration.

Do not run destructive tests against a shared or production database.

## 11. Troubleshooting

### Problem: Git, Python, Node.js, or npm Is Not Recognized

**Possible cause:** The software is not installed or has not been added to the system PATH.

**Solution:**

Verify the installation and restart the terminal.

### Problem: Python Virtual Environment Will Not Activate on Windows

**Possible cause:** PowerShell execution policy restrictions.

**Solution:**

Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Then activate the environment again.

Alternatively, use Windows Command Prompt.

### Problem: Python Reports "No Module Named uvicorn"

**Possible cause:** The virtual environment is inactive or Python dependencies are missing.

**Solution:**

Activate the virtual environment and install the backend dependencies.

### Problem: PostgreSQL Connection Refused

**Possible cause:** PostgreSQL is not running or the connection settings are incorrect.

**Solution:**

Start PostgreSQL and verify the configured hostname and port.

### Problem: PostgreSQL Authentication Failed

**Possible cause:** The database username or password is incorrect.

**Solution:**

Verify the database credentials and backend environment configuration.

### Problem: Database Does Not Exist

**Possible cause:** The required PostgreSQL database has not been created.

**Solution:**

Create the database using the instructions in Section 5.

### Problem: Port 8000 Is Already in Use

**Possible cause:** Another backend process is running.

**Solution:**

Stop the existing process before starting FastAPI again.

### Problem: Vite Starts on Port 5174

**Possible cause:** Port 5173 is already occupied.

**Solution:**

Stop the process using port 5173 or update the backend CORS configuration if another frontend port is required.

### Problem: Frontend Displays "Failed to Fetch"

**Possible cause:** The backend is not running, the frontend is using an incorrect API URL, or the backend does not allow the frontend origin.

**Solution:**

Verify that:

- FastAPI is running on port 8000.
- React/Vite is running on port 5173.
- The frontend API requests point to the correct backend.
- The backend CORS settings allow the frontend origin.

### Problem: MusicXML Upload Fails

**Possible cause:** The uploaded score is malformed or unsupported.

**Solution:**

Try a known working MusicXML file provided by the development team.

### Problem: WAV Upload or Performance Analysis Fails

**Possible cause:** The audio format, selected measure range, or processing dependencies are incompatible.

**Solution:**

Use a known working WAV recording paired with the correct MusicXML score.

Check the backend terminal for detailed errors.

### Problem: Annotated Sheet Music Does Not Match the Uploaded Score

**Cause:** The current annotated sheet music implementation uses a hardcoded sample MusicXML file.

**Solution:**

This is an expected limitation of the current version.

The feature will be updated when the uploaded MusicXML integration is completed.

### Problem: AI Feedback Button Is Missing

**Cause:** The frontend AI feedback integration has not yet been merged.

**Solution:**

This is expected for the version described in this README.

## 12. Stopping the Application

To stop the frontend, press:

```text
Ctrl+C
```

in the frontend terminal.

To stop the backend, press:

```text
Ctrl+C
```

in the backend terminal.

PostgreSQL may remain running locally or be stopped separately.

To exit the Python virtual environment, run:

```bash
deactivate
```

## 13. Development Team Verification Checklist

Before using this README as the final setup guide, the development team should verify:

- [ ] `backend/requirements.txt` includes all required Python dependencies, or the actual dependency installation method is documented.
- [ ] `backend/database.py` environment-variable names and expected configuration are documented.
- [ ] A sanitized `.env.example` is available if environment variables are required.
- [ ] Any additional Windows or macOS audio-processing dependencies are documented.
- [ ] Supported Python and Node.js versions are confirmed.
- [ ] Frontend and backend localhost ports match the documented configuration.
- [ ] A working MusicXML and WAV test pair is available to the instructor.
- [ ] Database table creation or migration requirements are documented.
- [ ] Any Ollama/model setup needed for future AI feedback demonstrations is documented.
- [ ] The feature descriptions match the latest GitHub commit.

**Maintainers:** Update this README whenever database configuration, annotated MusicXML integration, AI feedback integration, or installation requirements change.
