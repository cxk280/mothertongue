"use client";

// Post-call recap overlay (shown after End call, computed from the real session).
// Same in-page overlay pattern as CompareRace; the latency stats stay the hero and
// the us-east comparison is the same honest simulated stand-in used in Compare.

import { useState } from "react";

import { languageLabel } from "@/lib/data";
import { SIM_USEAST_MS } from "@/lib/env";
import { formatMs } from "@/lib/format";
import { formatDuration, median, percentileNearestRank, simulatedUsEastMedian } from "@/lib/stats";
import type { UiTurn } from "@/lib/useCall";

interface SessionSummaryProps {
  regionLabel: string;
  src: string;
  dst: string;
  durationMs: number;
  turns: UiTurn[];
  onStartAnother: () => void;
  onHome: () => void;
}

const shortLang = (code: string) => languageLabel(code).replace(/\s*\(.*\)/, "");

export function SessionSummary({
  regionLabel,
  src,
  dst,
  durationMs,
  turns,
  onStartAnother,
  onHome,
}: SessionSummaryProps) {
  const rtts = turns.map((t) => t.rttMs);
  const computes = turns.map((t) => t.timings.total_ms);
  const medianRtt = median(rtts);
  const p95Rtt = percentileNearestRank(rtts, 95);
  const usEastMedian = simulatedUsEastMedian(computes, SIM_USEAST_MS);

  const [copied, setCopied] = useState(false);
  const copyTranscript = async () => {
    const text = turns
      .map((t) => `${shortLang(t.srcLang)}: ${t.srcText}\n${shortLang(t.dstLang)}: ${t.dstText}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context) — no-op */
    }
  };

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto bg-mt-base">
      <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col gap-[18px] px-5 pb-8 pt-12">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-mt-greenBrd bg-mt-greenDim">
            <CheckIcon />
          </span>
          <div>
            <h2 className="text-[19px] font-bold">Call ended</h2>
            <p className="text-[13px] text-mt-secondary">
              {regionLabel} · {shortLang(src)} ⇄ {shortLang(dst)}
            </p>
          </div>
        </header>

        <div className="flex gap-2.5">
          <Tile label="DURATION" value={formatDuration(durationMs)} />
          <Tile label="TURNS" value={turns.length.toString()} />
        </div>

        {/* Latency stats (hero) */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-mt-greenBrd bg-mt-greenDim p-4">
          <p className="text-[11px] font-bold tracking-wide text-mt-green">IN-REGION LATENCY</p>
          <div className="flex gap-6">
            <Stat value={medianRtt} caption="median" />
            <div className="w-px self-stretch bg-mt-greenBrd" />
            <Stat value={p95Rtt} caption="p95" />
          </div>
          <div className="flex items-center gap-2 rounded-[10px] bg-mt-base px-3 py-2.5">
            <span className="h-2 w-2 rounded-full bg-mt-red" />
            <span className="text-xs font-medium text-mt-secondary">
              us-east would have been ~{formatMs(usEastMedian)} ms median (simulated)
            </span>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex flex-col gap-3 rounded-2xl border border-mt-subtle bg-mt-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wide text-mt-muted">
              TRANSCRIPT · {turns.length} turns
            </p>
            <button
              onClick={copyTranscript}
              disabled={turns.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-mt-input px-2.5 py-1.5 text-[11px] font-semibold text-mt-secondary disabled:opacity-40"
            >
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {turns.length === 0 ? (
            <p className="py-2 text-sm text-mt-muted">No turns in this session.</p>
          ) : (
            turns.map((t) => (
              <div key={t.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-mt-green" />
                  <span className="text-xs font-semibold text-mt-green">You</span>
                  <span className="font-mono text-[10px] text-mt-muted">{formatMs(t.rttMs)}ms</span>
                </div>
                <p className="text-[13px] leading-4 text-mt-secondary">{t.srcText}</p>
                <p className="text-sm leading-5 text-mt-primary">{t.dstText}</p>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onStartAnother}
          className="rounded-2xl bg-mt-green py-4 text-base font-bold text-mt-base transition-transform active:scale-[0.99]"
        >
          Start another call
        </button>
        <button
          onClick={onHome}
          className="rounded-2xl border border-mt-strong py-[15px] text-[15px] font-semibold text-mt-secondary"
        >
          Back to home
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-mt-subtle bg-mt-surface px-3.5 py-3.5">
      <span className="text-[11px] font-semibold tracking-wide text-mt-muted">{label}</span>
      <span className="font-mono text-xl font-bold">{value}</span>
    </div>
  );
}

function Stat({ value, caption }: { value: number; caption: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono text-[34px] font-bold leading-none text-mt-green">{formatMs(value)}</span>
        <span className="font-mono text-sm text-mt-green">ms</span>
      </div>
      <span className="text-xs text-mt-secondary">{caption}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="m5 13 4 4L19 7" stroke="#2AE5A0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
