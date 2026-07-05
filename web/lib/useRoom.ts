"use client";

// Two-way call state machine. Owns the /room WebSocket, the mic, and both sides of
// the conversation. Mirrors useCall — including reconnect-with-backoff on an
// unexpected drop (it re-sends `join`, so the room is rejoined automatically).

import { useCallback, useEffect, useRef, useState } from "react";

import { MicCapture, playWavBase64 } from "./audio";
import { MAX_RECONNECT_ATTEMPTS, backoffMs } from "./backoff";
import type { RoomServerMessage, Timings } from "./types";

const SAMPLE_RATE = 16000;

export type RoomStatus = "connecting" | "waiting" | "active" | "error";

export interface RoomTurn {
  id: number;
  mine: boolean; // true = my outgoing utterance (echo), false = incoming from peer
  srcLang: string;
  dstLang: string;
  srcText: string;
  dstText: string;
  playing: boolean;
}

export interface RoomState {
  status: RoomStatus;
  engine: "real" | "fallback" | null;
  regionLabel: string;
  peerPresent: boolean;
  peerLang: string | null;
  turns: RoomTurn[];
  lastRtt: number | null;
  lastTimings: Timings | null;
  micLevel: number;
  speaking: boolean;
  notice: string | null;
  reconnecting: boolean;
  connect: () => void;
  startTalk: () => Promise<void>;
  stopTalk: () => void;
  leave: () => void;
}

export function useRoom(roomWsUrl: string, code: string, myLang: string): RoomState {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [engine, setEngine] = useState<"real" | "fallback" | null>(null);
  const [regionLabel, setRegionLabel] = useState("");
  const [peerPresent, setPeerPresent] = useState(false);
  const [peerLang, setPeerLang] = useState<string | null>(null);
  const [turns, setTurns] = useState<RoomTurn[]>([]);
  const [lastRtt, setLastRtt] = useState<number | null>(null);
  const [lastTimings, setLastTimings] = useState<Timings | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const talkIntentRef = useRef(false); // true between press and release; guards the async mic start
  const noticeTimerRef = useRef<number | null>(null);
  const talkEndRef = useRef<number>(0);
  const peerLangRef = useRef<string | null>(null);
  const intentionalRef = useRef(false);
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

  // Stop capturing and forget any in-progress press — used on socket drop / forced end.
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
    setStatus((s) => (s === "active" ? s : "connecting"));
    const ws = new WebSocket(roomWsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", room: code, lang: myLang }));

    ws.onclose = () => {
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      if (intentionalRef.current) return;
      // Dropped mid-call: stop the mic so it can't stream into the reconnected socket.
      // The `reconnecting` flag disables push-to-talk until we rejoin.
      releaseMic();
      if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        setReconnecting(true);
        const delay = backoffMs(attemptRef.current);
        attemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => openSocketRef.current(), delay);
      } else {
        setReconnecting(false);
        setStatus("error");
      }
    };

    ws.onmessage = (ev) => {
      if (wsRef.current !== ws) return;
      let msg: RoomServerMessage;
      try {
        msg = JSON.parse(ev.data as string) as RoomServerMessage;
      } catch {
        return;
      }
      if (msg.type === "joined") {
        setEngine(msg.engine);
        setRegionLabel(msg.region_label);
        setStatus((s) => (s === "active" ? s : "waiting"));
        attemptRef.current = 0;
        setReconnecting(false);
      } else if (msg.type === "peer") {
        setPeerPresent(msg.present);
        setPeerLang(msg.lang);
        peerLangRef.current = msg.lang;
        setStatus(msg.present ? "active" : "waiting");
      } else if (msg.type === "sent") {
        const rtt = talkEndRef.current ? performance.now() - talkEndRef.current : msg.timings.total_ms;
        setLastRtt(rtt);
        setLastTimings(msg.timings);
        setTurns((prev) => [
          ...prev,
          {
            id: msg.id,
            mine: true,
            srcLang: myLang,
            dstLang: peerLangRef.current ?? "",
            srcText: msg.src_text,
            dstText: msg.dst_text,
            playing: false,
          },
        ]);
      } else if (msg.type === "turn") {
        setLastTimings(msg.timings);
        const turn: RoomTurn = {
          id: msg.id,
          mine: false,
          srcLang: msg.src_lang,
          dstLang: msg.dst_lang,
          srcText: msg.src_text,
          dstText: msg.dst_text,
          playing: true,
        };
        setTurns((prev) => [...prev, turn]);
        void playWavBase64(msg.audio_b64, msg.audio_mime).then(() => {
          setTurns((prev) => prev.map((t) => (!t.mine && t.id === turn.id ? { ...t, playing: false } : t)));
        });
      } else if (msg.type === "error") {
        if (msg.code === "alone" || msg.code === "too_long") {
          if (msg.code === "too_long") releaseMic(); // the server dropped the buffer
          flashNotice(msg.code === "alone" ? "No one else has joined yet." : "That was too long — mic released.");
        } else {
          setStatus("error");
        }
      }
    };
  }, [roomWsUrl, code, myLang]);

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    intentionalRef.current = false;
    attemptRef.current = 0;
    clearReconnectTimer();
    setReconnecting(false);
    openSocket();
  }, [openSocket]);

  const startTalk = useCallback(async () => {
    if (status !== "active" || reconnecting) return;
    if (micRef.current || talkIntentRef.current) return; // already talking/starting
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
      // Released (quick tap / during the permission prompt) before the mic came up.
      if (!talkIntentRef.current) {
        mic.stop();
        return;
      }
      micRef.current = mic;
      setSpeaking(true);
    } catch {
      talkIntentRef.current = false;
      flashNotice("Microphone access is blocked.");
    }
  }, [status, reconnecting]);

  const stopTalk = useCallback(() => {
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

  const leave = useCallback(() => {
    intentionalRef.current = true;
    talkIntentRef.current = false;
    clearReconnectTimer();
    micRef.current?.stop();
    micRef.current = null;
    send({ type: "leave" });
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  // Null the refs on unmount too, so a StrictMode remount opens a fresh socket.
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      talkIntentRef.current = false;
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
    peerPresent,
    peerLang,
    turns,
    lastRtt,
    lastTimings,
    micLevel,
    speaking,
    notice,
    reconnecting,
    connect,
    startTalk,
    stopTalk,
    leave,
  };
}
