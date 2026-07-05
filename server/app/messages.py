"""The WebSocket wire contract — the typed artifact shared with the web client.

Every message below has a 1:1 counterpart in `web/lib/types.ts`. Change them
together. Text control frames are JSON with a `type` discriminator; audio uploaded
from the browser travels as raw binary PCM16 frames (not modelled here).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

# ---- client -> server (JSON control frames; audio is sent as binary) ----

class ClientStart(BaseModel):
    type: Literal["start"] = "start"
    src: str  # source language code, e.g. "zul"
    dst: str  # target language code, e.g. "eng"


class ClientEndUtterance(BaseModel):
    """Push-to-talk released: transcribe+translate+speak the buffered audio."""
    type: Literal["end_utterance"] = "end_utterance"


class ClientStop(BaseModel):
    type: Literal["stop"] = "stop"


# ---- server -> client ----

class ServerReady(BaseModel):
    type: Literal["ready"] = "ready"
    region_label: str
    region_code: str
    engine: str  # "real" | "fallback" — shown so demos are honest about the path
    src: str
    dst: str


class Timings(BaseModel):
    """Per-turn latency breakdown, in milliseconds. This drives the HUD."""
    stt_ms: float
    mt_ms: float
    tts_ms: float
    total_ms: float  # server-side pipeline wall time (stt+mt+tts + overhead)


class ServerTurn(BaseModel):
    type: Literal["turn"] = "turn"
    id: int
    src_lang: str
    dst_lang: str
    src_text: str          # what was heard, in the source language
    dst_text: str          # the translation, in the target language
    timings: Timings
    audio_b64: str         # translated speech as base64 WAV
    audio_mime: str = "audio/wav"


class ServerError(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str


# ---- two-way room protocol (see /room endpoint) ----

class ClientJoin(BaseModel):
    type: Literal["join"] = "join"
    room: str
    lang: str  # the language THIS peer speaks


class ServerJoined(BaseModel):
    type: Literal["joined"] = "joined"
    room: str
    self_lang: str
    region_label: str
    region_code: str
    engine: str


class ServerPeer(BaseModel):
    """The other peer's presence in the room (sent when they join or leave)."""
    type: Literal["peer"] = "peer"
    present: bool
    lang: str | None = None


class ServerSent(BaseModel):
    """Echo of a peer's own outgoing utterance (no audio — they already spoke it)."""
    type: Literal["sent"] = "sent"
    id: int
    src_text: str
    dst_text: str
    timings: Timings
