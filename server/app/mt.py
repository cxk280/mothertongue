"""Machine-translation stage.

Real path: NLLB-200 distilled-600M (supports zul_Latn <-> eng_Latn and 200+
languages), lean enough to keep STT/MT/TTS as three visibly distinct stages.
Fallback path: looks the utterance up in the scripted exchange, else echoes with
a language marker so the flow still produces readable output.
"""

from __future__ import annotations

import time
from functools import lru_cache

from . import demo_script
from .config import Settings

# NLLB uses BCP-47-ish "<iso3>_<Script>" codes. Map the pipeline's iso3 codes.
# iso3 -> NLLB "<iso3>_<Script>". Most are Latin; Amharic is Ethiopic. Unlisted
# languages fall back to Latin (see _nllb_code), which is right for most.
_NLLB_CODE = {
    "eng": "eng_Latn",
    "zul": "zul_Latn",
    "xho": "xho_Latn",
    "yor": "yor_Latn",
    "hau": "hau_Latn",
    "ibo": "ibo_Latn",
    "swh": "swh_Latn",
    "afr": "afr_Latn",
    "amh": "amh_Ethi",
}


def _nllb_code(lang: str) -> str:
    return _NLLB_CODE.get(lang, f"{lang}_Latn")


class FallbackMT:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def translate(self, text: str, src: str, dst: str) -> str:
        if self._settings.fallback_sleep:
            time.sleep(min(0.20, 0.02 + len(text) * 0.002))
        scripted = demo_script.translate_pair(text, src, dst)
        # The fallback only scripts the flagship isiZulu <-> English pair; other
        # pairs get an honest placeholder (they translate for real on the GPU path).
        return scripted if scripted is not None else "· translated on the in-region GPU ·"


@lru_cache(maxsize=1)
def _shared_mt(model_id: str, device: str):
    import torch  # noqa: F401
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_id)
    if device == "cuda":
        model = model.to("cuda")
    model.eval()
    return tokenizer, model


class RealMT:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._tokenizer, self._model = _shared_mt(settings.mt_model, settings.device)

    def translate(self, text: str, src: str, dst: str) -> str:
        import torch

        self._tokenizer.src_lang = _nllb_code(src)
        inputs = self._tokenizer(text, return_tensors="pt")
        if self._settings.device == "cuda":
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
        bos = self._tokenizer.convert_tokens_to_ids(_nllb_code(dst))
        with torch.no_grad():
            out = self._model.generate(
                **inputs, forced_bos_token_id=bos, max_new_tokens=256
            )
        return self._tokenizer.batch_decode(out, skip_special_tokens=True)[0].strip()


def load_mt(settings: Settings):
    if settings.force_fallback:
        return FallbackMT(settings)
    try:
        return RealMT(settings)
    except Exception:
        if settings.force_real:
            raise
        return FallbackMT(settings)
