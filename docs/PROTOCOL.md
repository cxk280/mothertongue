# WebSocket protocol

The browser and the in-region inference server speak over a single WebSocket at
`/ws`. This document is the source of truth for the wire format; it is mirrored in
two typed files that **must change together**:

- `server/app/messages.py` (pydantic models)
- `web/lib/types.ts` (TypeScript types)

## Shape

Text frames are JSON objects with a `type` discriminator. Microphone audio is sent
as **raw binary** frames (mono PCM16, little-endian, 16 kHz) — not JSON — to keep the
uplink cheap on weak networks.

### Client → Server

| Message | Fields | When |
|---|---|---|
| `start` | `src`, `dst` (ISO-639-3, e.g. `zul`, `eng`) | Once, right after connect. Selects the language pair. |
| *(binary)* | PCM16 @ 16 kHz mono | Continuously while the mic is held (push-to-talk). |
| `end_utterance` | — | Push-to-talk released. Server runs STT→MT→TTS on the buffered audio. |
| `stop` | — | End the session. |

### Server → Client

| Message | Fields | When |
|---|---|---|
| `ready` | `region_label`, `region_code`, `engine` (`real`\|`fallback`), `src`, `dst` | After `start`, once the pipeline is loaded. |
| `turn` | `id`, `src_lang`, `dst_lang`, `src_text`, `dst_text`, `timings`, `audio_b64`, `audio_mime` | One per completed utterance. |
| `error` | `code`, `message` | On any failure. |

`timings` is the payload the latency HUD renders:

```jsonc
{ "stt_ms": 41.2, "mt_ms": 63.0, "tts_ms": 58.7, "total_ms": 163.4 }
```

`total_ms` is the server-side pipeline wall time. The **round-trip** number shown in
the HUD is measured by the client (send → `turn` received), so it also captures the
in-region network hop — which is the whole point.

## Notes

- `engine` is surfaced deliberately so a demo is honest about whether it is running
  the real models or the CPU fallback.
- One utterance = one `turn`. This first version is single-speaker push-to-talk;
  two-way peer calling is a later increment.

## WebRTC transport (opt-in)

An alternative uplink for the single-speaker call, enabled with `MT_WEBRTC=1`
(server) and `NEXT_PUBLIC_WEBRTC=1` (web). The WebSocket transport above is always
available and remains the default.

The browser opens an `RTCPeerConnection` to the server (client↔server, **not** P2P —
the in-region GPU must terminate the media) and signals via a single HTTP call:

- `POST /webrtc/offer` with `{ sdp, type }` → responds `{ sdp, type }` (the server's
  answer; ICE is non-trickle, so the answer already carries candidates).

Audio travels as an **Opus track** (~24 kbps vs ~256 kbps for raw PCM16 — the
weak-network win); the server decodes it to PCM16 and feeds the *same* pipeline. All
control frames and every `ready`/`turn`/`error` above travel over an
`RTCDataChannel` labelled `control`, so the wire contract is otherwise identical and
the browser renders turns exactly as over WebSocket.

Because the browser streams audio continuously (rather than only while the mic is
held), the utterance is delimited explicitly with one extra client frame:

| Message | Fields | When |
|---|---|---|
| `start_utterance` | — | Push-to-talk pressed. Server arms capture (clears its buffer). |
| `end_utterance` | — | Push-to-talk released. Server runs the pipeline on what it captured. |

`start`, `stop`, and the server→client messages are unchanged.
