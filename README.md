# MotherTongue — Real-time native-language voice AI

**MotherTongue** delivers real-time, two-way speech-to-speech translation and voice agents in
people's native languages, hosted on GPUs **physically located in emerging-market regions**
(Johannesburg, São Paulo, Mumbai) so round-trip latency is 2–40ms and the experience stays usable
over weak mobile networks. It serves the ~3 billion people for whom "US-East inference" means 300ms+
and feels broken.

**Vultr capability this proves:** GPU compute that actually sits *in* emerging-market regions —
a latency profile no hyperscaler can match because they have almost no GPU presence there.

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
