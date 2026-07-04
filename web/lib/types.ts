// The WebSocket wire contract — mirror of server/app/messages.py.
// Keep these in lockstep (see docs/PROTOCOL.md).

export interface ClientStart {
  type: "start";
  src: string;
  dst: string;
}
export interface ClientEndUtterance {
  type: "end_utterance";
}
export interface ClientStop {
  type: "stop";
}
export type ClientMessage = ClientStart | ClientEndUtterance | ClientStop;

export interface Timings {
  stt_ms: number;
  mt_ms: number;
  tts_ms: number;
  total_ms: number;
}

export interface ServerReady {
  type: "ready";
  region_label: string;
  region_code: string;
  engine: "real" | "fallback";
  src: string;
  dst: string;
}
export interface ServerTurn {
  type: "turn";
  id: number;
  src_lang: string;
  dst_lang: string;
  src_text: string;
  dst_text: string;
  timings: Timings;
  audio_b64: string;
  audio_mime: string;
}
export interface ServerError {
  type: "error";
  code: string;
  message: string;
}
export type ServerMessage = ServerReady | ServerTurn | ServerError;

// ---- two-way room protocol (mirror of the /room endpoint) ----

export interface ClientJoin {
  type: "join";
  room: string;
  lang: string;
}
export interface ServerJoined {
  type: "joined";
  room: string;
  self_lang: string;
  region_label: string;
  region_code: string;
  engine: "real" | "fallback";
}
export interface ServerPeer {
  type: "peer";
  present: boolean;
  lang: string | null;
}
export interface ServerSent {
  type: "sent";
  id: number;
  src_text: string;
  dst_text: string;
  timings: Timings;
}
export type RoomServerMessage = ServerJoined | ServerPeer | ServerSent | ServerTurn | ServerError;
