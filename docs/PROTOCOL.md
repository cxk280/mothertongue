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
