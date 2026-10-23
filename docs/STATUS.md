# Verification and benchmarks

## Navigation coverage

`demo/tests/catalogue.test.mjs` checks the three-entry catalogue, paired routes for the original two experiences and a lesson-only guidewire route, hub entrypoints and active project sections. These are source/document checks, not browser, anatomical or learner validation. Existing explorer and guided lesson routes are retained.

## Coverage

The guided and 3D Explore tests cover acquisition geometry, state transitions and image correspondence. Current Femur uses the BodyParts3D outer surface and authored core described in [model data](MODEL.md). It remains experimental: bounded geometric and paired-projection checks do not establish anatomical validity, radiographic realism or learning effectiveness. Current-model analytic and exact matched-projection integration tests are separate from the historical evidence below.

The historical procedural v001 experiment had a **PARTIAL** verdict: numerical and state checks passed for the sampled configurations, but 256² rendering missed the 250 ms settled-input target. Neither its timings nor its independent actual-mesh comparisons are measurements of the current model. No new public-release performance result is asserted here.

## Historical procedural v001 numerical results — 6 October 2026

The linked evidence records its inputs, source hashes and test configuration. These are recorded measurements, not a fresh benchmark of the reader's machine. Use the [reproduction commands](REPRODUCING.md) to generate new results.

- 5,547 asymmetric analytic-control rays; maximum path discrepancy 7.46e-13 mm.
- Ten actual-model frames (five poses at 128² and 256²), 409,600 rays, zero unresolved pixels.
- 177 resolved independent actual-mesh comparisons; maximum path discrepancy 9.09e-13 mm. One deliberate coplanar case explicitly unresolved.
- Worst 128²→256² detector-integral change: 0.286333%, under the predeclared 2% gate. This is not a per-pixel error bound.
- Exact browser/offline pixel-hash agreement was recorded at three poses.

### Browser timing

Linux, Ryzen 7 7730U host; Camofox 2.4.8 / Firefox 152.0, 1280×720. Browser hardware fingerprint is not GPU attestation. Per resolution: two unrecorded warm-ups, 20 recorded sequential poses, then one 40-event sweep. Nearest-rank p95, not FPS.

| Measurement | 128² median / p95 | 256² median / p95 |
| --- | ---: | ---: |
| Input → matching displayed image | 83 / 84 ms | 325 / 350 ms |
| Worker computation | 67.5 / 74 ms | 308.5 / 340 ms |
| Rapid-motion release → matching image, one sweep | 155 ms | 355 ms |

Five fresh documents/workers: first image 588 ms median / 708 ms p95. Browser/network caches were **not cleared**; this is not fully cold-cache evidence. Animation-frame gaps occasionally reached 66 ms despite responsive controls. No Windows-client, physical touchscreen or remote-device performance claim.

### Evidence files

- [Browser measurements](../evidence/bone-browser-2026-10-06.json): per-pose timings and pixel comparisons.
- [Numerical report](../evidence/bone-numerical-report.json): input hashes, camera/material configuration, analytic fixtures, frame summaries and sampling checks.
- [Independent reference](../evidence/bone-independent-reference.json): per-ray comparisons from the Python mesh oracle.

Full raw frames can be regenerated. Very small errors reflect agreement between floating-point formulations, not physical accuracy.

## Limits of these measurements

The sampled rays and poses do not cover every continuous configuration or establish robust-exact intersection predicates. Fresh-document timing is not empty-cache timing. The recorded browser checks do not establish physical-touchscreen usability or broad browser/accessibility coverage. Anatomical validity and educational effectiveness remain untested; see [limitations](SAFETY.md).

## Guidewire across a fracture

The guidewire lesson adds finite-source C-arm acquisition to a fixed AP comparison and post-commit reveal. Source/hash integrity, model geometry, projection checks and browser acceptance are separate gates. No new performance benchmark, anatomical approval or learner-validation result is asserted by its navigation integration. See [the lesson contract](GUIDEWIRE-FRACTURE.md) and [HFValid attribution](HFVALID-LICENCE.md).
