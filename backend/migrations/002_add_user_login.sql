-- Support email/password login and link practice sessions to users.
-- Safe to rerun on an existing PostgreSQL database.

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    google_id VARCHAR UNIQUE,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    created_at TIMESTAMP
);

-- Users can now sign in with a password instead of Google.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR;

ALTER TABLE users
    ALTER COLUMN google_id DROP NOT NULL;

-- Each practice session belongs to the user who created it.
-- Sessions created before this migration have no owner.
ALTER TABLE practice_sessions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS ix_practice_sessions_user_id
    ON practice_sessions (user_id);
