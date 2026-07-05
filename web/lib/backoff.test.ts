import { describe, expect, it } from "vitest";

import { backoffMs } from "./backoff";

describe("backoffMs", () => {
  it("doubles from the base", () => {
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(1)).toBe(1000);
    expect(backoffMs(2)).toBe(2000);
    expect(backoffMs(3)).toBe(4000);
  });
  it("caps the delay", () => {
    expect(backoffMs(10)).toBe(8000);
  });
  it("treats negative attempts as zero", () => {
    expect(backoffMs(-3)).toBe(500);
  });
});
