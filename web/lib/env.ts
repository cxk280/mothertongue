// Client-visible config. NEXT_PUBLIC_WS_URL points the browser at the in-region
// inference server; default is the local dev server.

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

function num(v: string | undefined, dflt: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
}

// Simulated cross-ocean round-trip penalty for the Compare/Race view's us-east lane.
// There is no real US-East endpoint — this is an explicit, honest stand-in.
export const SIM_USEAST_MS = num(process.env.NEXT_PUBLIC_SIM_USEAST_MS, 280);

/** Derive the HTTP health endpoint from the WS URL (ws->http, wss->https). */
export function healthUrl(ws: string = WS_URL): string {
  return ws.replace(/^ws/, "http").replace(/\/ws$/, "/healthz");
}
