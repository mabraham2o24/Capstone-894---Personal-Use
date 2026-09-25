# Capstone-894---Personal-Use
This is just for our group to push code that we do not want to put into our public github

## Running the Project

### 1. Pull the Latest Code

From the main project folder:

```powershell
git pull
```

> If you have uncommitted changes, commit or stash them before pulling.

### 2. Install Frontend Dependencies

```powershell
npm install
```

### 3. Start the Backend

Open a terminal and run:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

Leave this terminal running.

### 4. Start the Frontend

Open a second terminal in the main project folder and run:

```powershell
npm run dev
```

Open the URL shown in the terminal, normally:

```text
http://localhost:5173
```

### Note

Make sure your local `.env` file contains the shared database configuration. The `.env` file is not included in GitHub.
