# Architecture

MotherTongue is a single-region, speech-to-speech translation demo. The point it proves is
**geography**: the GPU sits in the same region as the user, so the round-trip is tens of
milliseconds instead of the 300 ms+ of a cross-ocean hop.

```
┌──────────────┐   PCM16 frames (uplink)    ┌─────────────────────────────┐
│   Browser    │ ─────────────────────────► │  FastAPI  /ws   (in-region) │
│  (web/)      │                            │                             │
│              │   turn: text + WAV + ms    │   STT ─► MT ─► TTS           │
│  Latency HUD │ ◄───────────────────────── │   (each stage timed)        │
└──────────────┘                            └─────────────────────────────┘
        │                                            models (real path):
        │ measures send→turn round-trip              MMS-ASR / NLLB-200 / MMS-TTS
        ▼                                            or CPU fallback (no GPU)
   the hero number
```

## Repo layout

| Path | What it is |
|---|---|
| `web/` | Next.js (App Router, TS, Tailwind). Landing + Call screen. The latency HUD is the hero. |
| `server/` | FastAPI WebSocket inference service. Three timed stages behind `Protocol`s. |
| `server/app/pipeline.py` | Orchestrator — STT→MT→TTS, times each stage, emits the `turn`. |
| `server/app/{stt,mt,tts}.py` | Each stage: a real (model-backed) impl **and** a CPU fallback. |
| `infra/` | GPU Dockerfile + Vultr provision / deploy / teardown scripts + runbook. |
| `docs/PROTOCOL.md` | The WebSocket wire contract (mirrored in TS + pydantic). |

## Why these models

- **STT — Meta MMS-ASR (`mms-1b-all`)**: covers isiZulu (and ~1000 languages) via per-language
  adapters. Whisper does **not** support Zulu, so it was disqualified for the source stage.
- **MT — NLLB-200 distilled-600M**: `zul_Latn ↔ eng_Latn`, lean enough to keep the three
  stages visibly distinct in the HUD.
- **TTS — Meta MMS-TTS (`mms-tts-zul` / `mms-tts-eng`)**: ships an isiZulu voice; XTTS does not.

## Design decisions (this increment)

- **Transport is a plain WebSocket.** Simple, cheap on weak networks, and the app-layer
  round-trip is exactly the number the HUD should show. WebRTC (jitter buffer, NAT traversal)
  is a later hardening step.
- **Single-speaker push-to-talk.** You speak in the source language and hear the translation
  back. Two-way peer calling (rooms, peer signaling) is a later increment.
- **CPU fallback is first-class**, not a mock afterthought: it keeps the app runnable and the
  CI green without a GPU, and makes local development free.
- **The GPU is cattle.** It is provisioned on demand and torn down when idle (hourly billing);
  no state lives on it.
