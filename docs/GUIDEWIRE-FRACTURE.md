# Guidewire across a fracture

[Start the lesson](../demo/guidewire-fracture/index.html). Compare the pinned AP with another angle, move the C-arm, save a view and decide whether the wire enters the distal canal. Commit an answer before checking the wire in 3D.

## Model and scope

This is a separate HFValid-derived femur model, not the BodyParts3D whole-femur explorer or Utah-derived proximal-femur lesson. [Attribution](HFVALID-LICENCE.md) and [provenance](guidewire-fracture-provenance.json) describe its CC BY 4.0 anatomy.

The approximate central-shaft canal spans 107 source slice centres over 212 mm. Source voxel spacing is 0.585938 × 0.585938 × 2 mm, with reported slice thickness 2.5 mm and publisher interpolation. A 500-stored-unit threshold is a modelling choice, not a calibrated tissue boundary. Its artificial end caps are numerical closures at source Z −376.25 and −162.25 mm, not anatomical canal ends. Full proximal and distal medullary spaces are not modelled.

World coordinates are right-handed millimetres: X lateral, Y proximal, Z anterior. The fracture removes −8 < Y < 8, making a 16 mm gap; the distal fragment moves 10 mm posteriorly (Z −10). The wire is a fixed straight higher-start local segment from Y=72 to an olive centre at Y=−50. A collinear interior point at Y=60 preserves the original segment representation. The finite capsule union has radius 1.25 mm; the spherical olive radius is 2.25 mm. It is not a complete instrument, insertion simulation, flexible-wire model or proximal entry route.

One preset enters the distal modelled canal; the other exits the fracture opening and misses anterior to the distal fragment. Missing entry is not a newly created perforation through intact cortex. Model-relative geometry does not establish biological clearance or procedural safety.

## Acquisition and decision state

The initial AP is a verified cached projection. Arbitrary orbital rotation and ±60° angulation use an illustrative finite-source worker renderer, not clinical fluoroscopy. The source–pivot distance is 800 mm, source–detector distance 1200 mm and detector field 210 mm at 320² samples. AP source is anterior; lateral source is lateral; image up is proximal before optional display rotation. These are model references, not clinically validated views. The renderer uses fixed intensity mapping, no per-image normalization, and no soft tissue, scatter, spectrum or detector noise.

Requested pose, displayed frame, pinned AP and saved additional image are separate. Only a valid current matching frame can be saved; pending/error states block saving and commitment. A non-AP saved view is an interaction gate, not proof of adequate evidence. The learner may answer entered, missed or uncertain. No wire is shown in the 3D scene before commitment. Looking around and rotating the displayed image do not change acquisition geometry; restart or case change clears additional evidence and hides the wire.

## Verification boundary

Source integrity, finite model geometry, numerical projection agreement and browser behaviour are separate from anatomical review and learner validation. No clinical accuracy, teaching-effectiveness or competence claim is made. No angle or reassuring pair guarantees clinical safety. See [safety](SAFETY.md) and [reproduction](REPRODUCING.md). Raw CT, source archives and source segmentation tooling are not bundled; the supplied derived meshes and runtime are the reproducible public inputs.
