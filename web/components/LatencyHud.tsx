"use client";

// The hero of the whole app: live per-turn round-trip ms + the STT/MT/TTS
// breakdown, colour-coded so "in-region is conversational" is undeniable.

import { formatMs, formatStageMs, latencyTier, tierClasses } from "@/lib/format";
import type { CallStatus } from "@/lib/useCall";
import type { Timings } from "@/lib/types";

interface LatencyHudProps {
  regionLabel: string;
  engine: "real" | "fallback" | null;
  status: CallStatus;
  rttMs: number | null;
  timings: Timings | null;
}

function Stage({ label, ms, frac }: { label: string; ms: number; frac: number }) {
  return (
    <div className="flex-1" style={{ flexGrow: Math.max(0.2, frac) }}>
      <div className="mb-[5px] font-mono text-[11px] text-mt-secondary">
        {label} {formatStageMs(ms)}ms
      </div>
      <div className="h-1 rounded-full bg-mt-green" />
    </div>
  );
}

export function LatencyHud({ regionLabel, engine, status, rttMs, timings }: LatencyHudProps) {
  const tier = rttMs != null ? latencyTier(rttMs) : "good";
  const tc = tierClasses(tier);
  const stageTotal = timings ? timings.stt_ms + timings.mt_ms + timings.tts_ms : 1;

  return (
    <div className="w-full border-b border-mt-greenBrd bg-mt-greenDim px-5 pb-4 pt-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-[9px] w-[9px] rounded-full ${tc.dot}`} />
          <span className={`text-sm font-semibold ${tc.text}`}>{regionLabel || "connecting…"}</span>
          <span className="text-[13px] text-mt-secondary">· in-region</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-mt-strong px-2.5 py-1">
          <span className="h-[7px] w-[7px] rounded-full bg-mt-red" />
          <span className="text-[11px] font-semibold tracking-wide text-mt-secondary">
            {engine === "fallback" ? "DEMO" : "LIVE"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono text-[52px] font-bold leading-none ${tc.text}`}>
            {rttMs != null ? formatMs(rttMs) : "—"}
          </span>
          <span className={`font-mono text-xl ${tc.text}`}>ms</span>
        </div>
        <span className="text-right text-xs text-mt-secondary">
          {status === "ready" && rttMs == null ? "tap & speak" : "round-trip · this turn"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <Stage label="STT" ms={timings?.stt_ms ?? 0} frac={(timings?.stt_ms ?? 1) / stageTotal} />
        <Stage label="MT" ms={timings?.mt_ms ?? 0} frac={(timings?.mt_ms ?? 1) / stageTotal} />
        <Stage label="TTS" ms={timings?.tts_ms ?? 0} frac={(timings?.tts_ms ?? 1) / stageTotal} />
      </div>
    </div>
  );
}
