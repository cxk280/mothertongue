// Transport abstraction for the single-speaker call.
//
// The Call screen depends only on the `CallState` shape (see useCall) — it never
// touches a socket or a peer connection directly. That makes `CallState` the transport
// interface: there are two implementations selected by the NEXT_PUBLIC_WEBRTC flag —
//   • useCall (WebSocket, default) — raw PCM16 uplink over `/ws`
//   • useWebrtcCall (WebRTC)       — Opus uplink over an aiortc peer connection
// Both speak the identical server wire contract (ServerReady/ServerTurn), so the UI,
// the latency HUD, and playback are unchanged regardless of transport.

/** Answer returned by the server's /webrtc/offer signaling endpoint. */
export interface SdpAnswer {
  sdp: string;
  type: string;
}

/**
 * POST an SDP offer to the signaling endpoint and return the server's answer.
 * Kept out of the browser-only RTCPeerConnection code so it can be unit-tested.
 */
export async function postOffer(
  url: string,
  offer: { sdp: string; type: string },
  fetchImpl: typeof fetch = fetch,
): Promise<SdpAnswer> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
  });
  if (!res.ok) {
    throw new Error(`signaling failed: ${res.status}`);
  }
  return (await res.json()) as SdpAnswer;
}
