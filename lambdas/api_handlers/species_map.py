"""
Scientific-name → common-name lookup table.
Matches what Arsh's Tagger writes to DynamoDB (common names, lowercase,
spaces replaced with spaces — not underscores — matching labels.txt col 7).

Usage:
    from species_map import scientific_to_common, common_name_for
    common = scientific_to_common("Vombatus_ursinus")   # -> "common wombat"
    common = common_name_for("Canis_dingo")             # -> "dingo"
"""

# Keyed by "Genus_species" (case-insensitive lookup below)
_SCIENTIFIC_TO_COMMON = {
    "alectura_lathami":         "australian brushturkey",
    "antechinus_agilis":        "agile antechinus",
    "bos_taurus":               "cattle",
    "burhinus_grallarius":      "bush thick-knee",
    "canis_familiaris":         "dingo",
    "canis_dingo":              "dingo",
    "capra_hircus":             "domestic goat",
    "casuarius_casuarius":      "southern cassowary",
    "chalcophaps_longirostris": "pacific emerald dove",
    "colluricincla_harmonica":  "grey shrikethrush",
    "corcorax_melanorhamphos":  "white-winged chough",
    "dacelo_novaeguineae":      "laughing kookaburra",
    "dama_dama":                "fallow deer",
    "eopsaltria_australis":     "eastern yellow robin",
    "felis_catus":              "domestic cat",
    "geopelia_humeralis":       "bar-shouldered dove",
    "gymnorhina_tibicen":       "australian magpie",
    "heteromyias_cinereifrons": "grey-headed robin",
    "homo_sapiens":             "human",
    "hypsiprymnodon_moschatus": "musky rat kangaroo",
    "isoodon_macrourus":        "northern brown bandicoot",
    "lepus_europaeus":          "european hare",
    "macropus_giganteus":       "eastern gray kangaroo",
    "megapodius_reinwardt":     "orange-footed scrubfowl",
    "menura_novaehollandiae":   "superb lyrebird",
    "mus_musculus":             "house mouse",
    "notamacropus_rufogriseus": "red-necked wallaby",
    "orthonyx_spaldingii":      "northern chowchilla",
    "oryctolagus_cuniculus":    "european rabbit",
    "perameles_nasuta":         "long-nosed bandicoot",
    "pitta_versicolor":         "noisy pitta",
    "rattus":                   "rat",
    "rattus_fuscipes":          "australian bush rat",
    "rattus_rattus":            "black rat",
    "strepera_graculina":       "pied currawong",
    "sus_scrofa":               "wild boar",
    "tachyglossus_aculeatus":   "australian echidna",
    "thylogale_stigmatica":     "red-legged pademelon",
    "trichosurus_caninus":      "short-eared possum",
    "trichosurus_cunninghami":  "mountain brushtail opossum",
    "trichosurus_vulpecula":    "common brushtail",
    "uromys_caudimaculatus":    "giant white-tailed rat",
    "varanus_varius":           "lace monitor",
    "vombatus_ursinus":         "common wombat",
    "vulpes_vulpes":            "red fox",
    "wallabia_bicolor":         "swamp wallaby",
}


def scientific_to_common(scientific_name: str) -> str | None:
    """Return the common name for a scientific name like 'Vombatus_ursinus'.
    Returns None if not found.
    """
    key = scientific_name.replace(" ", "_").lower()
    return _SCIENTIFIC_TO_COMMON.get(key)


def common_name_for(scientific_name: str, fallback: str | None = None) -> str | None:
    """Like scientific_to_common but returns fallback (default None) if missing."""
    result = scientific_to_common(scientific_name)
    return result if result is not None else fallback
