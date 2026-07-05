"""Scripted bilingual exchange used by the CPU fallback so a no-GPU demo still
shows a coherent conversation. On the real path these are never used.
"""

from __future__ import annotations

# A short isiZulu <-> English customer-support exchange (matches the Figma mocks).
LINES = [
    {"zul": "Sawubona. Ngicela usizo nge-akhawunti yami.",
     "eng": "Hello. I'd like some help with my account."},
    {"zul": "Inombolo yami ye-akhawunti ithi 4471 2038.",
     "eng": "My account number is 4471 2038."},
    {"zul": "Ngifuna ukubheka ibhalansi yami.",
     "eng": "I want to check my balance."},
    {"zul": "Ngiyabonga kakhulu ngosizo lwakho.",
     "eng": "Thank you very much for your help."},
    {"zul": "Sala kahle.",
     "eng": "Goodbye."},
]


def line_for(index: int, lang: str) -> str:
    """Source-language text for the Nth utterance (cycles if we run past the end).

    Only the flagship isiZulu/English pair is scripted; other languages get an
    honest placeholder (the real STT runs on the GPU path)."""
    row = LINES[index % len(LINES)]
    return row.get(lang) or "· sample audio ·"


def translate_pair(text: str, src: str, dst: str) -> str | None:
    for row in LINES:
        if row.get(src) == text:
            return row.get(dst)
    return None
