"use client";

// The scrolling conversation. Most recent turn is emphasized; older turns fade.
// Empty state prompts the first utterance.

import { formatMs } from "@/lib/format";
import type { UiTurn } from "@/lib/useCall";
import { Waveform } from "./Waveform";

function TurnCard({ turn, emphasized }: { turn: UiTurn; emphasized: boolean }) {
  return (
    <div className={emphasized ? "rounded-2xl border border-mt-subtle bg-mt-elevated p-3.5" : "opacity-60"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mt-greenDim text-[11px] font-bold text-mt-green">
            {turn.srcLang.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-[13px] font-semibold text-mt-primary">You</span>
          <span className="text-[11px] font-medium uppercase text-mt-muted">
            {turn.srcLang} → {turn.dstLang}
          </span>
        </div>
        {emphasized && turn.playing ? (
          <div className="flex items-center gap-1.5">
            <Waveform active level={0.5} bars={5} />
            <span className="text-[11px] font-medium text-mt-green">playing</span>
          </div>
        ) : (
          <span className="font-mono text-[11px] text-mt-secondary">{formatMs(turn.rttMs)}ms</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-5 text-mt-secondary">{turn.srcText}</p>
      <p
        className={
          emphasized
            ? "mt-1 text-lg font-semibold leading-6 text-mt-primary"
            : "mt-1 text-base leading-[22px] text-mt-primary"
        }
      >
        {turn.dstText}
      </p>
    </div>
  );
}

export function Transcript({ turns }: { turns: UiTurn[] }) {
  if (turns.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <p className="text-lg font-bold text-mt-primary">Tap and speak to begin</p>
        <p className="text-[13px] text-mt-secondary">Your words are translated the moment you stop</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5 px-5 py-4">
      {turns.map((turn, i) => (
        <TurnCard key={turn.id} turn={turn} emphasized={i === turns.length - 1} />
      ))}
    </div>
  );
}
