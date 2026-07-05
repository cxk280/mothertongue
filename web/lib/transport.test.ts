import { describe, expect, it, vi } from "vitest";

import { offerUrl } from "./env";
import { postOffer } from "./transport";

describe("offerUrl", () => {
  it("derives the http signaling endpoint from the ws url", () => {
    expect(offerUrl("ws://localhost:8000/ws")).toBe("http://localhost:8000/webrtc/offer");
    expect(offerUrl("wss://mt.example.com/ws")).toBe("https://mt.example.com/webrtc/offer");
  });
});

describe("postOffer", () => {
  it("posts the offer and returns the parsed answer", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sdp: "answer-sdp", type: "answer" }),
    })) as unknown as typeof fetch;

    const answer = await postOffer("http://x/webrtc/offer", { sdp: "o", type: "offer" }, fetchImpl);

    expect(answer).toEqual({ sdp: "answer-sdp", type: "answer" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("http://x/webrtc/offer");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ sdp: "o", type: "offer" });
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    await expect(postOffer("http://x", { sdp: "o", type: "offer" }, fetchImpl)).rejects.toThrow(/503/);
  });
});
