"use client";

// The Call screen: push-to-talk in the source language, hear the translation back,
// with the latency HUD as the hero. Single-speaker in this increment.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CompareRace } from "@/components/CompareRace";
import { LatencyHud } from "@/components/LatencyHud";
import { SessionSummary } from "@/components/SessionSummary";
import { Transcript } from "@/components/Transcript";
import { Waveform } from "@/components/Waveform";
import { regionByCode } from "@/lib/data";
import { WS_URL } from "@/lib/env";
import { useCall } from "@/lib/useCall";

export default function CallPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-mt-base" />}>
      <CallInner />
    </Suspense>
  );
}

function CallInner() {
  const router = useRouter();
  const params = useSearchParams();
  const src = params.get("src") ?? "zul";
  const dst = params.get("dst") ?? "eng";
  const region = params.get("region") ?? "sao";
  const sample = params.get("sample") === "1";

  const call = useCall(WS_URL, src, dst);
  const [showCompare, setShowCompare] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryDurationMs, setSummaryDurationMs] = useState(0);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [draft, setDraft] = useState("");
  const sampleStarted = useRef(false);

  const submitText = () => {
    if (call.status !== "ready" || !draft.trim()) return;
    call.translateText(draft);
    setDraft("");
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => call.connect(), []);

  // "Watch a sample call": auto-drive the scripted conversation with no mic. Only on
  // the fallback engine (it scripts from silence); the real engine needs real speech.
  useEffect(() => {
    if (!sample || call.status !== "ready" || call.engine !== "fallback") return;
    if (sampleStarted.current) return;
    sampleStarted.current = true;
    const TURNS = 4;
    let n = 0;
    const tick = () => {
      call.sampleUtterance();
      n += 1;
      if (n < TURNS) timer = window.setTimeout(tick, 2600);
    };
    let timer = window.setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [sample, call.status, call.engine, call.sampleUtterance]);

  // Keyboard: hold Space to talk (accessibility alternative to the mic button);
  // Escape closes the Compare overlay.
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCompare) setShowCompare(false);
      if (mode !== "voice") return; // Space-to-talk is voice mode only
      if (e.code !== "Space" || e.repeat || isTyping(e.target)) return;
      if (showCompare || showSummary || call.status !== "ready" || call.reconnecting) return;
      e.preventDefault();
      void call.startTalk();
    };
    const up = (e: KeyboardEvent) => {
      // Always release on Space up — stopTalk is idempotent and also clears a press that
      // was still starting the mic (so a quick tap can't leave it capturing).
      if (e.code !== "Space" || isTyping(e.target)) return;
      e.preventDefault();
      call.stopTalk();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode, call.status, call.reconnecting, call.startTalk, call.stopTalk, showCompare, showSummary]);

  const regionLabel = call.regionLabel || regionByCode(region).label;
  const lastTurn = call.turns[call.turns.length - 1];
  const canCompare = lastTurn != null && call.lastRtt != null && call.lastTimings != null;

  const goHome = () => {
    call.hangup();
    router.push("/");
  };

  // End the call: show the session summary if there's anything to recap; else leave.
  const endCall = () => {
    const durationMs = call.startedAt ? Date.now() - call.startedAt : 0;
    call.hangup();
    if (call.turns.length > 0) {
      setSummaryDurationMs(durationMs);
      setShowSummary(true);
    } else {
      router.push("/");
    }
  };

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-mt-base">
      <LatencyHud
        regionLabel={regionLabel}
        engine={call.engine}
        status={call.status}
        rttMs={call.lastRtt}
        timings={call.lastTimings}
      />

      {call.reconnecting && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-mt-amber/15 py-2 text-[13px] font-medium text-mt-amber"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-mt-amber/40 border-t-mt-amber" />
          Reconnecting to {regionLabel}…
        </div>
      )}

      {sample && call.engine === "fallback" && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-mt-greenDim py-2 text-[12px] font-semibold tracking-wide text-mt-green"
        >
          ▶ SAMPLE CALL · auto-playing, no mic needed
        </div>
      )}

      {call.notice && (
        <div role="status" className="bg-mt-surface py-2 text-center text-[13px] font-medium text-mt-amber">
          {call.notice}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <Transcript turns={call.turns} />
      </div>

      {/* Speaking indicator */}
      {call.speaking && (
        <div className="flex items-center justify-center gap-2.5 border-y border-mt-subtle bg-mt-surface py-2.5">
          <Waveform active level={call.micLevel} bars={10} />
          <span className="text-[13px] font-medium text-mt-secondary">You’re speaking…</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-4 border-t border-mt-subtle bg-mt-surface px-5 pb-8 pt-4">
        <button
          onClick={() => canCompare && setShowCompare(true)}
          disabled={!canCompare}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 transition-transform active:scale-[0.99] ${
            canCompare ? "border-mt-amber bg-mt-base text-mt-amber" : "border-mt-subtle text-mt-muted"
          }`}
        >
          <BoltIcon />
          <span className="text-[15px] font-semibold">Compare to US-East</span>
          {!canCompare && (
            <span className="rounded-full bg-mt-elevated px-2 py-0.5 text-[10px] font-semibold tracking-wide">
              AFTER 1 TURN
            </span>
          )}
        </button>
        {/* Voice / Text input mode */}
        <div className="flex gap-1 rounded-xl bg-mt-elevated p-1">
          {(["voice", "text"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                mode === m ? "bg-mt-surface text-mt-primary" : "text-mt-muted"
              }`}
            >
              {m === "voice" ? "🎙 Voice" : "⌨ Text"}
            </button>
          ))}
        </div>

        {mode === "text" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitText();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={call.status !== "ready"}
              placeholder="Type something to translate…"
              aria-label="Text to translate"
              className="min-w-0 flex-1 rounded-xl border border-mt-subtle bg-mt-input px-3.5 py-3 text-base text-mt-primary outline-none placeholder:text-mt-muted focus:border-mt-green disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={call.status !== "ready" || !draft.trim()}
              aria-label="Translate"
              className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl text-mt-base transition-transform active:scale-95 ${
                call.status === "ready" && draft.trim() ? "bg-mt-green" : "bg-mt-elevated text-mt-muted"
              }`}
            >
              <SendIcon />
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-7">
          <button
            onClick={goHome}
            aria-label="Leave"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-mt-strong bg-mt-elevated text-mt-secondary"
          >
            <BackIcon />
          </button>
          {mode === "voice" && (
            <button
              onPointerDown={() => call.startTalk()}
              onPointerUp={() => call.stopTalk()}
              onPointerLeave={() => call.stopTalk()}
              onPointerCancel={() => call.stopTalk()}
              onContextMenu={(e) => e.preventDefault()}
              disabled={call.status !== "ready" || call.reconnecting}
              aria-label="Hold to talk (or hold the Space bar)"
              aria-pressed={call.speaking}
              className={`flex h-[74px] w-[74px] touch-none select-none items-center justify-center rounded-full text-mt-base transition-transform active:scale-95 ${
                call.speaking ? "bg-mt-greenDeep scale-105" : "bg-mt-green"
              } ${call.status !== "ready" || call.reconnecting ? "opacity-40" : ""}`}
            >
              <MicIcon />
            </button>
          )}
          <button
            onClick={endCall}
            aria-label="End call"
            className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-mt-red text-white"
          >
            <EndIcon />
          </button>
        </div>
      </div>

      {/* Connecting overlay */}
      {call.status === "connecting" && (
        <Overlay>
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-mt-elevated border-t-mt-green" />
          <p className="text-lg font-bold">Connecting to {regionLabel}…</p>
          <p className="text-sm text-mt-secondary">Establishing the in-region session</p>
        </Overlay>
      )}

      {/* Error overlay */}
      {call.status === "error" && (
        <Overlay>
          <p className="text-lg font-bold text-mt-red">Connection problem</p>
          <p className="max-w-[280px] text-center text-sm text-mt-secondary">{call.error}</p>
          <div className="mt-2 flex gap-3">
            <button
              onClick={() => location.reload()}
              className="rounded-xl bg-mt-green px-5 py-3 text-sm font-bold text-mt-base"
            >
              Retry
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-mt-strong px-5 py-3 text-sm font-semibold text-mt-secondary"
            >
              Back
            </button>
          </div>
        </Overlay>
      )}

      {/* Compare / Race overlay */}
      {showCompare && canCompare && (
        <CompareRace
          regionLabel={regionLabel}
          inRegionRttMs={call.lastRtt as number}
          computeMs={(call.lastTimings as NonNullable<typeof call.lastTimings>).total_ms}
          utterance={lastTurn.dstText}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Session summary overlay (after End call) */}
      {showSummary && (
        <SessionSummary
          regionLabel={regionLabel}
          src={src}
          dst={dst}
          durationMs={summaryDurationMs}
          turns={call.turns}
          onStartAnother={() => {
            setShowSummary(false);
            call.restart();
          }}
          onHome={() => router.push("/")}
        />
      )}
    </main>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-mt-base/95 px-6"
    >
      {children}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function EndIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 9c-1.6 0-3.15.25-4.6.7v3.1c0 .5-.3.9-.7 1.05-1.2.4-2.3.95-3.3 1.65-.2.15-.45.2-.7.2-.3 0-.6-.12-.8-.35L.3 14.2A1.1 1.1 0 0 1 0 13.45c0-.3.12-.57.32-.75C3.06 10.1 7.3 8.5 12 8.5s8.94 1.6 11.68 4.2c.2.18.32.45.32.75 0 .3-.12.57-.32.77l-1.6 1.55c-.2.23-.5.35-.8.35-.25 0-.5-.05-.7-.2-1-.7-2.1-1.25-3.3-1.65-.4-.15-.7-.55-.7-1.05v-3.1C15.15 9.25 13.6 9 12 9Z" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" />
    </svg>
  );
}
