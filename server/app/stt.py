"""Speech-to-text stage.

Real path: Meta MMS-ASR (facebook/mms-1b-all), which — unlike Whisper — covers
isiZulu and ~1000 other low-resource languages by swapping a per-language adapter.
Fallback path: returns lines from the scripted demo exchange, sized by a counter.

Heavy models are cached module-wide (loaded once); the per-connection wrapper
objects returned by `load_stt` are cheap and, for the fallback, hold their own
utterance counter.
"""

from __future__ import annotations

import time
from functools import lru_cache

import numpy as np

from . import demo_script
from .config import Settings

# MMS/NLLB use ISO-639-3 codes ("zul", "eng"); keep everything in that space.


class FallbackSTT:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._n = 0

    def transcribe(self, audio: np.ndarray, lang: str) -> str:
        if self._settings.fallback_sleep:
            # ~ real ASR feel: a little longer for longer audio.
            time.sleep(min(0.25, 0.03 + len(audio) / self._settings.sample_rate * 0.05))
        text = demo_script.line_for(self._n, lang)
        self._n += 1
        return text


@lru_cache(maxsize=1)
def _shared_asr(model_id: str, device: str):
    # Imported lazily so the fallback path never needs torch/transformers.
    import torch  # noqa: F401
    from transformers import AutoProcessor, Wav2Vec2ForCTC

    processor = AutoProcessor.from_pretrained(model_id)
    model = Wav2Vec2ForCTC.from_pretrained(model_id)
    if device == "cuda":
        model = model.to("cuda")
    model.eval()
    return processor, model


class RealSTT:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._processor, self._model = _shared_asr(settings.stt_model, settings.device)
        self._loaded_lang: str | None = None

    def transcribe(self, audio: np.ndarray, lang: str) -> str:
        import torch

        if lang != self._loaded_lang:
            # MMS swaps a small adapter + vocabulary per language.
            self._processor.tokenizer.set_target_lang(lang)
            self._model.load_adapter(lang)
            self._loaded_lang = lang

        inputs = self._processor(
            audio, sampling_rate=self._settings.sample_rate, return_tensors="pt"
        )
        if self._settings.device == "cuda":
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
        with torch.no_grad():
            logits = self._model(**inputs).logits
        ids = torch.argmax(logits, dim=-1)
        return self._processor.batch_decode(ids)[0].strip()


def load_stt(settings: Settings):
    if settings.force_fallback:
        return FallbackSTT(settings)
    try:
        return RealSTT(settings)
    except Exception:
        if settings.force_real:
            raise
        return FallbackSTT(settings)
