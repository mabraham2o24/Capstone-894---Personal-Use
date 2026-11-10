-- Add persistent analysis and AI feedback fields.
-- Safe to rerun on an existing PostgreSQL database.

ALTER TABLE practice_sessions
    ADD COLUMN IF NOT EXISTS performance_analysis JSON,
    ADD COLUMN IF NOT EXISTS performance_summary JSON,
    ADD COLUMN IF NOT EXISTS ai_feedback JSON;
