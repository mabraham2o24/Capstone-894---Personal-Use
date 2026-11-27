-- Store each practice session's uploaded score as plain MusicXML,
-- for the Annotated Sheet Music view.
-- Safe to rerun on an existing PostgreSQL database.

ALTER TABLE practice_sessions
    ADD COLUMN IF NOT EXISTS score_musicxml BYTEA;
