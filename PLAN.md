# MotherTongue — Real-time native-language voice AI

> One of four Vultr capability-showcase projects. Sibling repos: `enclave`, `proxima`, `acre`.
> Optimization target: a **Vultr capability showcase** — make the unique advantage viscerally obvious.

## Elevator pitch

MotherTongue is a live speech-to-speech pipeline (speech recognition → machine translation →
speech synthesis) for low-resource and regional languages, hosted on **Vultr GPUs in the region where
the users actually are**. Because the compute is 2–40ms away instead of an ocean away, a spoken
sentence comes back translated fast enough to feel like a real conversation — even on a 3G phone.

**The single Vultr capability it proves:** GPUs physically in Johannesburg / São Paulo / Mumbai →
conversational, sub-perceptible latency for the Global South.

## Target user / niche & why hyperscalers can't serve it

Local-language call centers, tele-clinics, and government service lines across Africa, Latin America,
and South Asia serving speakers of languages that hyperscaler consumer assistants ignore. The niche
is *real-time* voice for these users: hyperscalers have essentially no GPU inference presence in these
regions, so every request round-trips to the US or EU and the 250–400ms floor destroys the
conversational feel. MotherTongue's advantage is pure geography — and Vultr is the only provider with
GPUs sitting there.

## Showcase architecture

- **Compute:** Vultr **Cloud GPU** deployed in an emerging-market region; optionally **Serverless
  Inference** for burstable pieces of the pipeline.
- **Pipeline:** streaming STT → machine translation → TTS using open models (Whisper-class ASR,
  SeamlessM4T-class translation, XTTS-class voice synthesis). Fully in-region; no US/EU hop.
- **Transport:** low-bitrate audio streaming tuned for weak networks.
- **Capability spotlight (make it *visible*):** a **latency HUD** overlaying serving region and live
  round-trip ms, plus a **side-by-side race** — the same utterance routed to an in-region GPU vs a
  simulated US-East endpoint — so the 2–40ms vs 300ms+ gap is undeniable on screen.

## Demo script (~60s)

1. Start a two-way call: one speaker in a low-resource language, one in English.
2. Each spoken turn is translated and voiced back in near real time; the latency HUD reads e.g.
   **"São Paulo · 31ms."**
3. Hit "compare to US-East": the same turn now lags ~300ms and stutters — the contrast sells itself.
4. Throttle to a simulated weak network; the in-region path stays conversational.

## Next steps for the build Claude

1. Author **`VIEWS.md`** (call screen + latency HUD, region/language picker, compare view, transcript).
2. Create **Figma mocks** and get user approval **before any UI coding** (global rule).
3. Run **`/factory`** to build end-to-end into a reviewable PR.
4. Start with one language pair + one region end-to-end, then widen. Keep the latency HUD the hero.
