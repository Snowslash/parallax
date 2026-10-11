# Preset femur-wire lesson: numerical contract

## Scope and interpretation

This is a bounded, synthetic projection exercise using the existing BodyParts3D outer/core assets. No asset, shared bone renderer, old source or material coefficient was changed. The wire is a flat-ended, solid cylinder, 90 synthetic mm long and 1 mm radius. Its end represents the **planned screw tip for this exercise only**; an actual guidewire endpoint is not generally an implant tip.

The authored views and head landmark require human anatomical review. Passing numerical tests is not anatomical registration, clinical validation, donor calibration or learner validation. The dimensions use a **synthetic mm** teaching scale even though the source header describes mm. The UI abbreviates this to mm; About explains the scale and its limits. The observed mesh is not a sphere and the sphere fit is only an authoring aid.

## Coordinates and authored references

Preview coordinates = source coordinates minus `[91.1016,-80.8791,744.239]`. No rotation or scale is applied to the existing assets. World coordinates remain right-handed. At zero camera orbit/tilt, the source is on −Y, image-right is +X and image-up +Z. Pixel columns increase right, rows down; pixel centres use `size/2 - 0.5`.

The authored landmarks were calculated from the mesh using the following explicit selections. The source package provides the resulting constants and geometry tests; it does not include the separate authoring workspace:

- Select source vertices with `X < 105` and `Z > 795` for the proximal medial rounded head patch (266 vertices). Algebraic least-squares sphere fit gives centre `[87.374050229,-78.821281017,811.299654151]`, radius 22.879231011, RMS radial residual 0.855105575. This is an explicitly authored selection, not an automatic anatomical classifier.
- Select `790 < Z < 798` and `100 < X < 125` for the neck-base patch; its centroid is `[117.3045,-69.441671429,794.983642857]`.
- The vector from neck base to fitted head is normalized as the neck axis. Source +Z is the authored proximal/superior reference, supported by the proximal head location versus the long shaft's inferior extent, not an expert-confirmed anatomical frame.
- AP normal is perpendicular to the plane containing this neck axis and +Z. This yields **orbit 17.39995675°, tilt 0°**, not the renderer's arbitrary zero.
- The authored shaft-referenced lateral normal is orthogonal to that AP normal in the source XY plane: **orbit 107.39995675°, tilt 0°**. Both rigs pivot at the fitted head centre in preview coordinates. These are model-defined AP/lateral references, not a claim of an anatomically validated cross-table lateral. In particular the lateral foreshortens the oblique neck axis; it is not an unforeshortened neck-axis view.
- Trace the neck axis outward from the head centre to the **actual triangular outer surface**, rather than using the fitted sphere radius. Intersection distance is 23.1990677843; apex source position `[67.734791081,-84.975835487,822.005620032]`. Independent triangle distance is below 1e-5 mm in the JS test, and approximately 6.7e-15 in the Python audit.

Source–pivot = 800, source–detector = 1200, detector field = 320 × 320 synthetic mm, unchanged from `meshCamera`. Source–point depth is computed separately for every measurement endpoint. The whole long femur intentionally need not fit in this proximal assessment.

## Cases and explicit criteria

The preset wire follows a **130° guide trajectory**, measured from the distal authored shaft direction (source −Z) to the wire direction pointing toward the head. Its horizontal direction remains in the authored neck/+Z plane. This guide direction is independent of the mesh-derived neck axis used to define the target landmark. All three preset tip positions, assessment criteria and reference views remain fixed; the lateral entry is determined by the new trajectory's intersection with the unchanged outer mesh, not by moving the displayed image.

The 130° angle is selected for this exercise, not a claim that every DHS guide uses that angle. Source +Z remains an authored shaft reference rather than a fitted or clinically registered shaft axis. Tests independently check the angle, lower lateral-cortex intersection, external finite tail and single cortical crossing along sampled cylinder-rim rays; this is not a complete anatomical or operative validation.

| ID | Axis setback from surface landmark | AP-depth offset | Canonical paired proxy | Meets model criteria |
|---|---:|---:|---:|---|
| `central-deep` | 8 | 0 | 11.691861 | yes |
| `shallow` | 22 | 0 | 32.152617 | no: distance |
| `eccentric-lateral` | 8 | −12 | 20.555072 | no: centrality |

The two criteria are **paired proxy ≤25 synthetic mm AND absolute AP-depth eccentricity ≤8 synthetic mm**. The centrality band is an authored teaching criterion, not a published universal clinical threshold. Eccentricity is the absolute component of `(tip − head centre)` along the authored AP beam direction; thus it is exposed on the authored lateral. AP distances for the central and eccentric cases are equal, while the lateral distinguishes them. Full finite end-cap containment is checked conservatively by minimum triangle distance from the tip centre minus wire radius; the selected eccentric case has >2.60 mm clearance and lies inside the surface. This is not a claim that the entire wire is within bone: the shaft intentionally extends outside the bone as an inserted-wire proxy.

An initially considered +14 mm eccentric offset failed the independent cap-clearance check; +12 was also too close to the surface. The final −12 mm case avoids contact ambiguity. The rejected attempt is preserved in evidence, not silently treated as success.

## Measurement: deliberately not exact clinical TAD

[Baumgaertner et al., PMID 7608228](https://pubmed.ncbi.nlm.nih.gov/7608228/) concerns lag-screw tip–apex distance as the sum of AP and lateral distances corrected for magnification. Its reported ≤25 mm finding is not a universal safety guarantee. No paper figures or full text are bundled.

This implementation instead measures a **model-plane tip-to-landmark proxy**: the projected-plane magnitude of `(tip − fixed mesh apex landmark)`. Individual endpoint perspective magnifications are available, so the coordinates can be corrected independently using their model depths. `distanceMm` equals the norm of those separately corrected plane coordinates. It is not simply detector distance divided by one endpoint magnification. It is invariant under pure rig translation or image resolution changes at fixed orientation, but changes with view orientation. Measurements shown after commitment must be computed from the saved frame's actual pose, not the reference pose.

The fixed mesh landmark is not an independently identified clinical apex in each view; the authored lateral also foreshortens the neck. **Do not label this number as exact clinical TAD.** The UI-requested property `tadMm` is an API compatibility alias for `sumMm`; render `measurementLabel` (“Tip-to-marker distance”). The lesson links to the clinical-TAD distinction in About; the technical quantity remains the paired tip-to-landmark proxy defined here. Canonical `assessmentForCase` truth stays stable across permitted small acquisition deviations. `assessCaptures` reports the actual saved-frame sum and canonical criteria truth separately; this avoids making the hidden answer change when a view moves slightly.

## Rendering and validity

`wireChord(source, detector, wire)` analytically intersects a finite ray with a finite flat-ended cylinder. Both radial and axial intervals are clipped to the source–detector segment. Metal is not a decorative 2D line. Bone attenuation is evaluated by the existing unmodified integrator; illustrative metal attenuation is added as `0.65 * chordMm`. This is an additive opacity teaching model, not a calibrated energy spectrum or material-displacement simulation.

One fixed mapping, `round(255*(1-exp(-attenuation)))`, is used for all frames. No per-frame normalization, alignment or warping. Invalid bone rays retain NaN attenuation, magenta pixels and their original diagnostics; metal cannot repair them. The worker rejects any frame with unresolved rays. Tests prove the pre-metal attenuation is byte-identical to the old renderer at the identical pose and size, and off-wire pixels are unchanged.

Adequacy requires:

- orientation within 3° orbit **and** 3° tilt of one authored reference;
- zero unresolved rays and a complete RGBA frame;
- conservative projection bounds on a 25-mm-radius head envelope and both radius-1 wire endpoint spheres, with a two-pixel detector margin. This contains the authored head-patch vertices and the entire finite wire; it does not require the full long femur;
- AP and lateral captures of the same preset, not arbitrary counts or duplicate views.

The source overlay test also compares actual tip-neighbourhood metal samples and visible pixel changes in all six 256² reference frames. Refinement evidence samples 128², 256² and 512². This is numerical sampling evidence, not human perceptual approval.

## Module API

`demo/femur-lesson/model.mjs`:

- `CASES`: frozen array of `{id,title,brief,wire:{start,tip,radius},plannedTip}`. Titles describe the answer; before commitment use case indices or neutral UI names.
- `REFERENCE_POSES.{ap,lateral}`, `DEFAULT_LESSON_POSE`: full `{orbit,tilt,x,y,z}`.
- `GUIDE_ANGLE_DEGREES`: fixed 130° insertion trajectory relative to the distal authored shaft reference, not the model's neck-shaft angle.
- `LANDMARKS`: preview-space `head`, `neckBase`, `axis`, `apex`, `headEnvelopeRadius`.
- `classifyView(pose) -> 'ap'|'lateral'|null`: orientation only.
- `classifyFrame(frame) -> 'ap'|'lateral'|null`: recomputes orientation/framing and checks frame shape/validity. Use this for capture gates.
- `measureFrame(frame)`: adequate saved frame → `{tipPx,apexPx,distanceMm,detectorDistanceMm,magnification,apexMagnification,tipDepthMm,apexDepthMm,kind,units,correction}`. Inadequate frames throw. `magnification` is specifically tip magnification.
- `assessCaptures(caseId,{ap,lateral})`: returns `{valid,meets,tadMm,feedback,...}`; valid results also include `sumMm`, per-view measurements, canonical `truth`, `centred`, `withinDistance`, `measurementLabel`. Incomplete/mismatched pairs return `valid:false,meets:false,tadMm:null`.
- `assessmentForCase(caseId)`: canonical geometry truth and criteria, never inferred from pixels.
- `measurePair(first,second)`: equivalent pair measurement independent of argument order.
- Additional exported helpers: `caseForId`, `validatePose`, `projectLandmark`, `measureCase`, `captureAdequacy`.

`geometry.mjs`:

- `renderLessonProjection(outer,core,caseId,pose,{size=256,raw=false})` returns `{caseId,pose,camera,width,height,pixels,invalidCount,invalidRays,measurement,adequacy,material}`.
- `raw:true` adds Float64 arrays `outer,core,shell,attenuation,boneAttenuation,wire`; `wire` stores metal chord lengths, not attenuation. `MU_METAL=0.65`.
- Poses must contain all five finite fields; out-of-range tilt/XYZ are rejected, not silently clamped. Size integer 16..512. Unknown IDs throw.

`worker.mjs`:

- Message `{id,caseId,pose,size}` where `id` is a nonnegative safe integer; size defaults to 256.
- Pins the exact outer SHA256 `c941760d62e6e42546202830e1322812bae3f5de325320a3295ed10c63c2956f` and core SHA256 `d142649bab1ecce717f1c58c50f2043fcba2a5bf20e6e399103deec21888c04c`. Does not trust a mutable manifest to nominate replacement bytes.
- First successful initialization sends `{type:'ready',vertices,faces,metrics}`; geometry is preview-space outer mesh.
- Then `{id,frame}` with `frame.id`, `caseId`, asset hashes, render timing and source origin; or `{id,error,diagnostics?}`. Invalid requests are checked before initialization. Failure can retry initialization.

`transport.mjs`: `createLessonRenderer({WorkerClass=globalThis.Worker,timeoutMs=30000,onReady}) -> {render(job),dispose()}`. One outstanding job; busy rejection, timeout/ID-mismatch/crash termination, ready callback and late-callback protection. Disposal rejects pending work; later rendering can create a fresh worker.

## Reproduction and evidence

From the source-package root:

```sh
node --test demo/tests/femur-lesson-geometry.test.mjs demo/tests/femur-lesson-state.test.mjs demo/tests/femur-calipers.test.mjs
python scripts/check.py
```

Tests in the exported package exercise its own real modules. No runtime dependencies are installed. Geometry tests render the six preset/reference pairs, compare the unchanged bone attenuation and check independent projections, finite-wire chords, endpoint clearance, validity and worker asset rejection.

The separate engineering record retains RED logs, landmark-authoring evidence, six raw RGBA frames, PNGs and float64 attenuation/metal-chord arrays. Those operational records are not part of this source package. Numerical sampling at 128², 256² and 512² found zero unresolved rays in the 18 sampled frames, but does not establish perceptual or clinical accuracy.

Optional learner calipers mark tip first and landmark second. The first and second marks use the known model tip and landmark depths respectively, matching the reference's endpoint-specific correction rather than dividing the whole segment by one magnification. A gold landmark marker identifies the authored target before commitment; the line and model tip marker appear afterwards. These are model-assisted measurements, not a clinical image-calibration workflow. Case change, restart or replacing a saved view clears its manual marks. No answer or measurement is persisted.

Anatomical/clinical review and learner validation remain unperformed. This is a review candidate, not a validated TAD lesson.
