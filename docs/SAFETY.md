# Safety and limitations

Parallax is a synthetic teaching prototype, not a medical device, diagnostic aid, navigation system, planning system or competence assessment. It must not be used to make patient-specific decisions.

## Interpretation boundary

- A projected overlap is not proof of three-dimensional containment.
- Authored “contained”/“breached” answers describe finite-thickness distal wire geometry in simplified cylinders, not the entire wire or a patient.
- No specific angle or pair of reassuring projections guarantees clinical safety.
- The reveal supplies additional geometric knowledge. It does not imply that the acquired images alone establish that knowledge.
- Learning effectiveness, transfer to clinical practice and competence measurement are untested.

## Model boundary

All objects and coefficients are synthetic. There is no patient data, image import, real fluoroscopy, soft tissue, energy spectrum, scatter, noise or calibrated radiology. Point-sampled detector pixels can alias or shimmer. Three.js scenes are explanatory surface renderings, not the attenuation computation.

The bone model is a simplified procedural shape whose proportions have not been anatomically validated. A negative field isovalue does not guarantee uniform cortical thickness. The artificial distal cap remains real material in the computation. Out-of-field cropping is not auto-corrected.

Conservative mesh intersection degeneracies can reject a frame. The UI retains the last valid image with its original pose; it must not imply that an old image belongs to a newly requested pose. Zero unresolved pixels in sampled frames does not prove all continuous poses are valid.

## Privacy boundary

There are no accounts, analytics, uploads, patient inputs or persisted learner answers. Progress is page-local; the colour-theme preference is stored in a cookie and local storage. Browser caches and static-server request logs are ordinary browser/hosting behaviour, not a promise of anonymity. Do not add patient-identifiable data to screenshots, issues, fixtures or contributions.

## Known status

Numerical agreement, browser responsiveness, model appearance and educational effectiveness are separate claims. See [verification and benchmarks](STATUS.md) for measured results and test coverage.
