"""FastAPI entrypoint: a WebSocket that turns a spoken utterance into translated
speech, entirely in-region.

Protocol (see messages.py / web/lib/types.ts):
  client -> server:  {"start", src, dst}  then binary PCM16 frames,
                     then {"end_utterance"} on push-to-talk release, {"stop"} to end.
  server -> client:  {"ready", ...}  then one {"turn", ...} per utterance.
"""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import __version__
from .config import load_settings
from .messages import ServerError, ServerJoined, ServerPeer, ServerReady
from .pipeline import Pipeline, build_pipeline
from .rooms import Peer, RoomRegistry, relay

logger = logging.getLogger("mothertongue")

settings = load_settings()
registry = RoomRegistry(settings)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # Tear down any live WebRTC peer connections on shutdown.
    if settings.webrtc_enabled:
        try:
            from .webrtc import close_all_sessions
            await close_all_sessions()
        except Exception:
            pass


app = FastAPI(title="MotherTongue inference", version=__version__, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo service; tighten per-deployment if exposed publicly
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict:
    return {
        "status": "ok",
        "version": __version__,
        "region_label": settings.region_label,
        "region_code": settings.region_code,
        "mode": settings.mode,
        "device": settings.device,
        "webrtc": settings.webrtc_enabled,
    }


class WebrtcOffer(BaseModel):
    sdp: str
    type: str


@app.post("/webrtc/offer")
async def webrtc_offer(offer: WebrtcOffer) -> dict:
    """Signaling for the opt-in WebRTC transport: take the browser's SDP offer and
    return our answer. aiortc is imported lazily so the base server needs it only here."""
    if not settings.webrtc_enabled:
        raise HTTPException(status_code=404, detail="WebRTC transport is disabled")
    try:
        from .webrtc import create_session
    except Exception as exc:  # aiortc / native deps not installed
        logger.exception("webrtc import failed")
        raise HTTPException(status_code=503, detail=f"WebRTC unavailable: {exc}") from exc
    return await create_session(offer.sdp, offer.type, settings)


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    pipeline: Pipeline | None = None
    src = dst = ""
    buffer = bytearray()

    try:
        while True:
            event = await ws.receive()

            if event["type"] == "websocket.disconnect":
                break

            # Binary audio frame -> accumulate until end_utterance.
            if (data := event.get("bytes")) is not None:
                buffer.extend(data)
                if len(buffer) > settings.max_utterance_bytes:
                    buffer.clear()
                    await _send(ws, ServerError(
                        code="too_long", message="Utterance too long — please release the mic"
                    ))
                continue

            text = event.get("text")
            if text is None:
                continue

            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await _send(ws, ServerError(code="bad_json", message="Invalid message"))
                continue

            kind = msg.get("type")

            if kind == "start":
                # `or` (not `.get` defaults) so an explicit JSON null still falls back.
                src, dst = msg.get("src") or "zul", msg.get("dst") or "eng"
                buffer.clear()
                # First build may download/load models — keep the loop responsive.
                pipeline = await run_in_threadpool(build_pipeline, settings)
                await _send(ws, ServerReady(
                    region_label=settings.region_label,
                    region_code=settings.region_code,
                    engine=pipeline.engine,
                    src=src,
                    dst=dst,
                ))

            elif kind == "end_utterance":
                if pipeline is None:
                    await _send(ws, ServerError(code="not_started", message="Send start first"))
                    continue
                pcm = bytes(buffer)
                buffer.clear()
                if not pcm:
                    continue
                turn = await run_in_threadpool(pipeline.run, pcm, src, dst)
                await ws.send_text(turn.model_dump_json())

            elif kind == "translate_text":
                # Typed input instead of speech: translate+speak the text, skipping STT.
                if pipeline is None:
                    await _send(ws, ServerError(code="not_started", message="Send start first"))
                    continue
                typed = (msg.get("text") or "").strip()
                if not typed:
                    continue
                turn = await run_in_threadpool(pipeline.run_text, typed, src, dst)
                await ws.send_text(turn.model_dump_json())

            elif kind == "stop":
                break

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # never take the socket down without a reason on the wire
        logger.exception("ws error")
        try:
            await _send(ws, ServerError(code="internal", message=str(exc)))
        except Exception:
            pass


@app.websocket("/room")
async def room_endpoint(ws: WebSocket) -> None:
    """Two-way call: two peers in a room, each speaking their own language. A peer's
    utterance is translated into the OTHER peer's language and voiced to them."""
    await ws.accept()
    room_id: str | None = None
    peer_id: str | None = None
    lang = ""
    buffer = bytearray()

    async def notify_presence(room, present: bool, lang_val: str | None, to_peer) -> None:
        try:
            await _send(to_peer.ws, ServerPeer(present=present, lang=lang_val))
        except Exception:
            pass

    try:
        while True:
            event = await ws.receive()
            if event["type"] == "websocket.disconnect":
                break

            if (data := event.get("bytes")) is not None:
                buffer.extend(data)
                if len(buffer) > settings.max_utterance_bytes:
                    buffer.clear()
                    await _send(ws, ServerError(
                        code="too_long", message="Utterance too long — please release the mic"
                    ))
                continue

            text = event.get("text")
            if text is None:
                continue
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await _send(ws, ServerError(code="bad_json", message="Invalid message"))
                continue
            kind = msg.get("type")

            if kind == "join":
                if peer_id is not None:
                    # One socket = one participant; a second join would orphan the first.
                    await _send(ws, ServerError(
                        code="already_joined", message="This connection already joined a room"
                    ))
                    continue
                room_id = str(msg.get("room", "")).strip()
                lang = msg.get("lang") or "eng"
                if not room_id:
                    await _send(ws, ServerError(code="no_room", message="A room code is required"))
                    continue
                new_id = uuid.uuid4().hex
                buffer.clear()
                room = registry.join(room_id, Peer(id=new_id, lang=lang, ws=ws))
                if room is None:  # room already has two people
                    room_id = None
                    await _send(ws, ServerError(code="room_full", message="This room is full"))
                    continue
                peer_id = new_id
                await _send(ws, ServerJoined(
                    room=room_id, self_lang=lang,
                    region_label=settings.region_label, region_code=settings.region_code,
                    engine=room.pipeline.engine,
                ))
                other = room.other(peer_id)
                if other is not None:
                    await notify_presence(room, True, other.lang, room.peers[peer_id])
                    await notify_presence(room, True, lang, other)
                else:
                    # Tell this peer they're alone — corrects a reconnecting client whose
                    # partner left during the outage (otherwise it keeps a ghost peer).
                    await notify_presence(room, False, None, room.peers[peer_id])

            elif kind == "end_utterance":
                room = registry.get(room_id) if room_id else None
                pcm = bytes(buffer)
                buffer.clear()
                if room is None or room.other(peer_id) is None:
                    await _send(ws, ServerError(code="alone", message="No one else has joined yet"))
                    continue
                if not pcm:
                    continue
                listener, turn, sent = await run_in_threadpool(relay, room, peer_id, pcm)
                if listener is None:  # peer left mid-utterance
                    continue
                # Listener hears the translated audio; speaker gets a text-only echo.
                # A listener that vanished in the relay window must not take the speaker
                # down with it — presence will report the departure separately.
                try:
                    await listener.ws.send_text(turn.model_dump_json())
                except Exception:
                    pass
                await _send(ws, sent)

            elif kind == "leave":
                break

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("room error")
        try:
            await _send(ws, ServerError(code="internal", message=str(exc)))
        except Exception:
            pass
    finally:
        if room_id and peer_id:
            room = registry.leave(room_id, peer_id)
            if room is not None:
                for remaining in list(room.peers.values()):
                    await notify_presence(room, False, None, remaining)


async def _send(ws: WebSocket, model) -> None:
    await ws.send_text(model.model_dump_json())
