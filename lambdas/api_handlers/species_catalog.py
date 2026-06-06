"""Canonical species catalog and input resolution for the Query API.

This module is the single source of truth, on the query side, for the species
names the system recognises. It deliberately mirrors the Tagger's taxonomy
(lambdas/tagger/.../species.py): the Tagger classifies into Latin identifiers
and writes the *common name* to DynamoDB/Cosmos as the tag key. Those common
names are therefore the canonical strings that:

  * appear as keys in c.tags on every stored document (search must match them);
  * are published verbatim by the Notifier as the SNS "species" message
    attribute (subscribe filter policies must match them byte-for-byte, since
    SNS filtering is case-sensitive exact-match).

External input (search terms, subscribe tags) is free-form and case-noisy. We
normalise it to the canonical name at the API boundary via resolve_species():
case-insensitive, whitespace-tolerant, and accepting Latin names and a curated
set of common synonyms. Unknown input resolves to None so callers can reject it
(subscribe) or fall through to a guaranteed-empty match (search) rather than
silently filtering on a string that can never match stored data.

If the Tagger taxonomy changes, update LATIN_TO_COMMON here to match. The
import-time guard asserts the expected species count so drift fails loudly.
"""

from __future__ import annotations

import re

# Latin identifier -> canonical common name. Mirrors the Tagger's COMMON_NAMES.
# Two Trichosurus species share the common name "Mountain Brushtail Possum";
# the Tagger sums their counts under that single tag key, so the set of
# canonical names is intentionally smaller than the number of Latin classes.
LATIN_TO_COMMON: dict[str, str] = {
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

# The 46-class taxonomy maps onto this many distinct canonical names.
_EXPECTED_LATIN_CLASSES = 46

# Sorted, de-duplicated canonical names (what the UI can offer as choices).
CANONICAL_SPECIES: tuple[str, ...] = tuple(sorted(set(LATIN_TO_COMMON.values())))

# Curated synonyms / short forms -> canonical name. Keys are matched after the
# same normalisation applied to user input (see _normalise). Only unambiguous
# shortcuts are listed; ambiguous bare terms (e.g. "wallaby", "bandicoot") are
# intentionally omitted so resolve_species returns None and the caller can ask
# the user to be specific rather than guessing wrong.
_ALIASES: dict[str, str] = {
    "fox": "Red Fox",
    "cat": "Domestic Cat",
    "feral cat": "Domestic Cat",
    "dog": "Domestic Dog",
    "cow": "Cattle",
    "cows": "Cattle",
    "kangaroo": "Eastern Grey Kangaroo",
    "grey kangaroo": "Eastern Grey Kangaroo",
    "gray kangaroo": "Eastern Grey Kangaroo",
    "wombat": "Common Wombat",
    "cassowary": "Southern Cassowary",
    "echidna": "Short-beaked Echidna",
    "pig": "Wild Pig",
    "boar": "Wild Pig",
    "wild boar": "Wild Pig",
    "rat": "Rat (genus)",
    "possum": "Common Brushtail Possum",
    "brushtail": "Common Brushtail Possum",
    "brushtail possum": "Common Brushtail Possum",
    "kookaburra": "Laughing Kookaburra",
    "magpie": "Australian Magpie",
    "rabbit": "European Rabbit",
    "hare": "European Hare",
    "mouse": "House Mouse",
    "lyrebird": "Superb Lyrebird",
    "brushturkey": "Australian Brushturkey",
    "brush turkey": "Australian Brushturkey",
    "pademelon": "Red-legged Pademelon",
    "deer": "Fallow Deer",
    "monitor": "Lace Monitor",
    "goanna": "Lace Monitor",
    "chowchilla": "Chowchilla",
    "human": "Human",
    "goat": "Goat",
    "dingo": "Dingo",
}


def _normalise(value: str) -> str:
    """Lowercase, trim, and collapse internal whitespace for index lookups."""
    return re.sub(r"\s+", " ", value.strip().lower())


def _build_index() -> dict[str, str]:
    """Build the normalised lookup index once at import time."""
    index: dict[str, str] = {}

    # Canonical names resolve to themselves.
    for common in LATIN_TO_COMMON.values():
        index[_normalise(common)] = common

    # Latin identifiers (both "Genus_species" and "genus species") resolve too.
    for latin, common in LATIN_TO_COMMON.items():
        index[_normalise(latin)] = common
        index[_normalise(latin.replace("_", " "))] = common

    # Curated synonyms.
    for alias, common in _ALIASES.items():
        index[_normalise(alias)] = common

    return index


_INDEX: dict[str, str] = _build_index()


def resolve_species(value: str) -> str | None:
    """Resolve free-form user input to the canonical stored species name.

    Accepts the canonical common name (any case), a Latin identifier, or a
    curated synonym. Returns the exact canonical string used as the tag key in
    storage and as the SNS species attribute, or None if unrecognised.
    """
    if not value:
        return None
    return _INDEX.get(_normalise(value))


def expand_species(value: str) -> list[str]:
    """Expand free-form input to all canonical species it could mean.

    Used by species search so a partial term matches by substring: "common"
    -> ["Common Brushtail Possum", "Common Wombat", ...]. Resolution order:

    1. Exact resolve (canonical name / Latin / curated synonym) — if it maps to
       a single species, return just that (preserves precise lookups).
    2. Otherwise, substring match against canonical common names (normalised,
       case-insensitive) — every name containing the term.

    Returns canonical names (the exact stored tag keys), de-duplicated and
    sorted. Empty list if nothing matches, so the caller's query matches nothing
    rather than erroring.
    """
    exact = resolve_species(value)
    if exact:
        return [exact]
    term = _normalise(value)
    if not term:
        return []
    return sorted({c for c in CANONICAL_SPECIES if term in _normalise(c)})


def normalize_tag_key(tag: str) -> str:
    """Canonical key for tag storage, search, add, and remove.

    Known species resolve to the Tagger's canonical common name (any input case).
    Custom manual tags (e.g. demoooo, hihi) are stored lowercase for
    case-insensitive matching.
    """
    if not tag or not tag.strip():
        return ""
    canonical = resolve_species(tag)
    if canonical:
        return canonical
    return _normalise(tag)


# Fail loudly if the taxonomy drifts from the Tagger's expected class count.
if len(LATIN_TO_COMMON) != _EXPECTED_LATIN_CLASSES:
    raise RuntimeError(
        f"species_catalog drift: expected {_EXPECTED_LATIN_CLASSES} Latin "
        f"classes, found {len(LATIN_TO_COMMON)}. Re-sync with the Tagger's "
        f"species.py COMMON_NAMES."
    )
