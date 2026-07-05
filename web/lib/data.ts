// Static demo data: serving regions and the supported language pair.
// This first increment ships one pair (isiZulu <-> English) and one live region
// (São Paulo); the others are shown so the picker matches the mocks, but only the
// live one is wired.

export interface Region {
  code: string;
  label: string;
  sub: string;
  badge: string;
  live: boolean;
}

export interface Language {
  code: string; // ISO-639-3, matches the server
  label: string;
}

export const REGIONS: Region[] = [
  { code: "sao", label: "São Paulo", sub: "Brazil · sa-east", badge: "SP", live: true },
  { code: "jnb", label: "Johannesburg", sub: "South Africa · af-south", badge: "JN", live: false },
  { code: "bom", label: "Mumbai", sub: "India · ap-south", badge: "MU", live: false },
];

// Curated low-resource languages supported across the whole pipeline
// (MMS-ASR adapters + NLLB-200 + MMS-TTS voices). isiZulu ↔ English is the
// flagship pair the CPU-fallback demo scripts; the rest run on the real GPU path.
export const LANGUAGES: Language[] = [
  { code: "zul", label: "isiZulu (Zulu)" },
  { code: "xho", label: "isiXhosa (Xhosa)" },
  { code: "yor", label: "Yorùbá" },
  { code: "hau", label: "Hausa" },
  { code: "ibo", label: "Igbo" },
  { code: "swh", label: "Kiswahili (Swahili)" },
  { code: "amh", label: "Amharic (አማርኛ)" },
  { code: "afr", label: "Afrikaans" },
  { code: "eng", label: "English" },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function regionByCode(code: string): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

// Simulated connection profiles for the weak-network presenter demo. These are
// illustrative figures shown in the UI — they do NOT actually throttle the socket.
export interface NetworkProfile {
  id: string;
  label: string;
  bitrateKbps: number | null; // null = no throttle ("Off")
  lossPct: number;
}

export const NETWORK_PROFILES: NetworkProfile[] = [
  { id: "off", label: "Off", bitrateKbps: null, lossPct: 0 },
  { id: "3g", label: "3G", bitrateKbps: 180, lossPct: 4 },
  { id: "2g", label: "2G", bitrateKbps: 48, lossPct: 9 },
  { id: "lossy", label: "Lossy", bitrateKbps: 120, lossPct: 18 },
];

export function networkProfile(id: string): NetworkProfile {
  return NETWORK_PROFILES.find((p) => p.id === id) ?? NETWORK_PROFILES[0];
}
