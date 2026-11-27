# Database Migrations

This folder contains SQL scripts for updating the VMI PostgreSQL database.

## AI Feedback Migration

File: 001_add_ai_feedback_columns.sql

This migration adds three fields:
- performance_analysis
- performance_summary
- ai_feedback

These fields store performance results and AI-generated feedback.

## How to Apply

From the project root, run:

psql -U postgres -d vmi_dev -f backend/migrations/001_add_ai_feedback_columns.sql

Use your own PostgreSQL username and database name if different.

Only run this migration if your database does not already have the required columns.

## User Login Migration

File: 002_add_user_login.sql

This migration:
- adds a password_hash field to users, for email/password login
- allows users without a Google ID, for accounts that only use a password
- adds a user_id field to practice_sessions, linking each session to the user who created it

Apply it before running a version of the backend that includes login.
Without it, practice-session requests fail because the user_id column
is missing.

From the project root, run:

psql -U postgres -d vmi_dev -f backend/migrations/002_add_user_login.sql

Practice sessions created before this migration have no owner, so they
are not visible to any logged-in user.

## Score File Migration

File: 003_add_score_musicxml.sql

This migration adds a score_musicxml field to practice_sessions. It
stores the uploaded score as plain MusicXML so the frontend can render
it in the Annotated Sheet Music view (GET /sessions/{session_id}/score).

Apply it before running a version of the backend that stores score
files. Without it, practice-session requests fail because the
score_musicxml column is missing.

From the project root, run:

psql -U postgres -d vmi_dev -f backend/migrations/003_add_score_musicxml.sql

Sessions whose score was uploaded before this migration have no stored
file, so their sheet music cannot be displayed.
