"use client";

// Landing: pick a serving region + language pair, see the live in-region ping, and
// start a call. Only São Paulo / isiZulu <-> English is wired in this increment.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { WeakNetworkOverlay } from "@/components/WeakNetworkOverlay";
import { LANGUAGES, REGIONS, networkProfile } from "@/lib/data";
import { healthUrl } from "@/lib/env";
import { latencyTier, tierClasses } from "@/lib/format";
import { formatNetworkChip } from "@/lib/network";

export default function Landing() {
  const router = useRouter();
  const [region] = useState("sao");
  const [src, setSrc] = useState("zul");
  const [dst, setDst] = useState("eng");
  const [ping, setPing] = useState<number | null>(null);
  const [netId, setNetId] = useState("off");
  const [showNet, setShowNet] = useState(false);

  // Measure the real round-trip to the in-region health endpoint.
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    fetch(healthUrl(), { cache: "no-store" })
      .then(() => alive && setPing(Math.round(performance.now() - t0)))
      .catch(() => alive && setPing(null));
    return () => {
      alive = false;
    };
  }, []);

  const swap = () => {
    setSrc(dst);
    setDst(src);
  };

  const start = () => router.push(`/call?src=${src}&dst=${dst}&region=${region}`);

  const tier = ping != null ? latencyTier(ping) : "good";
  const tc = tierClasses(tier);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-[18px] px-5 pb-8 pt-14">
      <header className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-[11px] w-[11px] rounded-full bg-mt-green" />
          <h1 className="text-[19px] font-bold">MotherTongue</h1>
        </div>
        <p className="text-sm leading-5 text-mt-secondary">
          Talk in your language — answered in real time, from a GPU next door.
        </p>
      </header>

      {/* Serving region */}
      <section className="rounded-2xl border border-mt-subtle bg-mt-surface p-4">
        <p className="text-[11px] font-semibold tracking-wide text-mt-muted">SERVING REGION</p>
        <div className="mt-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-mt-greenDim font-mono text-xs font-bold text-mt-green">
              SP
            </span>
            <div>
              <p className="text-lg font-semibold">São Paulo</p>
              <p className="text-xs text-mt-muted">Brazil · sa-east</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border border-mt-greenBrd bg-mt-greenDim px-3 py-1.5 ${tc.text}`}>
            <span className={`h-2 w-2 rounded-full ${tc.dot}`} />
            <span className="font-mono text-lg font-bold">{ping ?? "…"}</span>
            <span className="font-mono text-xs">ms</span>
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {REGIONS.map((r) => {
            const selected = r.code === region;
            return (
              <span
                key={r.code}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-medium ${
                  selected
                    ? "border-mt-greenBrd bg-mt-greenDim text-mt-green"
                    : "border-mt-subtle bg-mt-elevated text-mt-secondary"
                } ${!r.live && !selected ? "opacity-50" : ""}`}
                title={r.live ? undefined : "Coming in a later increment"}
              >
                <span className={`h-[7px] w-[7px] rounded-full ${selected ? "bg-mt-green" : "bg-mt-muted"}`} />
                {r.label}
              </span>
            );
          })}
        </div>
      </section>

      {/* Language pair */}
      <section className="flex flex-col gap-2.5 rounded-2xl border border-mt-subtle bg-mt-surface p-4">
        <LangField label="I SPEAK" value={src} onChange={setSrc} />
        <div className="flex items-center justify-center">
          <button
            onClick={swap}
            aria-label="Swap languages"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-mt-green text-mt-base transition-transform active:scale-95"
          >
            <SwapIcon />
          </button>
        </div>
        <LangField label="THEY SPEAK" value={dst} onChange={setDst} />
      </section>

      {/* Network chip — opens the simulated weak-network demo */}
      <button
        onClick={() => setShowNet(true)}
        className={`flex items-center justify-between rounded-xl border bg-mt-surface px-3.5 py-3 ${
          netId === "off" ? "border-mt-subtle" : "border-mt-amber"
        }`}
      >
        <span className={`text-[13px] font-medium ${netId === "off" ? "text-mt-secondary" : "text-mt-amber"}`}>
          {formatNetworkChip(networkProfile(netId))}
        </span>
        <span className="text-[11px] font-semibold text-mt-muted">{netId === "off" ? "Simulate" : "Change"}</span>
      </button>

      <button
        onClick={start}
        className="rounded-2xl bg-mt-green py-4 text-[17px] font-bold text-mt-base transition-transform active:scale-[0.99]"
      >
        Start call
      </button>

      <Link href="/about" className="text-center text-sm font-medium text-mt-secondary">
        How this works ›
      </Link>

      {showNet && (
        <WeakNetworkOverlay activeId={netId} onApply={setNetId} onClose={() => setShowNet(false)} />
      )}
    </main>
  );
}

function LangField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 rounded-xl border border-mt-subtle bg-mt-input px-3.5 py-3">
      <span className="text-[11px] font-semibold tracking-wide text-mt-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-base font-medium text-mt-primary outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-mt-surface">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SwapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 21V6m0 0L3.5 9.5M7 6l3.5 3.5M17 3v15m0 0 3.5-3.5M17 18l-3.5-3.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
