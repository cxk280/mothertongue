import { describe, expect, it } from "vitest";

import { formatMs, formatStageMs, latencyTier } from "./format";

describe("latencyTier", () => {
  it("calls in-region latencies conversational", () => {
    expect(latencyTier(31)).toBe("good");
    expect(latencyTier(79)).toBe("good");
  });
  it("flags the middle band amber and the high band red", () => {
    expect(latencyTier(120)).toBe("ok");
    expect(latencyTier(312)).toBe("bad");
  });
});

describe("formatMs", () => {
  it("rounds to whole ms", () => {
    expect(formatMs(31.4)).toBe("31");
    expect(formatMs(311.6)).toBe("312");
  });
});

describe("formatStageMs", () => {
  it("renders a compact integer", () => {
    expect(formatStageMs(9.2)).toBe("9");
    expect(formatStageMs(140.7)).toBe("141");
  });
});
