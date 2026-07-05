"""Client<->server WebRTC transport (opt-in).

The browser streams its microphone as an **Opus audio track** and sends the same
control frames as the WebSocket path over an **RTCDataChannel**. The server decodes
the Opus to PCM16, feeds the *same* pipeline as ``/ws`` (STT -> MT -> TTS), and returns
each ``ServerTurn`` back over the data channel.

Only the *uplink* differs from ``/ws``: the wire contract (``start`` / ``end_utterance``
-> ``ready`` / ``turn``, with translated speech as base64 WAV) is byte-for-byte the same,
so the browser renders turns and drives the latency HUD exactly as it does over WebSocket.
The win is bandwidth: Opus uplink is ~24 kbps vs ~256 kbps for raw PCM16 — the weak-network
story the demo is about.

``aiortc`` pulls native deps (PyAV, pylibsrtp); it is imported here, and this module is
imported *lazily* by ``main.py`` only when the WebRTC transport is enabled, so the base
server still boots and the WebSocket transport works without it.
"""

from __future__ import annotations

import asyncio
import json
import logging

from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamError
from av.audio.resampler import AudioResampler
from fastapi.concurrency import run_in_threadpool

from .config import Settings
from .messages import ServerError, ServerReady
from .pipeline import Pipeline, build_pipeline

logger = logging.getLogger("mothertongue")

# Keep live peer connections referenced so they aren't garbage-collected mid-call.
_sessions: set[WebrtcSession] = set()


class WebrtcSession:
    """One browser peer: an aiortc connection, its control channel, and the PCM buffer
    the incoming audio track fills. Mirrors the per-connection state of the /ws handler."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pc = RTCPeerConnection()
        self._channel = None  # set when the browser's "control" data channel opens
        self._pipeline: Pipeline | None = None
        self._src = ""
        self._dst = ""
        self._buffer = bytearray()
        # The browser streams audio continuously, so (unlike /ws) the utterance is
        # delimited explicitly: we only accumulate between start_utterance and
        # end_utterance. Everything else on the wire is identical to /ws.
        self._recording = False

        @self._pc.on("datachannel")
        def _on_datachannel(channel) -> None:  # noqa: ANN001 - aiortc callback
            if channel.label == "control":
                self._channel = channel

                @channel.on("message")
                def _on_message(message) -> None:  # noqa: ANN001
                    asyncio.ensure_future(self._on_control(message))

        @self._pc.on("track")
        def _on_track(track) -> None:  # noqa: ANN001
            if track.kind == "audio":
                asyncio.ensure_future(self._consume_audio(track))

        @self._pc.on("connectionstatechange")
        async def _on_state() -> None:
            if self._pc.connectionState in ("failed", "closed", "disconnected"):
                await self.close()

    async def answer(self, offer_sdp: str, offer_type: str) -> dict:
        """Apply the browser's offer and return our SDP answer (non-trickle: aiortc has
        finished ICE gathering by the time setLocalDescription resolves)."""
        await self._pc.setRemoteDescription(RTCSessionDescription(sdp=offer_sdp, type=offer_type))
        await self._pc.setLocalDescription(await self._pc.createAnswer())
        return {"sdp": self._pc.localDescription.sdp, "type": self._pc.localDescription.type}

    # ---- audio uplink ----

    async def _consume_audio(self, track) -> None:  # noqa: ANN001
        """Decode the incoming Opus track to PCM16 @ the pipeline's sample rate, mono."""
        resampler = AudioResampler(format="s16", layout="mono", rate=self._settings.sample_rate)
        try:
            while True:
                frame = await track.recv()
                for chunk in resampler.resample(frame):
                    self._append(chunk.to_ndarray().tobytes())
        except MediaStreamError:
            pass  # track ended (peer left / stopped) — normal teardown

    def _append(self, pcm: bytes) -> None:
        if not self._recording:
            return  # only capture between start_utterance and end_utterance
        self._buffer.extend(pcm)
        if len(self._buffer) > self._settings.max_utterance_bytes:
            # Disarm as well as clear: the browser streams continuously, so leaving
            # capture on would re-fire this every buffer-worth of audio.
            self._buffer.clear()
            self._recording = False
            self._send(ServerError(
                code="too_long", message="Utterance too long — please release the mic"
            ))

    # ---- control channel (same contract as /ws) ----

    async def _on_control(self, message) -> None:  # noqa: ANN001
        if not isinstance(message, str):
            return
        try:
            msg = json.loads(message)
        except json.JSONDecodeError:
            self._send(ServerError(code="bad_json", message="Invalid message"))
            return
        kind = msg.get("type")

        if kind == "start":
            self._src = msg.get("src") or "zul"
            self._dst = msg.get("dst") or "eng"
            self._buffer.clear()
            self._pipeline = await run_in_threadpool(build_pipeline, self._settings)
            self._send(ServerReady(
                region_label=self._settings.region_label,
                region_code=self._settings.region_code,
                engine=self._pipeline.engine,
                src=self._src,
                dst=self._dst,
            ))

        elif kind == "start_utterance":
            # Arm capture for a fresh utterance (push-to-talk pressed).
            self._buffer.clear()
            self._recording = True

        elif kind == "end_utterance":
            self._recording = False
            if self._pipeline is None:
                self._send(ServerError(code="not_started", message="Send start first"))
                return
            pcm = bytes(self._buffer)
            self._buffer.clear()
            if not pcm:
                return
            turn = await run_in_threadpool(self._pipeline.run, pcm, self._src, self._dst)
            self._send(turn)

        elif kind == "stop":
            await self.close()

    def _send(self, model) -> None:  # noqa: ANN001
        """Send a pydantic wire model over the control channel, if it is open."""
        channel = self._channel
        if channel is not None and channel.readyState == "open":
            channel.send(model.model_dump_json())

    async def close(self) -> None:
        _sessions.discard(self)
        if self._pc.connectionState != "closed":
            await self._pc.close()


async def create_session(offer_sdp: str, offer_type: str, settings: Settings) -> dict:
    """Build a session for a browser offer and return the SDP answer to signal back."""
    session = WebrtcSession(settings)
    _sessions.add(session)
    try:
        return await session.answer(offer_sdp, offer_type)
    except Exception:
        await session.close()
        raise


async def close_all_sessions() -> None:
    """Tear down every live peer connection (app shutdown)."""
    for session in list(_sessions):
        await session.close()
