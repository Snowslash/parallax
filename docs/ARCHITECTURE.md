# Architecture and geometry

Parallax is a static HTML/CSS/ES-module application. The guided lesson displays cached projections in image elements and draws its explanatory scene with Canvas 2D. 3D Explore and Femur compute projections in module workers and display them on Canvas 2D. Three.js draws the live modes' explanatory scenes, independently of the attenuation calculation.

| Page | Entry module | Projection source |
| --- | --- | --- |
| Guided lesson | [`guided.mjs`](../demo/guided.mjs) | PNGs and metadata in `demo/assets/v2/` |
| 3D Explore | [`beam3d.mjs`](../demo/beam3d.mjs) | Analytic finite-cylinder intersections in a worker |
| Femur | [`mesh-spike/app.mjs`](../demo/mesh-spike/app.mjs) | Triangle-mesh path integration in a worker |

Each page owns its in-memory state. Shared styling and the persisted theme preference are described in [Estate UI integration](ESTATE-UI.md).

`demo/index.html` is the public project page. Its Open lab action leads to `demo/lab.html`, the mode chooser. The existing `guided.html`, `beam3d.html` and `mesh-spike.html` URLs remain direct entrypoints; neither introductory page loads a lab renderer.

## Guided lesson: state and cached images

[`lesson-model.mjs`](../demo/lesson-model.mjs) is a pure reducer. It holds the current case, acquired angles, selected angle, displayed angle, pinned reference, prediction, judgement and reveal state. `guided.mjs` dispatches actions, loads images and updates the page.

The sequence is:

1. Initialise a case from its `initialAngles` in [`lesson.json`](../demo/assets/v2/lesson.json).
2. Select an unacquired angle and predict whether the wire end will separate from or overlap the outline, or choose “unsure”. Changing the selected angle clears that prediction.
3. Acquire the selected view. Acquisition records the prediction, adds the angle to `captured` and makes its cached frame the displayed image.
4. Compare acquired views. Viewing or pinning an image does not acquire another image. The reference and current image retain their own angle identities.
5. Choose a judgement and commit. `canCommit` requires at least one view beyond the case's initial set and a recognised judgement; it does not require a correct answer.
6. Reveal the wire and explore the linked scene and axial section. Further views can be acquired without making another prediction. Replay resets the current case; chapter navigation allows revisiting completed cases.

Before commitment, `scenePayload` supplies no tip and sets `wireVisible=false`; the entire wire is hidden. This is a presentation gate: the lesson JSON and projection images are already loaded client-side. After commitment, [`scene.mjs`](../demo/scene.mjs) and [`reveal.mjs`](../demo/reveal.mjs) draw the scene and section. Observer yaw/elevation only affect these drawings, not the cached projections.

The lesson manifest carries geometry-derived truth, a per-frame evidence class and source/image hashes. A frame's `beyond`, `borderline` or `overlap` class drives its explanation; matching the case's ground truth does not establish that the learner acquired sufficient evidence. The [guided generator](../spikes/002-guided-lessons/lessons.py) produces the images and metadata offline; there is no live guided renderer.

## Live acquisition coordinates

[`beam-geometry.mjs`](../demo/beam-geometry.mjs) defines a right-handed millimetre world. Angles are in degrees. At zero orbit and tilt, the source is on −Y, detector image-right is +X and image-up is +Z. Columns increase right and rows increase down.

Rig orientation is `Rz(orbit) Rx(tilt)`. Translation is along fixed world axes; it moves the source, pivot and detector together while leaving the object fixed. If `P` is the pivot and `f` the unit forward vector:

```text
source          = P − 800 f
detector centre = P + 400 f
```

The source–detector distance is 1200 mm. The source–pivot distance remains 800 mm; source–object distance changes when the rig translates.

For an `N × N` detector of width `F`, column `c` and row `r` sample the pixel centre:

```text
pixelMm = F / N
x = (c + 0.5 − N/2) × pixelMm
y = (N/2 − r − 0.5) × pixelMm
detector point = detector centre + x × right + y × up
```

Each ray is the finite segment from source to that detector point. `projectPoint` maps a scene point into detector pixel coordinates using the same finite-source perspective. Observer-camera position is not an input to either calculation.

## 3D Explore: rendering and frame state

`renderProjection` in [`beam-geometry.mjs`](../demo/beam-geometry.mjs) solves ray intervals through finite cylinders, clipping the radial quadratic by the end planes and source–detector segment. The object is a Z-axis hollow cylinder, 60 mm long, with inner/outer radii 10/12 mm. The wire runs from `[0,0,-18]` to `[0,15,18]` mm with radius 0.65 mm. The page requests 256² pixels over a 128 mm square field.

For each ray, the renderer subtracts the hollow interior and wire overlap from the shell path, then combines shell and wire attenuation. The coefficients are 0.08/mm for shell and 0.6/mm for wire. The wire replaces shell material where they overlap rather than being counted twice.

[`BeamController`](../demo/beam-controller.mjs) separates the requested pose (`staged`), displayed frame and pinned reference. `stage` copies the pose, assigns a sequence ID and starts a render only if another is not already running. While busy, newer requests replace the pending request; they do not cancel the running calculation. A completed stale result is discarded, then the newest request runs.

Before accepting a result, the controller checks pose and image dimensions. A frame contains its pose, camera, dimensions and pixels; the UI draws and labels that frame together. Errors leave the preceding frame visible with its original label. The first successful frame becomes the initial reference; `pin()` copies the current frame's pose and pixel buffer so later acquisitions cannot overwrite it.

`beam3d.mjs` keeps observer yaw, elevation and zoom outside the controller. “Look around” changes only [`RigView`](../demo/beam-view.mjs). Reset beam changes acquisition but preserves observer and pin; reset observer leaves acquisition alone. The worker transport checks response IDs and terminates the worker on a crash, unreadable response or 15-second timeout. Retry can create a replacement worker.

## Femur: mesh integration and worker lifecycle

[`mesh-spike/geometry.mjs`](../demo/mesh-spike/geometry.mjs) exposes `parseOBJ`, `buildMesh`, `integrateRay`, `meshCamera` and `renderMeshProjection`.

The worker loads two triangle meshes, verifies their SHA-256 hashes, parses them and builds a median-split triangle bounding-volume hierarchy for each. These structures are cached for the worker's lifetime. [`worker.mjs`](../demo/mesh-spike/worker.mjs) sends a copy of the outer surface to the explanatory scene; that Three.js surface is not used for ray integration. See [model data](MODEL.md) for asset coordinates and topology.

For each detector ray, the numerical path is:

1. Traverse each mesh's hierarchy to find triangle crossings along the line.
2. Sort and group crossing events, distinguish entry from exit, and clip the resulting intervals to the finite source–detector segment.
3. Require every core interval to lie within an outer interval. Compute `shellLength = outerLength − coreLength`.
4. Compute `attenuation = 0.04 × shellLength + 0.008 × coreLength`, with lengths in mm. Core material is counted once.

The initial pivot is `[24,7,-68]` mm. `meshCamera` uses the same rig transform as Explore but a 320 mm square field. The page offers 128² and 256² sampling without automatic resolution changes.

Coplanar/near-parallel boundaries, mixed-sign or coincident crossings and inconsistent nesting can produce unresolved rays. There is no ray perturbation or silent mesh repair. `renderMeshProjection` returns `invalidCount` and diagnostics; both the worker and [`MeshController`](../demo/mesh-spike/controller.mjs) reject a frame unless `invalidCount === 0`.

The controller coalesces synchronous changes in a microtask and retains only the latest requested pose/resolution while rendering. It checks pose, dimensions and validity before replacing the last accepted frame. Femur has no pinned-image or judgement state. Observer controls remain local to the scene.

[`transport.mjs`](../demo/mesh-spike/transport.mjs) permits one job at a time and validates response IDs. A worker crash, unreadable message or 30-second timeout terminates that worker and rejects the job. The displayed frame stays unchanged; retry can recreate the worker and reload its meshes.

## Image mapping and numerical checks

The renderers use the same fixed display rule in every view:

```text
grey = round(255 × (1 − exp(−attenuation)))
```

There is no per-image normalisation, alignment or warping. Detector pixels are point samples; changing resolution changes the ray set. The theme does not alter projection intensities.

The Python primitive implementation supports guided generation and independent 3D checks. The mesh evidence exporter records raw path lengths and images; a separate Python oracle compares triangle-plane/cross-product intersections and solid-angle containment. See [development](REPRODUCING.md) for commands and [verification and benchmarks](STATUS.md) for configurations and results.
