// Room code helpers for two-way calls. Kept pure so the mapping is unit-tested;
// randomness is injected so newRoomCode() stays a thin wrapper.

// No ambiguous characters (0/O, 1/I/L) — codes get read aloud / typed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Every code is exactly this many characters (see newRoomCode); used to reject
// malformed or oversized codes arriving from a shared/typed URL.
export const ROOM_CODE_LEN = 5;

/** A normalized code is only usable if it's exactly the expected length. */
export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LEN;
}

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

export function newRoomCode(len = ROOM_CODE_LEN): string {
  const values = Array.from({ length: len }, () => Math.floor(Math.random() * ALPHABET.length));
  return codeFromValues(values);
}
