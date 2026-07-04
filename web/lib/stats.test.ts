import { describe, expect, it } from "vitest";

import { formatDuration, median, percentileNearestRank, simulatedUsEastMedian } from "./stats";

describe("median", () => {
  it("handles odd and even lengths and empty", () => {
    expect(median([31, 40, 35])).toBe(35);
    expect(median([10, 20, 30, 40])).toBe(25);
    expect(median([])).toBe(0);
  });
});

describe("percentileNearestRank", () => {
  it("computes p95 by nearest rank", () => {
    expect(percentileNearestRank([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentileNearestRank([10, 20, 30], 50)).toBe(20);
    expect(percentileNearestRank([], 95)).toBe(0);
  });
});

describe("simulatedUsEastMedian", () => {
  it("adds the ocean penalty to median compute", () => {
    expect(simulatedUsEastMedian([160, 180, 200], 280)).toBe(460);
  });
});

describe("formatDuration", () => {
  it("renders m:ss", () => {
    expect(formatDuration(252000)).toBe("4:12");
    expect(formatDuration(5000)).toBe("0:05");
    expect(formatDuration(0)).toBe("0:00");
  });
});
