# Architecture

MotherTongue is a single-region, speech-to-speech translation demo. The point it proves is
**geography**: the GPU sits in the same region as the user, so the round-trip is tens of
milliseconds instead of the 300 ms+ of a cross-ocean hop.

```
┌──────────────┐   PCM16 frames (uplink)    ┌─────────────────────────────┐
│   Browser    │ ─────────────────────────► │  FastAPI  (in-region)       │
│  (web/)      │                            │   /ws    single-speaker     │
│              │   turn: text + WAV + ms    │   /room  two-way relay      │
│  Latency HUD │ ◄───────────────────────── │   STT ─► MT ─► TTS (timed)  │
└──────────────┘                            └─────────────────────────────┘
        │                                            models (real path):
        │ measures send→turn round-trip              MMS-ASR / NLLB-200 / MMS-TTS
        ▼                                            or CPU fallback (no GPU)
   the hero number
```

Two endpoints share the same timed pipeline: `/ws` (single-speaker: you speak, you hear the
translation) and `/room` (two-way: two peers, each speaking their own language, hear the other
translated). Both reconnect with backoff on a dropped socket.

## Repo layout

| Path | What it is |
|---|---|
| `web/` | Next.js (App Router, TS, Tailwind). Landing, Call, Compare, Summary, About, Room. HUD is the hero. |
| `web/lib/{useCall,useRoom}.ts` | The single-speaker / two-way call state machines (WebSocket + mic + reconnect). |
| `server/` | FastAPI inference service. Three timed stages behind `Protocol`s. |
| `server/app/pipeline.py` | Orchestrator — STT→MT→TTS, times each stage, emits the `turn`. |
| `server/app/{stt,mt,tts}.py` | Each stage: a real (model-backed) impl **and** a CPU fallback. |
| `server/app/rooms.py` | Two-way room registry + pure `relay()` (used by the `/room` endpoint). |
| `infra/` | GPU Dockerfile + Vultr provision / deploy / teardown scripts + runbook. |
| `docs/PROTOCOL.md` | The WebSocket wire contract (mirrored in TS + pydantic). |

## Why these models

- **STT — Meta MMS-ASR (`mms-1b-all`)**: covers isiZulu (and ~1000 languages) via per-language
  adapters. Whisper does **not** support Zulu, so it was disqualified for the source stage.
- **MT — NLLB-200 distilled-600M**: `zul_Latn ↔ eng_Latn`, lean enough to keep the three
  stages visibly distinct in the HUD.
- **TTS — Meta MMS-TTS (`mms-tts-zul` / `mms-tts-eng`)**: ships an isiZulu voice; XTTS does not.

## Design decisions

- **Transport is a plain WebSocket.** Simple, cheap on weak networks, and the app-layer
  round-trip is exactly the number the HUD should show. It reconnects with exponential backoff
  on a drop. WebRTC (jitter buffer, NAT traversal) is a possible later step.
- **Push-to-talk, one utterance per turn.** Single-speaker (`/ws`) and two-way (`/room`) both
  work this way; `/room` translates each utterance into the *other* peer's language.
- **CPU fallback is first-class**, not a mock afterthought: it keeps the app runnable and the
  CI green without a GPU, and makes local development free.
- **The GPU is cattle.** It is provisioned on demand and torn down when idle (hourly billing);
  no state lives on it.

## Not yet verified

The **real models have only run on the CPU fallback.** The `Real{STT,MT,TTS}` paths are
import-guarded and load on a GPU (`MT_DEVICE=cuda`); a São Paulo Vultr smoke test
(`infra/RUNBOOK.md`) is the remaining step to validate them end-to-end.
