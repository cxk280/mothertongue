// Pure formatting for the Landing network chip. Unit-tested.

import type { NetworkProfile } from "./data";

/** Chip label: neutral when Off, otherwise an explicit "Simulated: …" readout. */
export function formatNetworkChip(p: NetworkProfile): string {
  if (p.bitrateKbps == null) return "Network: auto-detected";
  return `Simulated: ${p.label} · ${p.bitrateKbps} kbps · ${p.lossPct}% loss`;
}
