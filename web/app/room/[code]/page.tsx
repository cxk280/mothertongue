"use client";

// Two-way call room. The creator arrives with ?lang=…; someone opening the shared
// link picks their own language first (JoinGate), then both talk, each in their own
// language, hearing the other translated in real time.

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { LatencyHud } from "@/components/LatencyHud";
import { Waveform } from "@/components/Waveform";
import { LANGUAGES, languageLabel, regionByCode } from "@/lib/data";
import { roomUrl } from "@/lib/env";
import { normalizeRoomCode } from "@/lib/room";
import { useRoom } from "@/lib/useRoom";

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-mt-base" />}>
      <RoomInner />
    </Suspense>
  );
}

function RoomInner() {
  const params = useParams();
  const search = useSearchParams();
  const code = normalizeRoomCode(String(params.code ?? ""));
  const [lang, setLang] = useState<string | null>(search.get("lang"));

  if (!code) return <Centered>Invalid room code.</Centered>;
  if (!lang) return <JoinGate code={code} onJoin={setLang} />;
  return <RoomCall code={code} lang={lang} />;
}

function JoinGate({ code, onJoin }: { code: string; onJoin: (lang: string) => void }) {
  const [lang, setLang] = useState("eng");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-5 px-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-mt-muted">JOINING ROOM</span>
        <span className="font-mono text-2xl font-bold tracking-widest text-mt-green">{code}</span>
      </div>
      <label className="flex flex-col gap-1.5 rounded-xl border border-mt-subtle bg-mt-input px-3.5 py-3">
        <span className="text-[11px] font-semibold tracking-wide text-mt-muted">I SPEAK</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="w-full appearance-none bg-transparent text-base font-medium text-mt-primary outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code} className="bg-mt-surface">
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button
        onClick={() => onJoin(lang)}
        className="rounded-2xl bg-mt-green py-4 text-[17px] font-bold text-mt-base transition-transform active:scale-[0.99]"
      >
        Join call
      </button>
    </main>
  );
}

function RoomCall({ code, lang }: { code: string; lang: string }) {
  const router = useRouter();
  const room = useRoom(roomUrl(), code, lang);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => room.connect(), []);

  const regionLabel = room.regionLabel || regionByCode("sao").label;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${code}` : "";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const leave = () => {
    room.leave();
    router.push("/");
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-mt-base">
      <LatencyHud
        regionLabel={regionLabel}
        engine={room.engine}
        status={room.status === "active" ? "ready" : "connecting"}
        rttMs={room.lastRtt}
        timings={room.lastTimings}
      />

      {room.reconnecting && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-mt-amber/15 py-2 text-[13px] font-medium text-mt-amber"
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-mt-amber/40 border-t-mt-amber" />
          Reconnecting to {regionLabel}…
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {room.status !== "active" ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span className="font-mono text-3xl font-bold tracking-widest text-mt-green">{code}</span>
            <p className="text-lg font-bold text-mt-primary">Waiting for someone to join…</p>
            <p className="text-[13px] text-mt-secondary">
              Share this link — they’ll pick their own language and you’ll each hear the other
              translated in real time.
            </p>
            <button
              onClick={copy}
              className="mt-1 w-full truncate rounded-xl border border-mt-strong px-4 py-3 text-[13px] font-medium text-mt-secondary"
            >
              {copied ? "Link copied ✓" : shareUrl || `…/room/${code}`}
            </button>
          </div>
        ) : (
          <RoomTranscript turns={room.turns} peerLang={room.peerLang} myLang={lang} />
        )}
      </div>

      {room.notice && (
        <div className="border-y border-mt-subtle bg-mt-surface py-2 text-center text-[13px] text-mt-amber">
          {room.notice}
        </div>
      )}
      {room.speaking && (
        <div className="flex items-center justify-center gap-2.5 border-y border-mt-subtle bg-mt-surface py-2.5">
          <Waveform active level={room.micLevel} bars={10} />
          <span className="text-[13px] font-medium text-mt-secondary">You’re speaking…</span>
        </div>
      )}

      <div className="flex items-center justify-center gap-7 border-t border-mt-subtle bg-mt-surface px-5 pb-8 pt-4">
        <button
          onPointerDown={() => room.startTalk()}
          onPointerUp={() => room.speaking && room.stopTalk()}
          onPointerLeave={() => room.speaking && room.stopTalk()}
          onPointerCancel={() => room.speaking && room.stopTalk()}
          onContextMenu={(e) => e.preventDefault()}
          disabled={room.status !== "active"}
          aria-label="Hold to talk"
          className={`flex h-[74px] w-[74px] touch-none select-none items-center justify-center rounded-full text-mt-base transition-transform active:scale-95 ${
            room.speaking ? "scale-105 bg-mt-greenDeep" : "bg-mt-green"
          } ${room.status !== "active" ? "opacity-40" : ""}`}
        >
          <MicIcon />
        </button>
        <button
          onClick={leave}
          aria-label="Leave call"
          className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-mt-red text-white"
        >
          <EndIcon />
        </button>
      </div>
    </main>
  );
}

function RoomTranscript({ turns, peerLang, myLang }: { turns: ReturnType<typeof useRoom>["turns"]; peerLang: string | null; myLang: string }) {
  if (turns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <p className="text-lg font-bold text-mt-primary">Say hello</p>
        <p className="text-[13px] text-mt-secondary">
          You speak {shortLang(myLang)}; they hear {peerLang ? shortLang(peerLang) : "their language"}.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      {turns.map((t, i) => (
        <div key={`${t.mine ? "m" : "p"}-${t.id}-${i}`} className={`flex flex-col ${t.mine ? "items-end" : "items-start"}`}>
          <div
            className={`flex max-w-[85%] flex-col gap-0.5 rounded-2xl border p-3 ${
              t.mine ? "border-mt-greenBrd bg-mt-greenDim" : "border-mt-subtle bg-mt-elevated"
            }`}
          >
            <span className={`text-[11px] font-semibold uppercase ${t.mine ? "text-mt-green" : "text-mt-secondary"}`}>
              {t.mine ? "You" : "Them"} · {shortLang(t.srcLang)} → {shortLang(t.dstLang)}
            </span>
            <span className="text-[13px] text-mt-secondary">{t.srcText}</span>
            <span className="text-[15px] font-medium text-mt-primary">{t.dstText}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const shortLang = (code: string) => (code ? languageLabel(code).replace(/\s*\(.*\)/, "") : "");

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-mt-base px-6 text-center text-mt-secondary">
      {children}
    </main>
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
