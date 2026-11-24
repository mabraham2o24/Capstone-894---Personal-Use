"""Shared pytest configuration."""

import os

# Access tokens need a signing secret. Tests use their own so they do
# not depend on a local .env file.
os.environ.setdefault(
    "JWT_SECRET",
    "test-only-jwt-secret-not-used-outside-pytest",
)
