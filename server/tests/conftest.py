"""Force the fast, deterministic fallback engine for all tests (no models, no sleep).
Must run before app modules read the environment."""

import os

os.environ.setdefault("MT_MODE", "fallback")
os.environ.setdefault("MT_FALLBACK_SLEEP", "0")
