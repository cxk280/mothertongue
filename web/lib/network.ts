// Landing network chip. The chip shows REAL live connection data (Network Information
// API) when not simulating, and an explicit "Simulated: …" readout when a presenter has
// picked a weak-network profile. Pure formatters are unit-tested; the reader is a thin
// browser shim.

import type { NetworkProfile } from "./data";

export interface LiveNetwork {
  supported: boolean;
  effectiveType?: string; // "4g" | "3g" | "2g" | "slow-2g"
  downlinkMbps?: number;
  rttMs?: number;
}

interface NetworkInformationLike {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}

function connection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/** Read the browser's real connection. Not exposed by every browser (e.g. Safari). */
export function readConnection(): LiveNetwork {
  const c = connection();
  if (!c) return { supported: false };
  return { supported: true, effectiveType: c.effectiveType, downlinkMbps: c.downlink, rttMs: c.rtt };
}

/** Subscribe to live connection changes; returns an unsubscribe. No-op where unsupported. */
export function onConnectionChange(cb: () => void): () => void {
  const c = connection();
  if (!c?.addEventListener) return () => {};
  c.addEventListener("change", cb);
  return () => c.removeEventListener?.("change", cb);
}

/** Live-network chip label. Honest when the API is unavailable — never invents numbers. */
export function formatLiveNetwork(net: LiveNetwork): string {
  if (!net.supported) return "Live network";
  const parts: string[] = [];
  if (net.effectiveType) parts.push(net.effectiveType.toUpperCase());
  if (typeof net.downlinkMbps === "number") parts.push(`${net.downlinkMbps} Mbps`);
  if (typeof net.rttMs === "number") parts.push(`${net.rttMs} ms`);
  return parts.length ? `Live: ${parts.join(" · ")}` : "Live network";
}

/** Simulated-profile chip readout (presenter demo — explicitly labelled as simulated). */
export function formatNetworkChip(p: NetworkProfile): string {
  return `Simulated: ${p.label} · ${p.bitrateKbps} kbps · ${p.lossPct}% loss`;
}
