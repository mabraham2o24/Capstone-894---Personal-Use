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
