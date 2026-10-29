# Parallax

An interactive lab for learning how X-ray views relate to 3D geometry.

Built for junior trauma & orthopaedics trainees. Choose another view, compare projections and explore the geometry behind the image.

[Project page](demo/index.html) · [Lessons](demo/lessons.html)

## Two learning tasks

- **[Guidewire across a fracture](demo/guidewire-fracture/index.html):** compare AP with another saved angle and decide whether the wire enters the distal canal, then check in 3D.
- **[Femoral wire position](demo/femur-lesson.html):** acquire AP and lateral views, measure the planned tip position against the exercise criteria and explain your judgement before revealing the wire.

Both use an image-first workspace: current X-ray and C-arm controls, saved views, 3D context and an answer/reveal. Their model-specific evidence and answer requirements are unchanged. They use different anatomical assets; neither is a different view of the other's bone.

Earlier projection-fundamentals and whole-femur experiments remain in the [archive](demo/explore.html), including the diagonal-breach challenge. Existing deep links work. The archive is not part of the current lesson sequence. See [the consolidation notes](docs/CONSOLIDATION.md).

## Run locally

With Python 3 installed, run this from the project folder:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory demo
```

Open **http://localhost:8000/** in a current browser. On Windows, you may need `py -3` instead of `python`. No build or package installation is needed.

## Documentation

- [Technical notes and development](docs/REPRODUCING.md)
- [Guidewire lesson geometry and limitations](docs/GUIDEWIRE-FRACTURE.md)
- [Contributing](CONTRIBUTING.md)

For teaching and exploration, not clinical use. See [limitations](docs/SAFETY.md).

## Licence

The guidewire lesson’s HFValid-derived femur and approximate canal use **CC BY 4.0**, not MIT: see [attribution and changes](docs/HFVALID-LICENCE.md). This model is separate from the proximal-femur lesson and archived whole-femur explorer.

The femur lesson’s CT-derived proximal-femur surface, interior envelope and density use **CC BY 3.0**, not MIT: see [source attribution and changes](docs/CT-FEMUR-LICENCE.md) and [provenance](docs/ct-femur-provenance.json). The archived explorer remains a separate BodyParts3D whole-femur model.

Original code and procedural teaching assets: [MIT](LICENSE). The BodyParts3D-derived femur and authored core use the publisher’s CC BY 4.0 grant, not MIT; see [anatomy attribution and the retained historical licence notice](docs/BODYPARTS3D-LICENCE.md). Bundled libraries and fonts retain [their own licences](THIRD_PARTY_NOTICES.md).
