"""Force the fast, deterministic fallback engine for all tests (no models, no sleep).
Must run before app modules read the environment."""

import os

os.environ.setdefault("MT_MODE", "fallback")
os.environ.setdefault("MT_FALLBACK_SLEEP", "0")
# Small buffer cap so the too-long test is fast (well above the 32000-byte test clips).
os.environ.setdefault("MT_MAX_UTTERANCE_BYTES", "64000")
