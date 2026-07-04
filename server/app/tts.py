"""Text-to-speech stage.

Real path: Meta MMS-TTS (facebook/mms-tts-<lang>), one small VITS model per
language — crucially it ships an isiZulu voice (`mms-tts-zul`), which XTTS does not.
Fallback path: a short, soft amplitude-modulated tone sized to the text, so the
"playing" state has real audio to play without any model.
"""

from __future__ import annotations

import time
from functools import lru_cache

import numpy as np

from .audio_io import float32_to_wav_bytes
from .config import Settings

_FALLBACK_SR = 16000


class FallbackTTS:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def synthesize(self, text: str, lang: str) -> tuple[bytes, int]:
        # Duration scales with text length, clamped to a sensible demo range.
        seconds = max(0.6, min(3.5, 0.06 * max(1, len(text))))
        if self._settings.fallback_sleep:
            time.sleep(min(0.25, seconds * 0.08))
        n = int(seconds * _FALLBACK_SR)
        t = np.linspace(0, seconds, n, endpoint=False, dtype=np.float32)
        # A quiet 220Hz tone gently modulated at 4Hz — pleasant, obviously synthetic.
        tone = np.sin(2 * np.pi * 220 * t) * (0.18 + 0.06 * np.sin(2 * np.pi * 4 * t))
        # Soft fade in/out to avoid clicks.
        fade = min(400, n // 8)
        if fade > 0:
            env = np.ones(n, dtype=np.float32)
            env[:fade] = np.linspace(0, 1, fade)
            env[-fade:] = np.linspace(1, 0, fade)
            tone *= env
        return float32_to_wav_bytes(tone, _FALLBACK_SR), _FALLBACK_SR


@lru_cache(maxsize=4)
def _shared_tts(model_id: str, device: str):
    import torch  # noqa: F401
    from transformers import AutoTokenizer, VitsModel

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = VitsModel.from_pretrained(model_id)
    if device == "cuda":
        model = model.to("cuda")
    model.eval()
    return tokenizer, model


class RealTTS:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def synthesize(self, text: str, lang: str) -> tuple[bytes, int]:
        import torch

        model_id = self._settings.tts_model_tmpl.format(lang=lang)
        tokenizer, model = _shared_tts(model_id, self._settings.device)
        inputs = tokenizer(text, return_tensors="pt")
        if self._settings.device == "cuda":
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
        with torch.no_grad():
            waveform = model(**inputs).waveform  # (1, samples)
        samples = waveform.squeeze(0).detach().cpu().numpy().astype(np.float32)
        return float32_to_wav_bytes(samples, model.config.sampling_rate), model.config.sampling_rate


def load_tts(settings: Settings):
    if settings.force_fallback:
        return FallbackTTS(settings)
    try:
        # Import-check only; real models load lazily per language on first use.
        import transformers  # noqa: F401

        return RealTTS(settings)
    except Exception:
        if settings.force_real:
            raise
        return FallbackTTS(settings)
