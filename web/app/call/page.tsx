"use client";

// The Call screen: push-to-talk in the source language, hear the translation back,
// with the latency HUD as the hero. Single-speaker in this increment.

import { Suspense, useEffect, useState } from "react";
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

  const call = useCall(WS_URL, src, dst);
  const [showCompare, setShowCompare] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryDurationMs, setSummaryDurationMs] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => call.connect(), []);

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
        <div className="flex items-center justify-center gap-7">
          <button
            onClick={goHome}
            aria-label="Leave"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-mt-strong bg-mt-elevated text-mt-secondary"
          >
            <BackIcon />
          </button>
          <button
            onPointerDown={() => call.startTalk()}
            onPointerUp={() => call.speaking && call.stopTalk()}
            onPointerLeave={() => call.speaking && call.stopTalk()}
            onPointerCancel={() => call.speaking && call.stopTalk()}
            onContextMenu={(e) => e.preventDefault()}
            disabled={call.status !== "ready"}
            aria-label="Hold to talk"
            className={`flex h-[74px] w-[74px] touch-none select-none items-center justify-center rounded-full text-mt-base transition-transform active:scale-95 ${
              call.speaking ? "bg-mt-greenDeep scale-105" : "bg-mt-green"
            } ${call.status !== "ready" ? "opacity-40" : ""}`}
          >
            <MicIcon />
          </button>
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
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-mt-base/95 px-6">
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
