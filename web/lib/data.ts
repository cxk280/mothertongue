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

export const LANGUAGES: Language[] = [
  { code: "zul", label: "isiZulu (Zulu)" },
  { code: "eng", label: "English" },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function regionByCode(code: string): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}
