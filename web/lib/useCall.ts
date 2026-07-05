"use client";

// The call state machine: owns the WebSocket, the mic, per-turn round-trip timing,
// and playback. Reconnects with exponential backoff if the socket drops mid-call
// (unless the user hung up). Components read the returned state; the Call screen drives it.

import { useCallback, useEffect, useRef, useState } from "react";

import { MicCapture, playWavBase64 } from "./audio";
import { MAX_RECONNECT_ATTEMPTS, backoffMs } from "./backoff";
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
  reconnecting: boolean;
  startedAt: number | null;
  connect: () => void;
  startTalk: () => Promise<void>;
  stopTalk: () => void;
  hangup: () => void;
  restart: () => void;
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
  const [reconnecting, setReconnecting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const talkEndRef = useRef<number>(0);
  const intentionalRef = useRef(false); // true = user closed; suppress reconnect
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const openSocketRef = useRef<() => void>(() => {});

  const send = (obj: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const openSocket = useCallback(() => {
    if (wsRef.current) return;
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "start", src, dst }));

    ws.onclose = () => {
      if (wsRef.current !== ws) return; // superseded by a newer socket; ignore
      wsRef.current = null;
      if (intentionalRef.current) return;
      if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(true);
        const delay = backoffMs(attemptRef.current);
        attemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => openSocketRef.current(), delay);
      } else {
        setReconnecting(false);
        setStatus("error");
        setError("Connection lost. Check your network and retry.");
      }
    };

    ws.onmessage = (ev) => {
      if (wsRef.current !== ws) return;
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
        attemptRef.current = 0;
        setReconnecting(false);
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
        // "too_long" is a soft notice (the mic was released for you), not fatal.
        if (msg.code === "too_long") {
          setError(msg.message);
        } else {
          setError(msg.message);
          setStatus("error");
        }
      }
    };
  }, [wsUrl, src, dst]);

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    intentionalRef.current = false;
    attemptRef.current = 0;
    clearReconnectTimer();
    setError(null);
    setReconnecting(false);
    setStartedAt(Date.now());
    openSocket();
  }, [openSocket]);

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
      setError("Microphone access is blocked. Enable it in your browser settings.");
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

  const teardown = () => {
    intentionalRef.current = true;
    clearReconnectTimer();
    micRef.current?.stop();
    micRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  };

  const hangup = useCallback(() => {
    send({ type: "stop" });
    teardown();
    setStatus("idle");
    setSpeaking(false);
    setReconnecting(false);
  }, []);

  // Tear down the current session and reconnect fresh — for "Start another call".
  const restart = useCallback(() => {
    teardown();
    setTurns([]);
    setLastRtt(null);
    setLastTimings(null);
    setError(null);
    setSpeaking(false);
    setMicLevel(0);
    setEngine(null);
    connect();
  }, [connect]);

  // Clean up the socket + mic if the component unmounts mid-call.
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      clearReconnectTimer();
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
    reconnecting,
    startedAt,
    connect,
    startTalk,
    stopTalk,
    hangup,
    restart,
  };
}
