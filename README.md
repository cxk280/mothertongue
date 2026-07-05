# MotherTongue — Real-time native-language voice AI

**MotherTongue** delivers real-time, two-way speech-to-speech translation and voice agents in
people's native languages, hosted on GPUs **physically located in emerging-market regions**
(Johannesburg, São Paulo, Mumbai) so round-trip latency is 2–40ms and the experience stays usable
over weak mobile networks. It serves the ~3 billion people for whom "US-East inference" means 300ms+
and feels broken.

**Vultr capability this proves:** GPU compute that actually sits *in* emerging-market regions —
a latency profile no hyperscaler can match because they have almost no GPU presence there.

## What's built

A full mobile-first web app (dark "operations console" UI) over a streaming STT → MT → TTS
pipeline, with the **live latency HUD as the hero** on every relevant screen:

- **Landing** — pick serving region + language pair, see the real in-region ping.
- **Call** — single-speaker push-to-talk: speak your language, hear the translation back; live
  round-trip + STT/MT/TTS breakdown in the HUD.
- **Two-way call** — a room you share by link; two people each speak their own language and hear
  the other translated in real time (`/room/<code>`).
- **Compare / Race** — the same utterance raced against a (clearly simulated) US-East path — the
  "~10× faster" moment.
- **Session Summary** — post-call recap: duration, median/p95 in-region latency, transcript.
- **About**, **Weak-network demo overlay**, and the connecting / error / empty / reconnecting states.

Both call flows are hardened for weak networks: the WebSocket **auto-reconnects with exponential
backoff**, the server caps an over-long utterance, and the UI supports **hold-Space push-to-talk**,
dialog semantics, and `prefers-reduced-motion`.

Everything runs on a **CPU fallback** today; the real models run when deployed to a GPU (below).

## Getting started (no GPU needed)

The whole app runs locally on the **CPU fallback** — a deterministic stub pipeline with
realistic per-stage timing — so you can click through the real UI and WebSocket flow without
any models or GPU. The real models load only when `MT_DEVICE=cuda` (or `MT_MODE=real`).

```bash
cp .env.example .env
make install          # web deps + a Python venv for the server (fallback deps only)
make server           # inference server on :8000  (fallback engine)
make web              # Next.js app on :3000  (in another terminal)
```

Open http://localhost:3000, pick isiZulu → English, and start a call. The latency HUD shows
the live per-turn round-trip and the STT → MT → TTS breakdown. To try the **two-way** flow,
hit "Start a two-way call", then open the shared `/room/<code>` link in a second tab (or on
another device) and pick the other language.

- **Architecture & repo layout:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **WebSocket wire contract:** [`docs/PROTOCOL.md`](./docs/PROTOCOL.md)
- **Deploy the real pipeline on a Vultr GPU:** [`infra/RUNBOOK.md`](./infra/RUNBOOK.md)

## Cost estimate (tight budget)

Designed to run on **hourly billing, torn down when idle** — deploy the GPU in **one** emerging-market
region for the demo.

| Item | Rate | Notes |
|---|---|---|
| Inference GPU (L40S-class, or a single A16 for a lean pipeline) | ~$0.47–1.20/hr | Streaming STT → MT → TTS; runs only during dev/demo |
| App / signaling host (Cloud Compute) | ~$0.01/hr (~$5–10/mo) | Audio streaming + UI |
| Object Storage (optional) | ~$6/mo | Store sample audio/transcripts |
| **~4-hour demo session** | **≈ $3–6 total** | |

**Destroy the GPU instance when not in use** — hourly billing is the whole point of keeping this cheap.

See [`PLAN.md`](./PLAN.md) for the full concept and build plan.
