import { describe, expect, it } from "vitest";

import { formatMultiplier, raceDurations, simulatedUsEastMs, verdictMultiplier } from "./compare";

describe("simulatedUsEastMs", () => {
  it("adds the ocean penalty to the real compute time", () => {
    expect(simulatedUsEastMs(160, 280)).toBe(440);
    expect(simulatedUsEastMs(30, 280)).toBe(310);
  });
});

describe("verdictMultiplier", () => {
  it("is us-east / in-region", () => {
    expect(verdictMultiplier(31, 310)).toBeCloseTo(10, 5);
    expect(verdictMultiplier(155, 435)).toBeCloseTo(2.806, 2);
  });
  it("never divides by zero", () => {
    expect(verdictMultiplier(0, 300)).toBe(1);
  });
});

describe("formatMultiplier", () => {
  it("shows whole numbers at/above 10 and one decimal below", () => {
    expect(formatMultiplier(10.4)).toBe("10");
    expect(formatMultiplier(2.83)).toBe("2.8");
    expect(formatMultiplier(9.96)).toBe("10");
  });
});

describe("raceDurations", () => {
  it("preserves the ratio and finishes the slower lane at visualMax", () => {
    const d = raceDurations(35, 315, 2500);
    expect(d.usEastVisualMs).toBeCloseTo(2500, 5); // slower lane hits the max
    expect(d.usEastVisualMs / d.inRegionVisualMs).toBeCloseTo(315 / 35, 5); // ratio kept
  });
  it("guards against a zero total", () => {
    const d = raceDurations(0, 0, 2500);
    expect(Number.isFinite(d.scale)).toBe(true);
  });
});
