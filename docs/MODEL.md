# Femur model data

`ftv-proximal-femur-left-v001` is a simplified procedural left proximal femur, distributed under the project's MIT licence. Its material boundaries are [`outer.obj`](../demo/mesh-spike/assets/outer.obj) and [`core.obj`](../demo/mesh-spike/assets/core.obj).

## Coordinates and topology

- Outer: 9,002 vertices, 18,000 triangles.
- Core: 8,002 vertices, 16,000 triangles.
- Numeric mm; identity export transform; right-handed +X left/lateral, +Y posterior, +Z superior.
- Head centre `[0,0,0]`; artificial outer distal cap at Z = −160 mm, core cap at Z = −158 mm.
- A nominal −2 mm core isovalue is not uniform measured cortical thickness.
- Outer sliver face 13960 is retained. Conservative degeneracies explicitly reject frames; no quiet face deletion or geometry repair.

The core is a separate enclosed material region, not an extra layer added on top of the outer volume. The renderer subtracts core path length from outer path length to obtain shell length. The artificial caps participate in ray intersection like every other face. See [mesh rendering](ARCHITECTURE.md) for integration and invalid-frame handling.

## Authoring method

Authoring metadata describes polynomial smooth minima of sphere/capsule signed distances, an outer isovalue of 0, a core isovalue of −2 mm and a distal cut plane. Marching tetrahedra produces the surfaces, followed by Blender decimation and world-space triangle OBJ export. The blend field is not an exact Euclidean distance near joins, and extraction/decimation adds approximation.

The metadata reports no external anatomy, donor scan or texture. These are synthetic shape parameters, not clinical reference measurements, and the model has not been anatomically validated. The repository reproduces projections from the exported meshes; it does not include their procedural generation source.

## Identity and provenance

[`model-provenance.json`](model-provenance.json) records the model identifier, exact asset hashes, parameters, authoring-reported versions, mesh counts and coordinate transform. The runtime checks the asset hashes before loading the geometry. Treat a changed mesh as a new input: update its identity and provenance and rerun numerical verification rather than silently replacing either file.
