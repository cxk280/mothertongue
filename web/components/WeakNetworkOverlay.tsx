"use client";

// Presenter-facing weak-network demo (bottom sheet). Lets you pick a SIMULATED
// connection profile so you can talk through resilience on a call. It does NOT
// actually throttle the socket — the chosen profile is reflected in the Landing
// network chip so a presenter can point at it.

import { useState } from "react";

import { NETWORK_PROFILES, networkProfile } from "@/lib/data";

const WEAK = NETWORK_PROFILES.filter((p) => p.id !== "off");

interface WeakNetworkOverlayProps {
  activeId: string;
  onApply: (id: string) => void;
  onClose: () => void;
}

export function WeakNetworkOverlay({ activeId, onApply, onClose }: WeakNetworkOverlayProps) {
  const [selected, setSelected] = useState(activeId);
  const profile = networkProfile(selected);
  const on = selected !== "off";

  const toggleMaster = () => setSelected(on ? "off" : "3g");

  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-black/60" onClick={onClose}>
      <div className="flex w-full max-w-[420px] flex-col justify-end" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-[18px] rounded-t-3xl border border-mt-subtle bg-mt-surface px-5 pb-7 pt-3">
          <div className="flex justify-center">
            <span className="h-[5px] w-10 rounded-full bg-mt-strong" />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-bold">Simulate weak network</h2>
              <p className="mt-1 text-[13px] leading-[18px] text-mt-secondary">
                A presenter demo — throttle the readout to prove the in-region path stays usable.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mt-input text-mt-secondary"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Master toggle */}
          <div className="flex items-center justify-between rounded-xl border border-mt-subtle bg-mt-input px-4 py-3.5">
            <span className="text-[15px] font-semibold">Throttling enabled</span>
            <button
              onClick={toggleMaster}
              role="switch"
              aria-checked={on}
              aria-label="Throttling enabled"
              className={`flex h-[26px] w-[46px] items-center rounded-full px-[3px] transition-colors ${
                on ? "justify-end bg-mt-green" : "justify-start border border-mt-strong bg-mt-input"
              }`}
            >
              <span className={`h-5 w-5 rounded-full ${on ? "bg-mt-base" : "bg-mt-muted"}`} />
            </button>
          </div>

          {/* Profile segmented control */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-mt-muted">PROFILE</span>
            <div className={`flex gap-1.5 rounded-xl border border-mt-subtle bg-mt-input p-[5px] ${on ? "" : "opacity-40"}`}>
              {WEAK.map((p) => {
                const active = on && selected === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`flex-1 rounded-[9px] py-2.5 text-sm font-medium ${
                      active
                        ? "border border-mt-greenBrd bg-mt-elevated font-semibold text-mt-green"
                        : "text-mt-secondary"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Readout tiles */}
          <div className="flex gap-2.5">
            <StatTile label="APPLIED BITRATE" value={on ? String(profile.bitrateKbps) : "—"} unit={on ? "kbps" : ""} />
            <StatTile label="PACKET LOSS" value={on ? String(profile.lossPct) : "—"} unit={on ? "%" : ""} amber={on} />
          </div>

          {/* In-region note */}
          <div className="flex gap-2.5 rounded-xl border border-mt-greenBrd bg-mt-greenDim px-3.5 py-3.5">
            <InfoIcon />
            <p className="text-[13px] leading-[18px] text-mt-secondary">
              The in-region path stays conversational — only the last mile is slow, there’s no ocean
              hop to amplify it. <span className="text-mt-muted">(Simulated readout, not real throttling.)</span>
            </p>
          </div>

          <button
            onClick={() => {
              onApply(selected);
              onClose();
            }}
            className="rounded-xl bg-mt-green py-4 text-base font-bold text-mt-base transition-transform active:scale-[0.99]"
          >
            Apply &amp; close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit, amber }: { label: string; value: string; unit: string; amber?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-mt-subtle bg-mt-base px-3.5 py-3.5">
      <span className="text-[11px] font-semibold tracking-wide text-mt-muted">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-[22px] font-bold ${amber ? "text-mt-amber" : "text-mt-primary"}`}>{value}</span>
        {unit && <span className="font-mono text-xs text-mt-muted">{unit}</span>}
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
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="#2AE5A0" strokeWidth="2" />
      <path d="M12 11v5M12 8h.01" stroke="#2AE5A0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
