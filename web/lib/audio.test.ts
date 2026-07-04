import { describe, expect, it } from "vitest";

import { floatToPcm16, resampleLinear, rms } from "./audio";

describe("floatToPcm16", () => {
  it("maps [-1, 1] to full-scale int16 little-endian", () => {
    const buf = floatToPcm16(new Float32Array([0, 1, -1, 0.5]));
    const view = new DataView(buf);
    expect(view.byteLength).toBe(8);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
    expect(view.getInt16(6, true)).toBe(16383);
  });
  it("clamps out-of-range samples", () => {
    const view = new DataView(floatToPcm16(new Float32Array([2, -2])));
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32768);
  });
});

describe("resampleLinear", () => {
  it("returns the input unchanged when rates match", () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(resampleLinear(input, 16000, 16000)).toBe(input);
  });
  it("halves the length when downsampling 2:1", () => {
    const input = new Float32Array([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(resampleLinear(input, 32000, 16000).length).toBe(4);
  });
});

describe("rms", () => {
  it("is zero for silence and positive for signal", () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1, 5);
  });
});
