import json

import numpy as np
from fastapi.testclient import TestClient

from app.main import app


def _pcm(seconds: float = 1.0, rate: int = 16000) -> bytes:
    return np.zeros(int(seconds * rate), dtype="<i2").tobytes()


def test_ws_start_utterance_turn_roundtrip():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "src": "zul", "dst": "eng"}))
        ready = ws.receive_json()
        assert ready["type"] == "ready"
        assert ready["engine"] == "fallback"
        assert ready["region_code"]

        ws.send_bytes(_pcm())
        ws.send_text(json.dumps({"type": "end_utterance"}))
        turn = ws.receive_json()
        assert turn["type"] == "turn"
        assert turn["src_text"] and turn["dst_text"]
        assert set(turn["timings"]) == {"stt_ms", "mt_ms", "tts_ms", "total_ms"}
        assert turn["audio_b64"]

        ws.send_text(json.dumps({"type": "stop"}))


def test_ws_end_before_start_errors():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "end_utterance"}))
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["code"] == "not_started"


def test_overlong_utterance_is_capped():
    client = TestClient(app)
    with client.websocket_connect("/ws") as ws:
        ws.send_text(json.dumps({"type": "start", "src": "zul", "dst": "eng"}))
        assert ws.receive_json()["type"] == "ready"
        # Exceed the (test) 64000-byte cap in one frame.
        ws.send_bytes(bytes(70000))
        msg = ws.receive_json()
        assert msg["type"] == "error" and msg["code"] == "too_long"


def test_healthz():
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["webrtc"] is False  # opt-in transport is off by default


def test_webrtc_offer_404_when_disabled():
    # The opt-in WebRTC signaling endpoint is absent unless MT_WEBRTC is set — the WS
    # transport is the default. (The enabled path is covered live by test_webrtc.py.)
    client = TestClient(app)
    r = client.post("/webrtc/offer", json={"sdp": "x", "type": "offer"})
    assert r.status_code == 404
