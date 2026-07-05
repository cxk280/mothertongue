"use client";

// The WebRTC transport for the single-speaker call. Streams the mic as an Opus track
// over an RTCPeerConnection and carries the same control/turn contract as useCall over
// an RTCDataChannel — so it returns the identical `CallState` and the Call screen is
// unchanged. Opt-in (NEXT_PUBLIC_WEBRTC=1); the WebSocket useCall is the default.
//
// NOTE: RTCPeerConnection + getUserMedia are browser-only, so this hook is verified at
// compile time (tsc/eslint/build) and by the server-side aiortc loopback test — not by a
// headless runtime here. It has no auto-reconnect yet (a drop surfaces an error to retry);
// the WS transport keeps its backoff. See docs for what remains.

import { useCallback, useEffect, useRef, useState } from "react";

import { playWavBase64, rms } from "./audio";
import { postOffer } from "./transport";
import type { CallState, CallStatus, UiTurn } from "./useCall";
import type { ServerMessage, Timings } from "./types";

export function useWebrtcCall(signalUrl: string, src: string, dst: string): CallState {
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
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const talkEndRef = useRef<number>(0);
  const closedRef = useRef(false);

  const flashNotice = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current != null) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2500);
  };

  const sendControl = (obj: unknown) => {
    const ch = channelRef.current;
    if (ch && ch.readyState === "open") ch.send(JSON.stringify(obj));
  };

  const onMessage = useCallback((msg: ServerMessage) => {
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
      // "too_long" is a soft notice (the server disarmed capture), not fatal.
      if (msg.code === "too_long") {
        setSpeaking(false);
        stopMeter();
        flashNotice(msg.message);
      } else {
        setError(msg.message);
        setStatus("error");
      }
    }
  }, []);

  const stopMeter = () => {
    const m = meterRef.current;
    if (m) {
      cancelAnimationFrame(m.raf);
      void m.ctx.close();
      meterRef.current = null;
    }
    setMicLevel(0);
  };

  const teardown = useCallback(() => {
    closedRef.current = true;
    if (noticeTimerRef.current != null) clearTimeout(noticeTimerRef.current);
    stopMeter();
    channelRef.current?.close();
    channelRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    if (pcRef.current) return;
    closedRef.current = false;
    setError(null);
    setStatus("connecting");
    setStartedAt(Date.now());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (closedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("control");
      channelRef.current = channel;
      channel.onopen = () => sendControl({ type: "start", src, dst });
      channel.onmessage = (ev) => {
        try {
          onMessage(JSON.parse(ev.data as string) as ServerMessage);
        } catch {
          /* ignore malformed frame */
        }
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState) && !closedRef.current) {
          setStatus("error");
          setError("Connection lost. Check your network and retry.");
        }
      };

      await pc.setLocalDescription(await pc.createOffer());
      const answer = await postOffer(signalUrl, {
        sdp: pc.localDescription!.sdp,
        type: pc.localDescription!.type,
      });
      if (closedRef.current) return;
      await pc.setRemoteDescription(answer as RTCSessionDescriptionInit);
    } catch {
      setStatus("error");
      setError("Could not start the WebRTC call. Check your mic and network.");
    }
  }, [signalUrl, src, dst, onMessage]);

  const startTalk = useCallback(async () => {
    if (status !== "ready" || speaking) return;
    sendControl({ type: "start_utterance" });
    setSpeaking(true);

    // VU meter off the live stream (the audio itself streams over the peer connection).
    const stream = streamRef.current;
    if (stream && !meterRef.current) {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        setMicLevel(rms(buf));
        meterRef.current!.raf = requestAnimationFrame(tick);
      };
      meterRef.current = { ctx, raf: requestAnimationFrame(tick) };
    }
  }, [status, speaking]);

  const stopTalk = useCallback(() => {
    if (!speaking) return;
    talkEndRef.current = performance.now();
    sendControl({ type: "end_utterance" });
    setSpeaking(false);
    stopMeter();
  }, [speaking]);

  const hangup = useCallback(() => {
    sendControl({ type: "stop" });
    teardown();
    setStatus("idle");
    setSpeaking(false);
  }, [teardown]);

  // The no-mic "sample call" auto-play is a WebSocket-fallback demo (it scripts from
  // silence). WebRTC carries a real mic track, so there's nothing to synthesize here —
  // this satisfies the CallState contract as an explicit no-op.
  const sampleUtterance = useCallback(() => {}, []);

  const restart = useCallback(() => {
    teardown();
    setTurns([]);
    setLastRtt(null);
    setLastTimings(null);
    setError(null);
    setSpeaking(false);
    setEngine(null);
    void connect();
  }, [teardown, connect]);

  useEffect(() => {
    return () => teardown();
  }, [teardown]);

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
    reconnecting: false,
    startedAt,
    connect: () => void connect(),
    startTalk,
    stopTalk,
    sampleUtterance,
    hangup,
    restart,
  };
}
