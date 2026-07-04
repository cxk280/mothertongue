"""Tiny audio helpers — WAV encode/decode with just the standard library + numpy.

We avoid soundfile/libsndfile so the base (fallback) install stays wheel-only and
portable across CI runners.
"""

from __future__ import annotations

import io
import wave

import numpy as np


def pcm16_bytes_to_float32(raw: bytes) -> np.ndarray:
    """Browser mic frames are mono PCM16 little-endian; STT wants float32 [-1, 1]."""
    if not raw:
        return np.zeros(0, dtype=np.float32)
    pcm = np.frombuffer(raw, dtype="<i2").astype(np.float32)
    return pcm / 32768.0


def float32_to_wav_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    """Encode a mono float32 waveform in [-1, 1] as a 16-bit PCM WAV."""
    clipped = np.clip(samples, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm16.tobytes())
    return buf.getvalue()
