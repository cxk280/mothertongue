"""Stage interfaces. The pipeline depends only on these Protocols; concrete real
or fallback implementations are chosen at load time (dependency inversion).
"""

from __future__ import annotations

from typing import Protocol

import numpy as np


class SpeechToText(Protocol):
    def transcribe(self, audio: np.ndarray, lang: str) -> str:
        """audio: float32 mono in [-1, 1] at Settings.sample_rate."""
        ...


class Translator(Protocol):
    def translate(self, text: str, src: str, dst: str) -> str:
        ...


class TextToSpeech(Protocol):
    def synthesize(self, text: str, lang: str) -> tuple[bytes, int]:
        """Return (wav_bytes, sample_rate)."""
        ...
