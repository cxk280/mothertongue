"""The pipeline orchestrator: STT -> MT -> TTS, timing each stage.

This is the heart of the latency story. Every stage is measured with a monotonic
clock and the breakdown is returned to the browser, which renders it in the HUD.
The orchestrator depends only on the stage Protocols, so real and fallback engines
are interchangeable.
"""

from __future__ import annotations

import base64
import threading
import time

from .audio_io import pcm16_bytes_to_float32
from .config import Settings
from .messages import ServerTurn, Timings
from .mt import FallbackMT, load_mt
from .protocols import SpeechToText, TextToSpeech, Translator
from .stt import FallbackSTT, load_stt
from .tts import FallbackTTS, load_tts


class Pipeline:
    def __init__(
        self,
        settings: Settings,
        stt: SpeechToText,
        mt: Translator,
        tts: TextToSpeech,
    ) -> None:
        self._settings = settings
        self._stt = stt
        self._mt = mt
        self._tts = tts
        self._turn_id = 0
        # A room's pipeline is shared by both peers and `run` executes on threadpool
        # workers, so two simultaneous utterances would race the turn counter and call
        # the (non-reentrant) models concurrently. Serialize a run end-to-end.
        self._lock = threading.Lock()
        self.engine = (
            "fallback"
            if isinstance(stt, FallbackSTT)
            or isinstance(mt, FallbackMT)
            or isinstance(tts, FallbackTTS)
            else "real"
        )

    def run(self, pcm: bytes, src: str, dst: str) -> ServerTurn:
        audio = pcm16_bytes_to_float32(pcm)

        with self._lock:
            t0 = time.perf_counter()
            src_text = self._stt.transcribe(audio, src)
            t1 = time.perf_counter()
            dst_text = self._mt.translate(src_text, src, dst)
            t2 = time.perf_counter()
            wav, _sr = self._tts.synthesize(dst_text, dst)
            t3 = time.perf_counter()

            self._turn_id += 1
            turn_id = self._turn_id

        ms = lambda a, b: round((b - a) * 1000, 1)  # noqa: E731
        timings = Timings(
            stt_ms=ms(t0, t1),
            mt_ms=ms(t1, t2),
            tts_ms=ms(t2, t3),
            total_ms=ms(t0, t3),
        )

        return ServerTurn(
            id=turn_id,
            src_lang=src,
            dst_lang=dst,
            src_text=src_text,
            dst_text=dst_text,
            timings=timings,
            audio_b64=base64.b64encode(wav).decode("ascii"),
        )


def build_pipeline(settings: Settings) -> Pipeline:
    """Build a per-connection pipeline. Heavy models (if any) are shared via the
    module-level caches inside each stage; the wrapper objects here are cheap."""
    return Pipeline(
        settings,
        stt=load_stt(settings),
        mt=load_mt(settings),
        tts=load_tts(settings),
    )
