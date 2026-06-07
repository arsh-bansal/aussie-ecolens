// Canonical species the model can detect. Mirrors species_catalog.py
// (LATIN_TO_COMMON values) on the backend — keep in sync if the taxonomy
// changes. Used as autocomplete suggestions on search and alert subscribe.
export const SPECIES_OPTIONS = [
  'Agile Antechinus', 'Australian Brushturkey', 'Australian Magpie',
  'Bar-shouldered Dove', 'Black Rat', 'Bush Rat', 'Bush Stone-curlew',
  'Cattle', 'Chowchilla', 'Common Brushtail Possum', 'Common Wombat', 'Dingo',
  'Domestic Cat', 'Domestic Dog', 'Eastern Grey Kangaroo', 'Eastern Yellow Robin',
  'European Hare', 'European Rabbit', 'Fallow Deer', 'Giant White-tailed Rat',
  'Goat', 'Grey Shrikethrush', 'Grey-headed Robin', 'House Mouse', 'Human',
  'Lace Monitor', 'Laughing Kookaburra', 'Long-nosed Bandicoot',
  'Mountain Brushtail Possum', 'Musky Rat-kangaroo', 'Noisy Pitta',
  'Northern Brown Bandicoot', 'Orange-footed Scrubfowl', 'Pacific Emerald Dove',
  'Pied Currawong', 'Rat (genus)', 'Red Fox', 'Red-legged Pademelon',
  'Red-necked Wallaby', 'Short-beaked Echidna', 'Southern Cassowary',
  'Superb Lyrebird', 'Swamp Wallaby', 'White-winged Chough', 'Wild Pig',
] as const;
