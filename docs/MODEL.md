# Femur model data

## Current: BodyParts3D cortex/core

`bp3d-cortex-v001` uses the BodyParts3D release 4.0 left femur (FMA24475 / FJ3259), with an authored core. The current assets are [`femur.obj`](../demo/mesh-spike/bp3d-cortex-v001/femur.obj) and [`core.obj`](../demo/mesh-spike/bp3d-cortex-v001/core.obj). Each has 1,604 vertices and 3,204 triangles. They are covered by the [BodyParts3D licence and attribution](BODYPARTS3D-LICENCE.md), not MIT.

The outer derivative merges exactly coincident vertex indices only; it does not alter triangle geometry, smooth, decimate or crop the source. The whole bone remains present even when some of it lies outside the detector. Both stored meshes retain source coordinates. Runtime subtracts `[91.10159999999999,-80.8791,744.239]` from both boundaries, with no rotation or scaling. Source axes are retained; source physical-mm calibration and anatomical orientation have not been independently verified.

The core moves outer vertices inward along area-weighted vertex normals, preserving connectivity. With `u=(z-zmin)/(zmax-zmin)`, requested displacement is `0.75*(1+2*sin(pi*u)^2)` in numeric source mm, approximately 0.75–2.25 mm. This authored profile is not recovered from source scans or physiological thickness measurements. Sampled nearest-outer distances were approximately 0.6371–2.2409 mm, not identical to the requested normal offsets. No fairing or remeshing was used.

Bounded float64 checks found closed, consistently oriented surfaces, no inverted corresponding faces or forbidden self/inter-surface contacts, and passed a conservative 0.05 mm separation gate. These checks are not exact predicates or proof for every possible ray; strict runtime rejection remains active.

The two image models share acquisition rays: Cortex + core uses `0.04*shellLength + 0.008*coreLength`; Uniform uses `0.02*outerLength`. Both use `round(255*(1-exp(-attenuation)))`, with no exposure adjustment or per-frame normalisation. Default acquisition is zero pose; observer changes do not alter acquisition.

[`model-provenance.json`](model-provenance.json) binds the current model to exact asset hashes, source identity, transformation and licence. The repository reproduces projections from these input meshes; it does not include the anatomy/core authoring workspace.

## Historical: procedural v001

The following record describes only the original model and the preserved `evidence/bone-*.json` results, not current Femur.

`ftv-proximal-femur-left-v001` is a simplified procedural left proximal femur, distributed under the project's MIT licence. Its material boundaries are [`outer.obj`](../spikes/005-mesh-projection/assets/outer.obj) and [`core.obj`](../spikes/005-mesh-projection/assets/core.obj).

### Historical coordinates and topology

- Outer: 9,002 vertices, 18,000 triangles.
- Core: 8,002 vertices, 16,000 triangles.
- Numeric mm; identity export transform; right-handed +X left/lateral, +Y posterior, +Z superior.
- Head centre `[0,0,0]`; artificial outer distal cap at Z = −160 mm, core cap at Z = −158 mm.
- A nominal −2 mm core isovalue is not uniform measured cortical thickness.
- Outer sliver face 13960 is retained. Conservative degeneracies explicitly reject frames; no quiet face deletion or geometry repair.

The core is a separate enclosed material region, not an extra layer added on top of the outer volume. The renderer subtracts core path length from outer path length to obtain shell length. The artificial caps participate in ray intersection like every other face. See [mesh rendering](ARCHITECTURE.md) for integration and invalid-frame handling.

### Historical authoring method

Authoring metadata describes polynomial smooth minima of sphere/capsule signed distances, an outer isovalue of 0, a core isovalue of −2 mm and a distal cut plane. Marching tetrahedra produces the surfaces, followed by Blender decimation and world-space triangle OBJ export. The blend field is not an exact Euclidean distance near joins, and extraction/decimation adds approximation.

The metadata reports no external anatomy, donor scan or texture. These are synthetic shape parameters, not clinical reference measurements, and the model has not been anatomically validated. The repository reproduces projections from the exported meshes; it does not include their procedural generation source.

### Historical identity and provenance

[`legacy-model-provenance.json`](legacy-model-provenance.json) records the historical model identifier, exact asset hashes, parameters, authoring-reported versions, mesh counts and coordinate transform. Current runtime checks apply to the current pair; historical reproduction uses the separate v001 hashes. Treat a changed mesh as a new input: update its identity and provenance and rerun numerical verification rather than silently replacing either file.
