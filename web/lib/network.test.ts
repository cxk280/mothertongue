import { describe, expect, it } from "vitest";

import { networkProfile } from "./data";
import { formatLiveNetwork, formatNetworkChip } from "./network";

describe("formatNetworkChip (simulated profiles)", () => {
  it("shows an explicit simulated readout for a weak profile", () => {
    expect(formatNetworkChip(networkProfile("3g"))).toBe("Simulated: 3G · 180 kbps · 4% loss");
    expect(formatNetworkChip(networkProfile("lossy"))).toBe("Simulated: Lossy · 120 kbps · 18% loss");
  });
});

describe("formatLiveNetwork (real connection)", () => {
  it("renders the real connection readout when supported", () => {
    expect(
      formatLiveNetwork({ supported: true, effectiveType: "4g", downlinkMbps: 10, rttMs: 50 }),
    ).toBe("Live: 4G · 10 Mbps · 50 ms");
  });
  it("is honest (no invented numbers) when the API is unavailable", () => {
    expect(formatLiveNetwork({ supported: false })).toBe("Live network");
  });
  it("shows only the fields the browser actually provides", () => {
    expect(formatLiveNetwork({ supported: true, effectiveType: "3g" })).toBe("Live: 3G");
    expect(formatLiveNetwork({ supported: true })).toBe("Live network");
  });
});
