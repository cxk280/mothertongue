import base64

import numpy as np

from app.config import Settings
from app.demo_script import LINES
from app.pipeline import build_pipeline


def _silence_pcm(seconds: float = 1.0, rate: int = 16000) -> bytes:
    return np.zeros(int(seconds * rate), dtype="<i2").tobytes()


def _fallback_settings() -> Settings:
    return Settings(mode="fallback", fallback_sleep=False)


def test_pipeline_produces_a_translated_turn():
    pipe = build_pipeline(_fallback_settings())
    assert pipe.engine == "fallback"

    turn = pipe.run(_silence_pcm(), src="zul", dst="eng")

    assert turn.id == 1
    assert turn.src_text  # heard text, source language
    assert turn.dst_text  # translation, target language
    assert turn.src_lang == "zul" and turn.dst_lang == "eng"


def test_scripted_fallback_is_coherent():
    pipe = build_pipeline(_fallback_settings())
    turn = pipe.run(_silence_pcm(), src="zul", dst="eng")
    # First fallback utterance follows the scripted exchange.
    assert turn.src_text == LINES[0]["zul"]
    assert turn.dst_text == LINES[0]["eng"]


def test_timings_are_present_and_consistent():
    pipe = build_pipeline(_fallback_settings())
    turn = pipe.run(_silence_pcm(), src="zul", dst="eng")
    t = turn.timings
    assert t.stt_ms >= 0 and t.mt_ms >= 0 and t.tts_ms >= 0
    # total is wall time over all three stages, so at least their sum.
    assert t.total_ms >= t.stt_ms + t.mt_ms + t.tts_ms - 0.5


def test_audio_is_a_playable_wav():
    pipe = build_pipeline(_fallback_settings())
    turn = pipe.run(_silence_pcm(), src="zul", dst="eng")
    wav = base64.b64decode(turn.audio_b64)
    assert wav[:4] == b"RIFF" and wav[8:12] == b"WAVE"


def test_turn_ids_increment():
    pipe = build_pipeline(_fallback_settings())
    ids = [pipe.run(_silence_pcm(0.4), "zul", "eng").id for _ in range(3)]
    assert ids == [1, 2, 3]
