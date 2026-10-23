# HFValid collection v3 — attribution and changes

The guidewire lesson’s femur surface and derived canal are adaptations of **HFValid collection v3**, by **Aldieri, La Mattina, Szyszko, Baruffaldi and Viceconti (2025)**, published through the University of Bologna AMS Acta repository: https://amsacta.unibo.it/id/eprint/8431/ .

These anatomy assets and their derivatives use **CC BY 4.0 (Creative Commons Attribution 4.0 International)**, not the application’s MIT licence: https://creativecommons.org/licenses/by/4.0/ . Retain attribution, the licence link and an indication of changes when sharing adaptations. No endorsement by the source authors or repository is implied.

## Changes made by Parallax

- Used the Pat059 outer surface, CT and supplied landmarks as source inputs. Raw CT and source archives are not distributed.
- Derived an approximate central-shaft canal from the largest enclosed interior of the largest connected ring at 500 stored CT units within the outer surface. No smoothing, dilation, closing or broken-ring repair was applied. Marching cubes at 0.5 on the native grid created a closed surface with artificial caps.
- Rigidly transformed the outer and canal surfaces from LPS millimetres to a centred right-handed frame: X lateral, Y proximal, Z anterior. The export does not improve source resolution.
- Authored a 16 mm fracture gap and 10 mm posterior distal-fragment translation, applied during rendering, plus two fixed straight finite-wire/olive presets and illustrative projections. These additions are not publisher anatomy or validated procedures.

The canal covers only the central shaft, not the full proximal/distal medullary spaces. Its artificial end caps are not anatomical canal ends. Anatomical accuracy, clinical views and learner effectiveness are unvalidated. Original application code and separately authored procedural wire geometry remain under MIT; bundled libraries and fonts retain their own licences.

See [source identifiers, methods and hashes](guidewire-fracture-provenance.json) and [lesson geometry and limitations](GUIDEWIRE-FRACTURE.md).
