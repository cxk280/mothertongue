// About / How It Works — a static informational view (no state, no server calls).
// Server-rendered and prerendered. Grounded on the Landing page's section patterns
// and the mt-* token system.

import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "How MotherTongue works",
};

interface Stage {
  title: string;
  sub: string;
  icon: ReactNode;
}

const STAGES: Stage[] = [
  { title: "Microphone", sub: "Captures your voice", icon: <MicIcon /> },
  { title: "Streaming STT", sub: "Speech → text, live", icon: <EqIcon /> },
  { title: "Machine translation", sub: "Language → language", icon: <TranslateIcon /> },
  { title: "Voice synthesis", sub: "Text → natural speech", icon: <SpeakerIcon /> },
  { title: "Their device", sub: "Heard in real time", icon: <DeviceIcon /> },
];

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col gap-5 px-5 pb-8 pt-12">
      <header className="flex items-center gap-2.5">
        <Link href="/" aria-label="Back to home" className="text-mt-secondary">
          <ChevronLeft />
        </Link>
        <h1 className="text-[18px] font-bold">How MotherTongue works</h1>
      </header>

      <p className="text-sm leading-[21px] text-mt-secondary">
        Speech in, speech out — in your own language. The whole pipeline runs on a GPU physically in
        your region, so the round-trip is 2–40 ms instead of the 300 ms+ you get when audio has to
        cross an ocean and back.
      </p>

      {/* Pipeline — all in-region */}
      <section className="rounded-[18px] border border-mt-greenBrd bg-mt-surface p-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-mt-green" />
          <span className="text-[11px] font-bold tracking-wide text-mt-green">ALL IN ONE REGION</span>
        </div>
        <p className="mt-1 text-xs text-mt-muted">São Paulo GPU · no US / EU hop</p>

        <div className="mt-3 flex flex-col">
          {STAGES.map((s, i) => (
            <div key={s.title}>
              <div className="flex items-center gap-3 py-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-mt-greenDim text-mt-green">
                  {s.icon}
                </span>
                <div className="leading-tight">
                  <p className="text-[15px] font-semibold">{s.title}</p>
                  <p className="text-xs text-mt-muted">{s.sub}</p>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="pl-[13px] text-mt-greenBrd">
                  <ArrowDown />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Why Vultr */}
      <section className="rounded-2xl border border-mt-greenBrd bg-mt-greenDim p-4">
        <p className="text-[11px] font-bold tracking-wide text-mt-green">WHY VULTR</p>
        <p className="mt-2 text-sm leading-[21px] text-mt-primary">
          Every stage runs on a Vultr GPU sitting in the region where your users are. Hyperscalers
          have almost no GPU presence here — their only option is a 300 ms+ hop to another continent.
          The advantage is pure geography.
        </p>
      </section>

      <Link
        href="/"
        className="rounded-2xl bg-mt-green py-4 text-center text-base font-bold text-mt-base transition-transform active:scale-[0.99]"
      >
        Start a call
      </Link>
    </main>
  );
}

function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowDown() {
  return (
    <svg width="14" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v16m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function EqIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 12h1.5M8 7v10M12 4v16M16 8v8M19.5 11v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function TranslateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 5h7M7.5 5c0 4-2 6.5-4.5 8M6 9c0 2 2 4 5 5M13.5 20l3.5-8 3.5 8M15 17h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 9v6h3l5 4V5L7 9H4Z" fill="currentColor" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="7" y="2" width="10" height="20" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
