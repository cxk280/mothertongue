"use client";

// The call state machine: owns the WebSocket, the mic, per-turn round-trip timing,
// and playback. Components read the returned state; the Call screen drives it.

import { useCallback, useEffect, useRef, useState } from "react";

import { MicCapture, playWavBase64 } from "./audio";
import type { ServerMessage, Timings } from "./types";

const SAMPLE_RATE = 16000;

export type CallStatus = "idle" | "connecting" | "ready" | "error";

export interface UiTurn {
  id: number;
  srcLang: string;
  dstLang: string;
  srcText: string;
  dstText: string;
  timings: Timings;
  rttMs: number;
  playing: boolean;
}

export interface CallState {
  status: CallStatus;
  engine: "real" | "fallback" | null;
  regionLabel: string;
  turns: UiTurn[];
  lastRtt: number | null;
  lastTimings: Timings | null;
  micLevel: number;
  speaking: boolean;
  error: string | null;
  connect: () => void;
  startTalk: () => Promise<void>;
  stopTalk: () => void;
  hangup: () => void;
}

export function useCall(wsUrl: string, src: string, dst: string): CallState {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [engine, setEngine] = useState<"real" | "fallback" | null>(null);
  const [regionLabel, setRegionLabel] = useState("");
  const [turns, setTurns] = useState<UiTurn[]>([]);
  const [lastRtt, setLastRtt] = useState<number | null>(null);
  const [lastTimings, setLastTimings] = useState<Timings | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const talkEndRef = useRef<number>(0);

  const send = (obj: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  const connect = useCallback(() => {
    if (wsRef.current) return;
    setStatus("connecting");
    setError(null);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "start", src, dst }));
    ws.onerror = () => {
      setStatus("error");
      setError("Couldn’t reach the in-region endpoint.");
    };
    ws.onclose = () => {
      if (status !== "idle") setStatus((s) => (s === "error" ? s : "idle"));
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as ServerMessage;
      } catch {
        return;
      }
      if (msg.type === "ready") {
        setEngine(msg.engine);
        setRegionLabel(msg.region_label);
        setStatus("ready");
      } else if (msg.type === "turn") {
        const rtt = talkEndRef.current ? performance.now() - talkEndRef.current : msg.timings.total_ms;
        setLastRtt(rtt);
        setLastTimings(msg.timings);
        const turn: UiTurn = {
          id: msg.id,
          srcLang: msg.src_lang,
          dstLang: msg.dst_lang,
          srcText: msg.src_text,
          dstText: msg.dst_text,
          timings: msg.timings,
          rttMs: rtt,
          playing: true,
        };
        setTurns((prev) => [...prev, turn]);
        void playWavBase64(msg.audio_b64, msg.audio_mime).then(() => {
          setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, playing: false } : t)));
        });
      } else if (msg.type === "error") {
        setError(msg.message);
        setStatus("error");
      }
    };
  }, [wsUrl, src, dst, status]);

  const startTalk = useCallback(async () => {
    if (status !== "ready") return;
    try {
      const mic = new MicCapture(
        SAMPLE_RATE,
        (pcm) => {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(pcm);
        },
        (level) => setMicLevel(level),
      );
      await mic.start();
      micRef.current = mic;
      setSpeaking(true);
    } catch {
      setError("Microphone access is blocked.");
    }
  }, [status]);

  const stopTalk = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    setSpeaking(false);
    setMicLevel(0);
    talkEndRef.current = performance.now();
    send({ type: "end_utterance" });
  }, []);

  const hangup = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    send({ type: "stop" });
    wsRef.current?.close();
    wsRef.current = null;
    setStatus("idle");
    setSpeaking(false);
  }, []);

  // Clean up the socket + mic if the component unmounts mid-call.
  useEffect(() => {
    return () => {
      micRef.current?.stop();
      wsRef.current?.close();
    };
  }, []);

  return {
    status,
    engine,
    regionLabel,
    turns,
    lastRtt,
    lastTimings,
    micLevel,
    speaking,
    error,
    connect,
    startTalk,
    stopTalk,
    hangup,
  };
}
