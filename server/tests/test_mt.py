from app.config import Settings
from app.mt import FallbackMT, _nllb_code


def test_nllb_codes_map_iso3_to_script_variant():
    assert _nllb_code("eng") == "eng_Latn"
    assert _nllb_code("zul") == "zul_Latn"
    assert _nllb_code("swh") == "swh_Latn"
    # Amharic is Ethiopic, not Latin — the reason an explicit map matters.
    assert _nllb_code("amh") == "amh_Ethi"
    # Unlisted languages fall back to Latin, which is right for most.
    assert _nllb_code("nso") == "nso_Latn"


def test_fallback_scripts_flagship_and_placeholders_others():
    mt = FallbackMT(Settings(mode="fallback", fallback_sleep=False))
    # Flagship isiZulu -> English is scripted verbatim.
    assert (
        mt.translate("Sawubona. Ngicela usizo nge-akhawunti yami.", "zul", "eng")
        == "Hello. I'd like some help with my account."
    )
    # A non-scripted pair gets an honest placeholder, not an "[eng] …" marker.
    out = mt.translate("· sample audio ·", "yor", "eng")
    assert "[" not in out and "GPU" in out
