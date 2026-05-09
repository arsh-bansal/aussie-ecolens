# Models

This folder is gitignored. Copy the supplied model files here:

- `mdv5a.pt` — MegaDetector v5a (~280 MB)
- `model.pt` — Fine-tuned SpeciesNet (~212 MB)
- `labels.txt` — Species labels with taxonomy

These come from the supplied `AussieEcoLense.zip` distributed with the brief.

Once placed here, run `scripts/upload_models.sh` to push them into the S3 model registry.

The model classes (in load order, matching `batch.py`):

```
['Alectura_lathami', 'Antechinus_agilis', 'Bos_taurus', 'Burhinus_grallarius',
 'Canis_familiaris', 'Chalcophaps_longirostris', 'Colluricincla_harmonica',
 'Corcorax_melanorhamphos', 'Dacelo_novaeguineae', 'Dama_dama',
 'Eopsaltria_australis', 'Felis_catus', 'Geopelia_humeralis',
 'Gymnorhina_tibicen', 'Homo_sapiens', 'Isoodon_macrourus', 'Lepus_europaeus',
 'Macropus_giganteus', 'Menura_novaehollandiae', 'Mus_musculus',
 'Oryctolagus_cuniculus', 'Perameles_nasuta', 'Pitta_versicolor', 'Rattus',
 'Rattus_fuscipes', 'Rattus_rattus', 'Strepera_graculina', 'Sus_scrofa',
 'Tachyglossus_aculeatus', 'Thylogale_stigmatica', 'Trichosurus_caninus',
 'Trichosurus_cunninghami', 'Trichosurus_vulpecula', 'Varanus_varius',
 'Vombatus_ursinus', 'Vulpes_vulpes', 'Wallabia_bicolor', 'Canis_dingo',
 'Capra_hircus', 'Casuarius_casuarius', 'Heteromyias_cinereifrons',
 'Hypsiprymnodon_moschatus', 'Megapodius_reinwardt', 'Notamacropus_rufogriseus',
 'Orthonyx_spaldingii', 'Uromys_caudimaculatus']
```

The Tagger Lambda maps these to common names using `labels.txt`.
