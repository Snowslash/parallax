# Parallax

An interactive lab for learning how X-ray views relate to 3D geometry.

Built for junior trauma & orthopaedics trainees. Choose another view, compare projections and explore the geometry behind the image.

[Project page](https://parallax.sangeev.me/) · [Explore](demo/explore.html) · [Lessons](demo/lessons.html)

## Choose an experience

- **Femur:** Explore a whole-femur BodyParts3D model without a wire, or compare AP/lateral views of a preset wire in the separate CT-informed proximal-femur lesson. These are different bone models. Record a judgement and reason before revealing the wire. Model-defined views are not validated clinical projections.
- **Projection fundamentals:** Move the beam freely in 3D Explore, or work through three wire-position challenges in the Guided lesson.

Explore retains the two experiences above. Lessons also offers **[Guidewire across a fracture](demo/guidewire-fracture/index.html)**: compare AP with another saved angle, decide whether the wire enters the distal canal, then check in 3D. Existing `lab.html`, `mesh-spike.html`, `beam3d.html` and `guided.html` links remain available.

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

The guidewire lesson’s HFValid-derived femur and approximate canal use **CC BY 4.0**, not MIT: see [attribution and changes](docs/HFVALID-LICENCE.md). This is a third, separate bone model.

The femur lesson’s CT-derived proximal-femur surface, interior envelope and density use **CC BY 3.0**, not MIT: see [source attribution and changes](docs/CT-FEMUR-LICENCE.md) and [provenance](docs/ct-femur-provenance.json). The free explorer remains a separate BodyParts3D whole-femur model.

Original code and procedural teaching assets: [MIT](LICENSE). The BodyParts3D-derived femur and authored core use the publisher’s CC BY 4.0 grant, not MIT; see [anatomy attribution and the retained historical licence notice](docs/BODYPARTS3D-LICENCE.md). Bundled libraries and fonts retain [their own licences](THIRD_PARTY_NOTICES.md).
