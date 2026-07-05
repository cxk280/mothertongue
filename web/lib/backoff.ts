// Exponential reconnect backoff. Pure + unit-tested.

export const MAX_RECONNECT_ATTEMPTS = 6;

/** Delay before the Nth (0-based) reconnect attempt: base·2^n, capped. */
export function backoffMs(attempt: number, base = 500, cap = 8000): number {
  return Math.min(cap, base * 2 ** Math.max(0, attempt));
}
