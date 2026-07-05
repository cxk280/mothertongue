import json

from fastapi.testclient import TestClient

from app.main import app

SILENCE = bytes(2 * 16000)  # 1s of PCM16 silence

# NOTE: the full two-peer relay is covered by test_rooms.py::relay (pure, no sockets)
# and by the live two-client integration check in the PR. Starlette's TestClient runs
# websockets on a single portal thread, so two *concurrent* connections deadlock — hence
# only single-connection cases are exercised here.


def test_join_requires_a_room_code():
    client = TestClient(app)
    with client.websocket_connect("/room") as a:
        a.send_text(json.dumps({"type": "join", "room": "", "lang": "zul"}))
        err = a.receive_json()
        assert err["type"] == "error" and err["code"] == "no_room"


def test_room_overlong_utterance_is_capped():
    client = TestClient(app)
    with client.websocket_connect("/room") as a:
        a.send_text(json.dumps({"type": "join", "room": "r", "lang": "zul"}))
        assert a.receive_json()["type"] == "joined"
        a.send_bytes(bytes(70000))  # exceeds the (test) 64000-byte cap
        msg = a.receive_json()
        assert msg["type"] == "error" and msg["code"] == "too_long"


def test_speaking_alone_reports_no_peer():
    client = TestClient(app)
    with client.websocket_connect("/room") as a:
        a.send_text(json.dumps({"type": "join", "room": "solo", "lang": "zul"}))
        assert a.receive_json()["type"] == "joined"
        a.send_bytes(SILENCE)
        a.send_text(json.dumps({"type": "end_utterance"}))
        err = a.receive_json()
        assert err["type"] == "error" and err["code"] == "alone"
