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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import load_settings
from .messages import ServerError, ServerReady
from .pipeline import Pipeline, build_pipeline

logger = logging.getLogger("mothertongue")

settings = load_settings()
app = FastAPI(title="MotherTongue inference", version=__version__)
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
    }


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
                src, dst = msg.get("src", "zul"), msg.get("dst", "eng")
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


async def _send(ws: WebSocket, model) -> None:
    await ws.send_text(model.model_dump_json())
