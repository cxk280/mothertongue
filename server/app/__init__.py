"""MotherTongue inference server.

A FastAPI WebSocket service that runs a three-stage speech-to-speech translation
pipeline (STT -> MT -> TTS) entirely in one region. Each stage is timed so the
browser's latency HUD can show where the milliseconds go.

The real models (MMS-ASR, NLLB-200, MMS-TTS) load only when their heavy deps are
present and `MT_MODE` allows it; otherwise a deterministic CPU fallback runs the
same pipeline shape so the app is fully runnable and testable without a GPU.
"""

__version__ = "0.1.0"
