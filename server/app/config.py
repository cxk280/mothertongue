"""Runtime settings, read once from the environment.

Kept dependency-light on purpose: the fallback path must import with nothing but
the standard library + numpy + pydantic, so we don't pull in pydantic-settings.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str) -> str:
    return os.environ.get(name, default)


@dataclass(frozen=True)
class Settings:
    # "auto" loads real models when their deps import and DEVICE!=cpu-only builds
    # allow it; "real" forces real (errors if deps missing); "fallback" forces stub.
    mode: str = _env("MT_MODE", "auto")
    device: str = _env("MT_DEVICE", "cpu")  # "cpu" | "cuda"

    # Human-facing serving region label shown in the HUD (e.g. "São Paulo").
    region_label: str = _env("MT_REGION_LABEL", "São Paulo")
    region_code: str = _env("MT_REGION_CODE", "sao")

    # Model ids (only used on the real path).
    stt_model: str = _env("MT_STT_MODEL", "facebook/mms-1b-all")
    mt_model: str = _env("MT_MT_MODEL", "facebook/nllb-200-distilled-600M")
    tts_model_tmpl: str = _env("MT_TTS_MODEL_TMPL", "facebook/mms-tts-{lang}")

    # Audio contract: browser sends mono PCM16 little-endian at this rate.
    sample_rate: int = int(_env("MT_SAMPLE_RATE", "16000"))

    # When true, the fallback sleeps a little so live demos feel real. Tests set 0.
    fallback_sleep: bool = _env("MT_FALLBACK_SLEEP", "1") not in ("0", "false", "")

    # Cap a single buffered utterance so a client that never releases the mic can't
    # grow the buffer without bound. Default ~90s of PCM16 @ 16kHz mono.
    max_utterance_bytes: int = int(_env("MT_MAX_UTTERANCE_BYTES", str(16000 * 2 * 90)))

    # Cap typed text (translate_text) so an unauthenticated client can't push an
    # unbounded string into MT/TTS. A generous paragraph; far more than any utterance.
    max_text_chars: int = int(_env("MT_MAX_TEXT_CHARS", "2000"))

    # Opt-in WebRTC transport (Opus uplink over an aiortc peer connection). Off by
    # default so the base server needs nothing beyond the wheel-only deps; when on,
    # aiortc must be installed. The WebSocket transport is always available.
    webrtc_enabled: bool = _env("MT_WEBRTC", "0") not in ("0", "false", "")

    @property
    def force_fallback(self) -> bool:
        return self.mode == "fallback"

    @property
    def force_real(self) -> bool:
        return self.mode == "real"


def load_settings() -> Settings:
    return Settings()
