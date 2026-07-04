"use client";

// The "aha moment": race the SAME utterance down two paths — the real in-region
// round-trip vs a clearly-simulated us-east (cross-ocean) path — so the gap is
// undeniable. Shown as an in-page overlay so the call session stays alive.

import { useEffect, useState } from "react";

import { SIM_USEAST_MS } from "@/lib/env";
import { formatMs } from "@/lib/format";
import { formatMultiplier, raceDurations, simulatedUsEastMs, verdictMultiplier } from "@/lib/compare";

const VISUAL_MAX_MS = 2600; // the slower lane finishes in ~2.6s — watchable

interface CompareRaceProps {
  regionLabel: string;
  inRegionRttMs: number; // real measured round-trip of the last turn
  computeMs: number; // real pipeline compute (last turn total_ms)
  utterance: string;
  onClose: () => void;
}

export function CompareRace({ regionLabel, inRegionRttMs, computeMs, utterance, onClose }: CompareRaceProps) {
  const usEastMs = simulatedUsEastMs(computeMs, SIM_USEAST_MS);
  const inRegionMs = inRegionRttMs;
  const multiplier = verdictMultiplier(inRegionMs, usEastMs);
  const { inRegionVisualMs, usEastVisualMs } = raceDurations(inRegionMs, usEastMs, VISUAL_MAX_MS);

  const [started, setStarted] = useState(false);
  const [inRegionDone, setInRegionDone] = useState(false);
  const [usEastDone, setUsEastDone] = useState(false);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    setStarted(false);
    setInRegionDone(false);
    setUsEastDone(false);
    const raf = requestAnimationFrame(() => setStarted(true));
    const t1 = setTimeout(() => setInRegionDone(true), inRegionVisualMs);
    const t2 = setTimeout(() => setUsEastDone(true), usEastVisualMs);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [runKey, inRegionVisualMs, usEastVisualMs]);

  const replay = () => setRunKey((k) => k + 1);

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-mt-base">
      <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col gap-[18px] px-5 pb-8 pt-12">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold">Same utterance, two paths</h2>
            <p className="text-xs text-mt-muted">Real in-region vs. simulated US-East</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Back to call"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-mt-input text-mt-secondary"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="rounded-xl border border-mt-subtle bg-mt-surface px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-wide text-mt-muted">RACING THIS TURN</p>
          <p className="mt-1 text-[15px] font-medium leading-5 text-mt-primary">“{utterance}”</p>
        </div>

        <Lane
          name={regionLabel}
          sub="in-region GPU"
          ms={inRegionMs}
          accent="green"
          started={started}
          visualMs={inRegionVisualMs}
          done={inRegionDone}
          doneLabel="delivered · conversational"
          waitLabel="delivering…"
        />
        <Lane
          name="us-east-1"
          sub="simulated · cross-ocean"
          ms={usEastMs}
          accent="red"
          started={started}
          visualMs={usEastVisualMs}
          done={usEastDone}
          doneLabel="delivered"
          waitLabel="still streaming…"
        />

        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-mt-greenBrd bg-mt-greenDim py-[18px]">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-[38px] font-bold leading-none text-mt-green">
              {formatMultiplier(multiplier)}
            </span>
            <span className="text-xl font-bold text-mt-green">× faster</span>
          </div>
          <p className="text-center text-[13px] text-mt-secondary">
            and it stays conversational — no ocean hop.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={replay}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-mt-strong py-[15px] text-[15px] font-semibold text-mt-secondary"
          >
            <ReplayIcon />
            Replay
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-mt-green py-[15px] text-[15px] font-bold text-mt-base"
          >
            Back to call
          </button>
        </div>
      </div>
    </div>
  );
}

function Lane({
  name,
  sub,
  ms,
  accent,
  started,
  visualMs,
  done,
  doneLabel,
  waitLabel,
}: {
  name: string;
  sub: string;
  ms: number;
  accent: "green" | "red";
  started: boolean;
  visualMs: number;
  done: boolean;
  doneLabel: string;
  waitLabel: string;
}) {
  const isGreen = accent === "green";
  const border = isGreen ? "border-mt-greenBrd" : "border-mt-redBrd";
  const text = isGreen ? "text-mt-green" : "text-mt-red";
  const dot = isGreen ? "bg-mt-green" : "bg-mt-red";
  const barBg = isGreen ? "bg-mt-green" : "bg-mt-red";

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border ${border} bg-mt-surface p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-[9px] w-[9px] rounded-full ${dot}`} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[11px] text-mt-muted">{sub}</p>
          </div>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className={`font-mono text-[26px] font-bold ${text}`}>{formatMs(ms)}</span>
          <span className={`font-mono text-[13px] ${text}`}>ms</span>
        </div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-mt-input">
        <div
          className={`h-full rounded-full ${barBg}`}
          style={{
            width: started ? "100%" : "0%",
            transition: `width ${visualMs}ms linear`,
          }}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {done && isGreen && <CheckIcon />}
        <span className={`text-xs font-medium ${done ? text : "text-mt-muted"}`}>
          {done ? doneLabel : waitLabel}
        </span>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ReplayIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3v6h6M3.5 9a9 9 0 1 1-1 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="m5 13 4 4L19 7" stroke="#2AE5A0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
