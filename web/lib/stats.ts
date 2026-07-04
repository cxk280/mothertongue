// Session-summary math. Pure and unit-tested — the summary view only renders these.

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile (p in 0..100). p95 of small samples reads intuitively. */
export function percentileNearestRank(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  return s[Math.min(rank, s.length) - 1];
}

/** Simulated us-east median = median real compute + the same cross-ocean penalty as Compare. */
export function simulatedUsEastMedian(computeMs: number[], penaltyMs: number): number {
  return median(computeMs) + penaltyMs;
}

/** Whole-second m:ss, for the call duration. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
