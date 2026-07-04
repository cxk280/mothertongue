# VIEWS.md — MotherTongue

Verbal description of every view in the application. This is the source of truth for Figma
mocks; mocks must be approved before any UI coding begins.

The **hero** of the entire app is the **latency HUD** — the live, on-screen proof that the GPU
is physically in-region. Every view keeps it visible or one tap away.

Design language: dark, high-contrast, "operations console" feel. Large legible type for the
transcript, a single accent color for the in-region path, a muted/red accent for the simulated
US-East path. Mobile-first (this is meant to feel usable on a 3G phone), scaling up to desktop
for demos.

---

## 1. Landing / Region + Language Picker

The entry screen. Establishes the premise before the call starts.

- **Header:** product name "MotherTongue", one-line tagline ("Talk in your language — answered
  in real time, from a GPU next door").
- **Serving-region selector:** a picker of emerging-market regions (Johannesburg, São Paulo,
  Mumbai) with a small world-map or region badge. The currently-selected region shows its
  measured round-trip ping as a live number the moment the page loads (e.g. "São Paulo · 31ms").
- **Language pair selector:** two dropdowns — "I speak" (low-resource/regional language) and
  "They speak" (defaults to English). Swappable with a single swap button between them.
- **Primary CTA:** "Start call" — large, thumb-reachable.
- **Secondary link:** "How this works" (opens the About/explainer view).
- **Network state chip:** shows detected connection quality (e.g. "Network: 3G · 180kbps") and a
  demo toggle to simulate a weak network.

## 2. Call Screen (primary view — the product)

The two-way live speech-to-speech translation session. This is where users spend their time.

- **Latency HUD (hero element):** persistent overlay, top of screen. Shows serving region name
  and **live round-trip milliseconds**, updated per turn. Color-coded green when in-region and
  conversational (<80ms), amber/red when degraded. This is the single most important pixel on the
  screen — it must always be readable against the transcript behind it.
- **Live transcript:** scrolling two-column (or stacked, on mobile) conversation. Each turn shows:
  original spoken text, the translated text, and a small speaker/voice indicator when TTS is
  playing back. The most recent turn is emphasized (larger, brighter); older turns fade upward.
- **Speaking indicator:** an animated waveform / VU meter while a party is speaking, so it's
  obvious who has the floor and that audio is being captured.
- **Pipeline-stage micro-breakdown (optional, tap to reveal):** for a given turn, a tiny inline
  breakdown of where the milliseconds went — STT → translation → TTS — reinforcing that the whole
  pipeline runs in-region.
- **Controls (bottom bar):**
  - Push-to-talk / mute mic toggle (large, primary).
  - Swap direction (who's speaking now) if not auto-detected.
  - "Compare to US-East" button — launches the Compare/Race view for the last utterance.
  - End call.

## 3. Compare / Race View (the "aha" moment)

Triggered from the call screen. Runs the **same** utterance down two paths side by side.

- **Two lanes, side by side (stacked on mobile):**
  - **In-region lane:** serving region label, live ms counter, a progress bar that fills as the
    translated audio returns. Finishes near-instantly.
  - **Simulated US-East lane:** "us-east" label, higher ms counter, the same progress bar lagging
    visibly behind and (optionally) stuttering.
- **Race animation:** both bars start together on a "Go"; the in-region bar completes while the
  US-East bar is still crawling. The finishing times are printed large (e.g. "31ms" vs "312ms").
- **Verdict line:** a plain-language summary ("~10× faster, and it stays conversational").
- **Replay button** and **Back to call** button.

## 4. Weak-Network Demo Overlay

A modal/overlay (reachable from the network chip on Landing or from the call screen) that lets a
presenter throttle the connection to prove the in-region path stays usable.

- Toggle: "Simulate weak network" with presets (3G / 2G / lossy).
- Live readout of applied bitrate and packet loss.
- A short note that the in-region path remains conversational because there is no ocean hop.
- Close returns to the previous view with the throttle applied and visibly reflected in the HUD.

## 5. About / How It Works (explainer)

Static informational view for first-time viewers and judges.

- Short narrative of the premise: GPUs physically in emerging-market regions → sub-perceptible
  latency for the Global South.
- A simple pipeline diagram: microphone → streaming STT → machine translation → TTS → speaker,
  labeled "all in-region."
- The Vultr capability statement, plainly worded.
- Link back to Landing / Start call.

## 6. Session Summary (post-call)

Shown after "End call". Recap and shareable proof.

- Call duration, number of turns, language pair, serving region.
- **Latency stats:** median / p95 round-trip ms for the in-region path, contrasted with the
  simulated US-East figure.
- Full scrollable transcript (original + translation) with an option to copy/export.
- CTAs: "Start another call" and "Back to home".

## 7. Global / Ambient States

Not full screens, but must be designed as part of every relevant view:

- **Connecting / provisioning state:** while the session to the in-region GPU is establishing
  (spinner + region name + "connecting to <region>…").
- **Error / degraded states:** mic permission denied; GPU endpoint unreachable; network dropped
  mid-call. Each with a clear recovery action.
- **Empty state** on the call screen before the first utterance ("Tap and speak to begin").
- **Loading skeletons** for the transcript and HUD numbers before first data arrives.
</content>
</invoke>
