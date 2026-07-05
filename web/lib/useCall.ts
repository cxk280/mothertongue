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
  notice: string | null;
  reconnecting: boolean;
  startedAt: number | null;
  connect: () => void;
  startTalk: () => Promise<void>;
  stopTalk: () => void;
  sampleUtterance: () => void;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const talkIntentRef = useRef(false); // true between press and release; guards the async mic start
  const noticeTimerRef = useRef<number | null>(null);
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

  // Stop capturing and forget any in-progress press. Used when the socket drops or the
  // server force-ends an utterance, so the mic never keeps streaming into a dead session.
  const releaseMic = () => {
    talkIntentRef.current = false;
    micRef.current?.stop();
    micRef.current = null;
    setSpeaking(false);
    setMicLevel(0);
  };

  const flashNotice = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current != null) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2500);
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
      // Dropped mid-call: stop the mic so it can't stream into the reconnected socket
      // with no matching start. The `reconnecting` flag disables push-to-talk meanwhile.
      releaseMic();
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
        // "too_long" is a soft notice, not fatal: actually release the mic (the server
        // dropped the buffer) and surface it as a transient banner, not the error overlay.
        if (msg.code === "too_long") {
          releaseMic();
          flashNotice(msg.message);
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
    if (status !== "ready" || reconnecting) return;
    // Guard re-entrancy: a mic start already in flight (intent set) or a live capture
    // must not spawn a second MicCapture that would leak the first.
    if (micRef.current || talkIntentRef.current) return;
    talkIntentRef.current = true;
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
      // The user may have released (quick tap, or during the permission prompt) while
      // getUserMedia was still resolving — if so, don't leave the mic capturing.
      if (!talkIntentRef.current) {
        mic.stop();
        return;
      }
      micRef.current = mic;
      setSpeaking(true);
    } catch {
      talkIntentRef.current = false;
      setError("Microphone access is blocked. Enable it in your browser settings.");
    }
  }, [status, reconnecting]);

  const stopTalk = useCallback(() => {
    // Idempotent: safe to call even if the press never became a live mic (see startTalk).
    const wasCapturing = micRef.current != null;
    talkIntentRef.current = false;
    micRef.current?.stop();
    micRef.current = null;
    setSpeaking(false);
    setMicLevel(0);
    if (wasCapturing) {
      talkEndRef.current = performance.now();
      send({ type: "end_utterance" });
    }
  }, []);

  const teardown = () => {
    intentionalRef.current = true;
    talkIntentRef.current = false;
    clearReconnectTimer();
    micRef.current?.stop();
    micRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  };

  // Drive one utterance without the mic — for the no-mic "sample call". The audio
  // is silence; the fallback engine scripts the conversation from it. (On the real
  // engine this would transcribe silence, so callers gate this to the fallback.)
  const sampleUtterance = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(new Int16Array(4000).buffer); // ~0.25s of silence
    talkEndRef.current = performance.now();
    ws.send(JSON.stringify({ type: "end_utterance" }));
  }, []);

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

  // Clean up the socket + mic if the component unmounts mid-call. Null the refs too, so
  // a StrictMode mount→unmount→remount can open a fresh socket instead of short-circuiting.
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      clearReconnectTimer();
      if (noticeTimerRef.current != null) clearTimeout(noticeTimerRef.current);
      micRef.current?.stop();
      micRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
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
    notice,
    reconnecting,
    startedAt,
    connect,
    startTalk,
    stopTalk,
    sampleUtterance,
    hangup,
    restart,
  };
}
