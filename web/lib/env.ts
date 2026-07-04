// Client-visible config. NEXT_PUBLIC_WS_URL points the browser at the in-region
// inference server; default is the local dev server.

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws";

/** Derive the HTTP health endpoint from the WS URL (ws->http, wss->https). */
export function healthUrl(ws: string = WS_URL): string {
  return ws.replace(/^ws/, "http").replace(/\/ws$/, "/healthz");
}
