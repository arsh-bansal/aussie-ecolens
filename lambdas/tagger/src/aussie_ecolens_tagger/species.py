"""Australian wildlife species taxonomy for the Tagger Lambda.

This module is the single source of truth for the 46-class SpeciesNet
output taxonomy. Class index order matches the supplied model.pt label
ordering and MUST NOT be reordered; downstream inference depends on
positional alignment between the model softmax output and SPECIES.

Latin -> human-friendly common name mapping is provided for UI display
and SNS notification subjects. The Latin name remains the canonical
identifier in all data records (DynamoDB, Cosmos) for stability.
"""

from __future__ import annotations

from typing import Final

# Ordered taxonomy. Index N corresponds to softmax output dimension N
# from the fine-tuned SpeciesNet model in models/model.pt.
SPECIES: Final[tuple[str, ...]] = (
    "Alectura_lathami",
    "Antechinus_agilis",
    "Bos_taurus",
    "Burhinus_grallarius",
    "Canis_familiaris",
    "Chalcophaps_longirostris",
    "Colluricincla_harmonica",
    "Corcorax_melanorhamphos",
    "Dacelo_novaeguineae",
    "Dama_dama",
    "Eopsaltria_australis",
    "Felis_catus",
    "Geopelia_humeralis",
    "Gymnorhina_tibicen",
    "Homo_sapiens",
    "Isoodon_macrourus",
    "Lepus_europaeus",
    "Macropus_giganteus",
    "Menura_novaehollandiae",
    "Mus_musculus",
    "Oryctolagus_cuniculus",
    "Perameles_nasuta",
    "Pitta_versicolor",
    "Rattus",
    "Rattus_fuscipes",
    "Rattus_rattus",
    "Strepera_graculina",
    "Sus_scrofa",
    "Tachyglossus_aculeatus",
    "Thylogale_stigmatica",
    "Trichosurus_caninus",
    "Trichosurus_cunninghami",
    "Trichosurus_vulpecula",
    "Varanus_varius",
    "Vombatus_ursinus",
    "Vulpes_vulpes",
    "Wallabia_bicolor",
    "Canis_dingo",
    "Capra_hircus",
    "Casuarius_casuarius",
    "Heteromyias_cinereifrons",
    "Hypsiprymnodon_moschatus",
    "Megapodius_reinwardt",
    "Notamacropus_rufogriseus",
    "Orthonyx_spaldingii",
    "Uromys_caudimaculatus",
)

# Latin -> common name for UI display and notification subjects.
# Sourced from the supplied models/README.md and standard refs.
COMMON_NAMES: Final[dict[str, str]] = {
    "Alectura_lathami": "Australian Brushturkey",
    "Antechinus_agilis": "Agile Antechinus",
    "Bos_taurus": "Cattle",
    "Burhinus_grallarius": "Bush Stone-curlew",
    "Canis_familiaris": "Domestic Dog",
    "Chalcophaps_longirostris": "Pacific Emerald Dove",
    "Colluricincla_harmonica": "Grey Shrikethrush",
    "Corcorax_melanorhamphos": "White-winged Chough",
    "Dacelo_novaeguineae": "Laughing Kookaburra",
    "Dama_dama": "Fallow Deer",
    "Eopsaltria_australis": "Eastern Yellow Robin",
    "Felis_catus": "Domestic Cat",
    "Geopelia_humeralis": "Bar-shouldered Dove",
    "Gymnorhina_tibicen": "Australian Magpie",
    "Homo_sapiens": "Human",
    "Isoodon_macrourus": "Northern Brown Bandicoot",
    "Lepus_europaeus": "European Hare",
    "Macropus_giganteus": "Eastern Grey Kangaroo",
    "Menura_novaehollandiae": "Superb Lyrebird",
    "Mus_musculus": "House Mouse",
    "Oryctolagus_cuniculus": "European Rabbit",
    "Perameles_nasuta": "Long-nosed Bandicoot",
    "Pitta_versicolor": "Noisy Pitta",
    "Rattus": "Rat (genus)",
    "Rattus_fuscipes": "Bush Rat",
    "Rattus_rattus": "Black Rat",
    "Strepera_graculina": "Pied Currawong",
    "Sus_scrofa": "Wild Pig",
    "Tachyglossus_aculeatus": "Short-beaked Echidna",
    "Thylogale_stigmatica": "Red-legged Pademelon",
    "Trichosurus_caninus": "Mountain Brushtail Possum",
    "Trichosurus_cunninghami": "Mountain Brushtail Possum",
    "Trichosurus_vulpecula": "Common Brushtail Possum",
    "Varanus_varius": "Lace Monitor",
    "Vombatus_ursinus": "Common Wombat",
    "Vulpes_vulpes": "Red Fox",
    "Wallabia_bicolor": "Swamp Wallaby",
    "Canis_dingo": "Dingo",
    "Capra_hircus": "Goat",
    "Casuarius_casuarius": "Southern Cassowary",
    "Heteromyias_cinereifrons": "Grey-headed Robin",
    "Hypsiprymnodon_moschatus": "Musky Rat-kangaroo",
    "Megapodius_reinwardt": "Orange-footed Scrubfowl",
    "Notamacropus_rufogriseus": "Red-necked Wallaby",
    "Orthonyx_spaldingii": "Chowchilla",
    "Uromys_caudimaculatus": "Giant White-tailed Rat",
}


def common_name(latin: str) -> str:
    """Return the human-friendly common name for a Latin species identifier.

    Falls back to the Latin name (with underscores replaced by spaces)
    if the species is not in the mapping; this should not happen for
    any value in SPECIES.

    Args:
        latin: A species identifier from SPECIES.

    Returns:
        The common name string, suitable for UI and notification subjects.
    """
    return COMMON_NAMES.get(latin, latin.replace("_", " "))


# Defensive sanity check executed at import time. Both SPECIES and the
# COMMON_NAMES mapping must agree exactly; any drift between them is a
# bug we want surfaced loudly, not silently producing wrong common names.
_missing = set(SPECIES) - set(COMMON_NAMES)
_extra = set(COMMON_NAMES) - set(SPECIES)
if _missing or _extra:
    raise RuntimeError(
        f"SPECIES/COMMON_NAMES mismatch: "
        f"missing common names for {_missing}, "
        f"extra common names {_extra}"
    )
