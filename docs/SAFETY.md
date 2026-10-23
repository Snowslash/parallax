# Safety and limitations

Parallax is a synthetic teaching prototype, not a medical device, diagnostic aid, navigation system, planning system or competence assessment. It must not be used to make patient-specific decisions.

## Interpretation boundary

- A projected overlap is not proof of three-dimensional containment.
- Authored “contained”/“breached” answers describe finite-thickness distal wire geometry in simplified cylinders, not the entire wire or a patient.
- No specific angle or pair of reassuring projections guarantees clinical safety.
- The reveal supplies additional geometric knowledge. It does not imply that the acquired images alone establish that knowledge.
- Learning effectiveness, transfer to clinical practice and competence measurement are untested.

## Model boundary

The cylinder/wire, core boundary and attenuation coefficients are authored teaching approximations; the current femur outer surface is imported BodyParts3D anatomy. There are no patient inputs, image imports, real fluoroscopy, soft tissue, energy spectrum, scatter, noise or calibrated radiology. Point-sampled detector pixels can alias or shimmer. Three.js scenes are explanatory surface renderings, not the attenuation computation.

The current femur retains the whole BodyParts3D source bone with an illustrative inward-offset core, not a recovered tissue segmentation. Source physical-mm calibration and anatomical orientation have not been independently verified. Requested normal offsets are not measured cortical thickness. The old procedural model’s negative isovalue and artificial distal cap apply only to historical v001 reproduction. Out-of-field cropping is not auto-corrected.

Conservative mesh intersection degeneracies can reject a frame. The UI retains the last valid image with its original pose; it must not imply that an old image belongs to a newly requested pose. Zero unresolved pixels in sampled frames does not prove all continuous poses are valid.

## Privacy boundary

There are no accounts, analytics, uploads, patient inputs or persisted learner answers. Progress is page-local; the colour-theme preference is stored in a cookie and local storage. Browser caches and static-server request logs are ordinary browser/hosting behaviour, not a promise of anonymity. Do not add patient-identifiable data to screenshots, issues, fixtures or contributions.

## Known status

Numerical agreement, browser responsiveness, model appearance and educational effectiveness are separate claims. See [verification and benchmarks](STATUS.md) for measured results and test coverage.

## Guidewire across a fracture

The guidewire lesson uses a separate HFValid-derived outer surface and approximate central-shaft canal with artificial caps. The 16 mm gap, 10 mm posterior distal shift and straight finite capsule/olive wire are authored approximations. They do not represent a full instrument or entry route. A saved non-AP view permits a decision but does not certify sufficient evidence; model truth is not clinical safety. Anatomy, clinical views and learner effectiveness remain unvalidated. See [the lesson contract](GUIDEWIRE-FRACTURE.md) and [HFValid attribution](HFVALID-LICENCE.md).
