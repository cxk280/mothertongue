import { describe, expect, it } from "vitest";

import { networkProfile } from "./data";
import { formatNetworkChip } from "./network";

describe("formatNetworkChip", () => {
  it("is neutral when throttling is off", () => {
    expect(formatNetworkChip(networkProfile("off"))).toBe("Network: auto-detected");
  });
  it("shows an explicit simulated readout for a weak profile", () => {
    expect(formatNetworkChip(networkProfile("3g"))).toBe("Simulated: 3G · 180 kbps · 4% loss");
    expect(formatNetworkChip(networkProfile("lossy"))).toBe("Simulated: Lossy · 120 kbps · 18% loss");
  });
  it("falls back to Off for an unknown id", () => {
    expect(formatNetworkChip(networkProfile("nope"))).toBe("Network: auto-detected");
  });
});
