# Femur lesson: CT-informed model and numerical contract

## Scope

Only the preset-wire lesson uses this restrained CT-informed proximal femur. The free Femur explorer remains a **different whole-femur BodyParts3D model**, with its own core and material controls. Neither model is clinically validated. See [CT attribution and changes](CT-FEMUR-LICENCE.md) and [machine-readable provenance](ct-femur-provenance.json).

The lesson uses the Norm_02 source surface, CT-informed heuristic interior envelope and weak derived density field. These are not an accurate cortical segmentation, resolved trabecular anatomy or calibrated radiographic attenuation. Anatomical status remains **PARTIAL**. Numerical acceptance is not anatomical registration, learner validation or evidence of surgical safety. Raw CT and source authoring tools are not distributed.

## Coordinates and landmarks

Coordinates are model millimetres in a right-handed Cartesian frame, not independently certified clinical anatomical axes. Native source coordinates map to scan coordinates as `[-x,-y,z]`, then to render coordinates by adding `[111.6115865,-166.04663,-889.74704]`. Serialized assets are already in render coordinates; do not transform them again. The 1 mm model grid does not increase the source CT resolution (approximately 0.685547 × 0.685547 × 1 mm).

`demo/femur-lesson/constants.mjs` supplies exact values:

- Head reference: `[22.5648865,7.221370000000007,38.50696000000005]`, transformed from the source workbook's FJC landmark, not a sphere fit.
- Neck reference: `[5.215172293601418,3.8110558030260986,19.775739510798836]`. A source GT-to-FJC seed direction defines cross-sections sampled every 0.5 mm from 18 to 40 mm behind FJC. The minimum convex-hull-area contour at 24.5 mm supplies the centroid. This is a model-defined neck waist, not a clinically identified neck base.
- Apex marker: `[37.61215218205109,10.179107699345613,54.75239481794891]`, the first outer-triangle intersection from the head along the normalized head-minus-neck-reference axis.
- `HEAD_RADIUS = 33` is a **conservative framing envelope**, not an anatomical head radius or an inscribed safety sphere. It encloses vertices of triangles touching the headward halfspace of the neck plane.

The AP orbit is `atan2(neckY-headY,neckX-headX)`, approximately −168.87953622°; lateral is AP +90°, approximately −78.87953622°. Wrapping into [0,360) is equivalent. Both have zero tilt and pivot at the head. These are model-defined views; the lateral foreshortens the neck and is not an anatomically validated cross-table lateral.

At zero rig orbit/tilt the source is on −Y, image-right +X and image-up +Z. Pixel rows increase down. Source–pivot distance is 800 mm, source–detector 1200 mm, detector field 320 × 320 mm. Every pixel samples a finite source-to-detector ray, not an orthographic ray or scene screenshot.

## Finite wire and fixed cases

Each wire is a flat-ended cylinder of **105 mm length and 1 mm radius**. Its tip stands in for the planned screw tip only in this exercise; guidewire and implant endpoints are not generally interchangeable.

The common direction is `[0.7635247845131999,0.21468421169513086,0.6090489247038466]`. It is **130° to the measured local distal shaft axis** `[-0.11116470192903292,0.17603582406488205,-0.9780868047831067]`, derived by PCA of seven shaft-section centroids at render Z −52 through −28 mm in 4 mm increments. The head-minus-neck vector is projected perpendicular to that shaft and rotated **−1° about the distal shaft by the right-hand rule** to define the entry azimuth. Neither the shaft nor this guide is clinically registered.

The accepted refit changes starts, common length and direction, not the original CT-model tip vectors, landmarks, materials or intended outcomes. Exact tip coordinates are retained in `CASE_WIRES`; all values below are model mm.

| Case | Axis setback | AP-depth offset | Canonical paired proxy | Model outcome |
|---|---:|---:|---:|---|
| `central-deep` | 8 | 0 | 13.817483 | centred, within distance |
| `shallow` | 22 | 0 | 37.998078 | centred, outside distance |
| `eccentric-lateral` | 8 | −12 | 21.335783 | not centred, within distance |

The criteria are paired proxy ≤25 mm **and** absolute AP-depth eccentricity ≤8 mm. The centring band is an authored teaching rule, not a universal clinical threshold. Eccentricity is the absolute component of tip-minus-head along the model AP beam direction. The central and eccentric AP distances agree; the lateral distinguishes them.

## Geometry checks and their limits

The retained refit checks find one centreline crossing and one crossing on each of **72 sampled circumference-offset rays** per case. Independent triangle-plane/edge intersections agree with the derivation's ray solver. These are sampled entry-rim checks, **not certification of the continuous entry disk or every intervening angle**. Distance calculations are shared rather than a second independent distance implementation.

Three parity rays establish outside starts and inside tips; minimum triangle distance minus radius conservatively bounds their capsule clearances. The wire intentionally extends outside the bone. The continuous interior-course bound uses the 1-Lipschitz distance property, samples no farther than 0.5 mm apart, and subtracts radius plus half the maximum spacing. It applies **only after the first 3 mm entry collar**, which remains excluded.

| Case | Tip capsule clearance | Course lower bound after collar | External axial tail diagnostic |
|---|---:|---:|---:|
| `central-deep` | 6.832029 | 1.662656 | 12.351663 |
| `shallow` | 16.701528 | 1.484671 | 26.194873 |
| `eccentric-lateral` | 3.554814 | 0.716107 | 15.443735 |

These are model-specific geometric checks, not cortical thickness measurements or clinical safety claims. Prior failed placements are not acceptance evidence for this configuration.

## Material and ray integration

The lesson owns its solver under `demo/femur-lesson/ct/`; it does not replace the explorer's renderer. `assets/outer.obj` and `assets/envelope.obj` supply strict triangle crossing intervals. Unresolved crossings, inconsistent nesting and invalid rays are rejected; no ray perturbation, silent mesh repair or metal overlay can turn an invalid ray into an accepted one.

The outer-minus-envelope interval supplies the shell. Inside the envelope, trilinear sampling reads `density.u8` through `density.json`: shape `[100,71,132]`, C-order XYZ with Z fastest, spacing `[1,1,1]`, sample-centre origin `[-49.3884135,-35.04662999999999,-65.74703999999997]`, values byte/255. There is no extra half-voxel offset. Midpoint integration subdivides each exact clipped interior interval into steps no longer than **0.5 mm**.

```text
A_bone = 0.04 × shellLength + 0.008 × interiorLength
         + 0.004 × integral(interior normalized density ds)
A      = A_bone + 0.65 × finiteWireChordLength
grey   = round(255 × (1 − exp(−A)))
```

Coefficients are illustrative model-mm⁻¹, not calibrated tissue or metal attenuation. Metal adds opacity rather than displacing bone. Its chord is the analytic finite-cylinder intersection clipped to the source–detector segment. All frames share this fixed mapping; no image-space blur, per-image normalization, alignment or warping is used. Soft tissue, scatter, energy spectrum, blur and detector noise are omitted.

The worker checks the exact asset identities against fixed SHA-256 pins, not merely a mutable manifest. Any unresolved bone ray rejects the frame; raw invalid attenuation remains NaN with diagnostic magenta pixels. Stale results cannot overwrite a newer requested pose; errors leave the last accepted frame with its original label.

## Measurement and acquisition contract

The quantity is a **model-plane tip-to-landmark proxy, not clinical TAD**. For each saved frame it is the magnitude of tip-minus-fixed-apex projected onto camera right/up. Endpoint coordinates are corrected separately using their known model depths; dividing the entire detector distance by one magnification is not equivalent. Pure rig translation or resolution changes do not change this plane quantity at fixed orientation.

The same fixed gold landmark is used in both views, rather than independently locating a clinical apex. The background reference is [Baumgaertner et al., PMID 7608228](https://pubmed.ncbi.nlm.nih.gov/7608228/); its 25 mm finding is not a guarantee of safe fixation. No full text or paper figures are bundled. The lesson does not assess reduction, implant selection or fixation stability.

Capture adequacy requires all of:

- within 3° orbit and 3° tilt of a model AP or lateral reference;
- zero unresolved rays and a complete square RGBA frame;
- conservative projection bounds for the **33 mm head envelope** and both radius-1 wire endpoint spheres, with a two-pixel margin (not whole-femur framing);
- one AP and one lateral capture from the same case, not duplicate views.

`model.mjs` exports `CASES`, `REFERENCE_POSES`, `LANDMARKS`, pose/frame classification, `measureFrame`, `measurePair`, `assessmentForCase` and `assessCaptures`. Canonical truth remains fixed while saved-frame distances use the actual acquired poses. `tadMm` is a compatibility alias for the summed proxy; display “Tip-to-marker distance”, not exact clinical TAD. `geometry.mjs` takes outer, envelope, case ID and pose, with the density field in its options.

The whole 3D wire is hidden until a judgement and reason are committed. This is a presentation gate, not hidden client-side data. Observer controls do not acquire images. Saved pixels are immutable; case change/restart clears the pair and reveal. Optional calipers mark tip then landmark and use their respective known model depths. Replacing a view clears its marks. No answer or measurement is persisted.

## Reproduction boundary

From the distributed source-package root, the self-contained geometry/state/caliper checks use the shipped assets and modules:

```sh
node --test demo/tests/femur-lesson-geometry.test.mjs demo/tests/femur-lesson-state.test.mjs demo/tests/femur-calipers.test.mjs
```

See [reproduction notes](REPRODUCING.md) for the full suite and browser checks. These checks reproduce runtime geometry and projections, not source CT processing or anatomical review. The source-acquisition, segmentation and landmark-authoring pipeline is **not bundled**; the provenance records its methods and identities without implying those tools can be run from this package.
