# CT-informed proximal femur: attribution and licence

## Source and grant

Andrew E. Anderson, Penny R. Atkins, Niccolo Fiorentino, Rich Lisonbee, Jared Zitnay and Lindsay Schuring. *Dual Fluoroscopy In Vivo Pelvic and Hip Joint Kinematics in Patients With Cam Femoroacetabular Impingement Syndrome*. The Hive: University of Utah Research Data Repository, published 2025-09-30. Dataset DOI: https://hive.utah.edu/doi/10.7278/typcv-c7c06. The repository metadata identifies the licence as **Creative Commons Attribution 3.0 Unported (CC BY 3.0)**.[1]

Licence: https://creativecommons.org/licenses/by/3.0/ · Legal code: https://creativecommons.org/licenses/by/3.0/legalcode

Parallax uses the **Norm_02 subset**. Its derived proximal-femur `outer.obj`, `envelope.obj` and `density.u8`, with accompanying density metadata, in `demo/femur-lesson/assets/` are distributed under **CC BY 3.0, not MIT**. Preserve source attribution, the licence link and identification of these changes when redistributing. The original authors and repository do not endorse Parallax or its teaching interpretations.

## Changes made for Parallax

- Converted the native surface frame by reversing X and Y, then translated to a centred millimetre frame. Rasterized the source femur surface onto a 1 mm isotropic grid and reconstructed the outer surface by marching cubes; these are not the untouched source triangles.
- Sampled CT in its affine-defined frame. Derived a low-density compartment using Gaussian smoothing (sigma 0.8 mm), a threshold of 450 source units, an imposed outer-distance eligibility inset >1.8 mm, the largest six-connected component and enclosed-hole filling.
- Formed a restrained interior envelope by unioning that compartment with its physical 4 mm-radius morphological closing, filling enclosed holes and reapplying the eligibility mask while preserving the original compartment.
- Derived weak interior density using normalized masked Gaussian smoothing (sigma 1.25 mm), divided by 1000, clipped to [0,1], quantized to uint8 and zeroed outside the envelope. Exterior intensities do not contribute to this masked filter.
- Added authored landmarks, finite-wire placements, synthetic material coefficients and model-defined projection/measurement rules. These are Parallax interpretations, not source-author clinical conclusions.

Exact source and derived-file SHA-256 identities, transforms and parameters are recorded in [ct-femur-provenance.json](PROVENANCE.json). [FEMUR-LESSON.md](https://github.com/Snowslash/parallax/blob/main/docs/FEMUR-LESSON.md) defines the runtime and measurement contract. Raw CT, source scans, section images and diagnostic reports are not bundled in this release; the distributed density is a masked, transformed derivative, not raw CT.

## Limits and separate models

Anatomical status remains **PARTIAL**: this is a heuristic interior envelope and illustrative density, not accurate cortical segmentation, resolved trabecular anatomy or clinical HU/attenuation calibration. The 1 mm resampling adds no acquisition resolution. The imposed inset is not measured cortical thickness; source truncation and artificial end caps remain. The source-to-model transform and model-defined AP/lateral views are not independently certified anatomical registration. No clinical or learner validation is claimed.

This licence applies to the **lesson's CT-derived proximal femur**. The free Femur explorer remains a **separate BodyParts3D whole-femur model**, whose outer/core assets retain their [CC BY 4.0 attribution](../../mesh-spike/bp3d-cortex-v001/LICENSE.md). Do not treat the explorer as another view of this same bone. Original Parallax code and documentation retain MIT; bundled third-party libraries and fonts retain their own licences.

## Sources

[1] The Hive dataset metadata — https://hive.utah.edu/api/records/cftes-sc590
