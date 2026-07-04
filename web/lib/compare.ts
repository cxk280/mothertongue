// Compare/Race math. Pure and unit-tested — the view only animates these numbers.
//
// The honest model: the pipeline compute is identical wherever it runs; only the
// network hop differs. So the in-region lane uses the REAL measured round-trip, and
// the (clearly simulated) us-east lane is the same compute plus a cross-ocean penalty.

/** Simulated us-east total = real pipeline compute + a cross-ocean network penalty. */
export function simulatedUsEastMs(computeMs: number, penaltyMs: number): number {
  return computeMs + penaltyMs;
}

/** How many times faster in-region is (us-east / in-region). */
export function verdictMultiplier(inRegionMs: number, usEastMs: number): number {
  if (inRegionMs <= 0) return 1;
  return usEastMs / inRegionMs;
}

/** "10×" above 10, one decimal below (e.g. "2.8×" reads as "2.8"). */
export function formatMultiplier(x: number): string {
  return x >= 10 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString();
}

export interface RaceDurations {
  inRegionVisualMs: number;
  usEastVisualMs: number;
  scale: number;
}

/**
 * Real latencies are too fast to watch (tens of ms), so scale both lanes by the
 * same factor onto a visible timeline. The ratio between them — the whole point —
 * is preserved, and the slower lane finishes exactly at visualMaxMs.
 */
export function raceDurations(inRegionMs: number, usEastMs: number, visualMaxMs: number): RaceDurations {
  const maxMs = Math.max(inRegionMs, usEastMs, 1);
  const scale = visualMaxMs / maxMs;
  return {
    inRegionVisualMs: inRegionMs * scale,
    usEastVisualMs: usEastMs * scale,
    scale,
  };
}
