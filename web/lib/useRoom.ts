"use client";

// Two-way call state machine. Owns the /room WebSocket, the mic, and both sides of
// the conversation. Mirrors useCall but for a room: you speak your language, the
// other peer hears it in theirs (and vice-versa).

import { useCallback, useEffect, useRef, useState } from "react";

import { MicCapture, playWavBase64 } from "./audio";
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
    const ws = new WebSocket(roomWsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "join", room: code, lang: myLang }));
    ws.onerror = () => setStatus("error");
    ws.onmessage = (ev) => {
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
      } else if (msg.type === "peer") {
        setPeerPresent(msg.present);
        setPeerLang(msg.lang);
        setStatus(msg.present ? "active" : "waiting");
      } else if (msg.type === "sent") {
        const rtt = talkEndRef.current ? performance.now() - talkEndRef.current : msg.timings.total_ms;
        setLastRtt(rtt);
        setLastTimings(msg.timings);
        setTurns((prev) => [
          ...prev,
          { id: msg.id, mine: true, srcLang: myLang, dstLang: peerLang ?? "", srcText: msg.src_text, dstText: msg.dst_text, playing: false },
        ]);
      } else if (msg.type === "turn") {
        setLastTimings(msg.timings);
        const turn: RoomTurn = {
          id: msg.id, mine: false, srcLang: msg.src_lang, dstLang: msg.dst_lang,
          srcText: msg.src_text, dstText: msg.dst_text, playing: true,
        };
        setTurns((prev) => [...prev, turn]);
        void playWavBase64(msg.audio_b64, msg.audio_mime).then(() => {
          setTurns((prev) => prev.map((t) => (!t.mine && t.id === turn.id ? { ...t, playing: false } : t)));
        });
      } else if (msg.type === "error") {
        if (msg.code === "alone") {
          setNotice("No one else has joined yet.");
          setTimeout(() => setNotice(null), 2000);
        } else {
          setStatus("error");
        }
      }
    };
  }, [roomWsUrl, code, myLang, peerLang]);

  const startTalk = useCallback(async () => {
    if (status !== "active") return;
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
      setNotice("Microphone access is blocked.");
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

  const leave = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    send({ type: "leave" });
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      micRef.current?.stop();
      wsRef.current?.close();
    };
  }, []);

  return {
    status, engine, regionLabel, peerPresent, peerLang, turns,
    lastRtt, lastTimings, micLevel, speaking, notice,
    connect, startTalk, stopTalk, leave,
  };
}
