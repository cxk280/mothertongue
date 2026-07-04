// Pure helpers for the latency HUD. Kept dependency-free and unit-tested.

export type LatencyTier = "good" | "ok" | "bad";

// The whole story is that in-region is conversational. Thresholds (ms round-trip):
//  < 80  -> green "conversational"; < 180 -> amber; else red.
export function latencyTier(ms: number): LatencyTier {
  if (ms < 80) return "good";
  if (ms < 180) return "ok";
  return "bad";
}

// Round-trip ms are shown as whole numbers; sub-stage ms keep one decimal.
export function formatMs(ms: number): string {
  return Math.round(ms).toString();
}

export function formatStageMs(ms: number): string {
  return ms >= 100 ? Math.round(ms).toString() : ms.toFixed(0);
}

export function tierClasses(tier: LatencyTier): { text: string; dot: string } {
  switch (tier) {
    case "good":
      return { text: "text-mt-green", dot: "bg-mt-green" };
    case "ok":
      return { text: "text-mt-amber", dot: "bg-mt-amber" };
    case "bad":
      return { text: "text-mt-red", dot: "bg-mt-red" };
  }
}
