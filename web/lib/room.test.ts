import { describe, expect, it } from "vitest";

import { ROOM_CODE_LEN, codeFromValues, isValidRoomCode, newRoomCode, normalizeRoomCode } from "./room";

describe("codeFromValues", () => {
  it("maps into the safe alphabet and wraps modulo", () => {
    expect(codeFromValues([0, 1, 2])).toBe("ABC");
    expect(codeFromValues([31, 32])).toBe("AB"); // alphabet length 31: 31%31=0->A, 32%31=1->B
  });
  it("has no ambiguous characters", () => {
    const code = codeFromValues([0, 5, 10, 15, 20, 25, 29]);
    expect(code).not.toMatch(/[01OIL]/);
  });
});

describe("normalizeRoomCode", () => {
  it("uppercases and strips off-alphabet characters", () => {
    expect(normalizeRoomCode("ab-c 2")).toBe("ABC2");
    expect(normalizeRoomCode("h0i1o")).toBe("H"); // 0,1,O ambiguous chars dropped
  });
});

describe("newRoomCode", () => {
  it("produces a code of the requested length over the alphabet", () => {
    const code = newRoomCode(5);
    expect(code).toHaveLength(5);
    expect(normalizeRoomCode(code)).toBe(code);
  });
  it("defaults to the canonical length", () => {
    expect(newRoomCode()).toHaveLength(ROOM_CODE_LEN);
  });
});

describe("isValidRoomCode", () => {
  it("accepts a freshly minted code", () => {
    expect(isValidRoomCode(newRoomCode())).toBe(true);
  });
  it("rejects codes that are too short or too long", () => {
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("AB")).toBe(false);
    expect(isValidRoomCode("ABCDEFGHIJ")).toBe(false);
    expect(isValidRoomCode(normalizeRoomCode("ab-cd2"))).toBe(true); // 5 valid chars
  });
});
