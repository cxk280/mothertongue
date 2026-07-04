// Room code helpers for two-way calls. Kept pure so the mapping is unit-tested;
// randomness is injected so newRoomCode() stays a thin wrapper.

// No ambiguous characters (0/O, 1/I/L) — codes get read aloud / typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Map a list of arbitrary numbers to a code over the safe alphabet. */
export function codeFromValues(values: number[]): string {
  return values.map((v) => ALPHABET[Math.abs(Math.trunc(v)) % ALPHABET.length]).join("");
}

/** Normalize a user-typed/shared code: uppercase, drop anything off-alphabet. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
}

export function newRoomCode(len = 5): string {
  const values = Array.from({ length: len }, () => Math.floor(Math.random() * ALPHABET.length));
  return codeFromValues(values);
}
