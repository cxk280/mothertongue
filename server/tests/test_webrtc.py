"""Live loopback test for the WebRTC transport.

Starlette's TestClient can't drive an async media handshake, so this test *is* the
browser: it stands up a real aiortc peer connection, completes an SDP offer/answer with
the server's ``create_session``, streams an Opus audio track, and drives one scripted
utterance end-to-end through the fallback pipeline over the data channel. This exercises
the actual media + control path, not a stub.
"""

import asyncio
import fractions
import json

import numpy as np
import pytest

pytest.importorskip("aiortc")  # skip cleanly where the native deps aren't installed

from aiortc import RTCPeerConnection, RTCSessionDescription  # noqa: E402
from aiortc.mediastreams import MediaStreamTrack  # noqa: E402
from av import AudioFrame  # noqa: E402

from app.config import Settings  # noqa: E402
from app.webrtc import create_session  # noqa: E402


class _ToneTrack(MediaStreamTrack):
    """A short 48 kHz mono tone so the server has real Opus audio to decode."""

    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self._pts = 0

    async def recv(self) -> AudioFrame:
        samples = (np.sin(2 * np.pi * 440 * np.arange(960) / 48000) * 6000).astype(np.int16)
        frame = AudioFrame.from_ndarray(samples.reshape(1, -1), format="s16", layout="mono")
        frame.sample_rate = 48000
        frame.pts = self._pts
        frame.time_base = fractions.Fraction(1, 48000)
        self._pts += 960
        await asyncio.sleep(0.02)
        return frame


async def _drive() -> dict:
    settings = Settings(mode="fallback", fallback_sleep=False)
    pc = RTCPeerConnection()
    got: dict = {}
    ready = asyncio.Event()
    turned = asyncio.Event()

    connected = asyncio.Event()
    channel = pc.createDataChannel("control")
    pc.addTrack(_ToneTrack())

    @pc.on("connectionstatechange")
    async def _on_state() -> None:
        if pc.connectionState == "connected":
            connected.set()

    @channel.on("open")
    def _on_open() -> None:
        channel.send(json.dumps({"type": "start", "src": "zul", "dst": "eng"}))

    @channel.on("message")
    def _on_message(message: str) -> None:
        data = json.loads(message)
        if data["type"] == "ready":
            got["ready"] = data
            ready.set()
        elif data["type"] == "turn":
            got["turn"] = data
            turned.set()

    await pc.setLocalDescription(await pc.createOffer())
    answer = await create_session(pc.localDescription.sdp, pc.localDescription.type, settings)
    await pc.setRemoteDescription(RTCSessionDescription(sdp=answer["sdp"], type=answer["type"]))

    try:
        await asyncio.wait_for(ready.wait(), timeout=15)
        # Wait until media is actually flowing before arming, so the recording window
        # can't race an audio track that hasn't started delivering frames yet.
        await asyncio.wait_for(connected.wait(), timeout=15)
        channel.send(json.dumps({"type": "start_utterance"}))  # arm capture (PTT down)
        await asyncio.sleep(0.6)  # let audio frames buffer server-side
        channel.send(json.dumps({"type": "end_utterance"}))  # PTT up
        await asyncio.wait_for(turned.wait(), timeout=15)
    finally:
        await pc.close()
    return got


def test_webrtc_loopback_drives_one_turn():
    got = asyncio.run(_drive())
    assert got["ready"]["engine"] == "fallback"
    assert got["ready"]["region_code"] == "sao"
    turn = got["turn"]
    assert turn["src_text"] and turn["dst_text"]  # scripted transcription + translation
    assert turn["audio_b64"]  # translated speech comes back as WAV over the channel
    assert turn["dst_lang"] == "eng"
