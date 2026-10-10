# Parallax

An interactive lab for learning how X-ray views relate to 3D geometry.

Built for junior trauma & orthopaedics trainees. Choose another view, compare projections and explore the geometry behind the image.

[Project page](https://parallax.sangeev.me/) · [Open lab](https://parallax.sangeev.me/lab.html)

## Explore

- **Guided lesson:** Work through three wire-position challenges, then compare your answer with the 3D view.
- **3D Explore:** Move the beam and compare projections while looking around the scene independently.
- **Femur:** Explore projections of a model femur. This mode is experimental.

## Run locally

With Python 3 installed, run this from the project folder:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory demo
```

Open **http://localhost:8000/** in a current browser. On Windows, you may need `py -3` instead of `python`. No build or package installation is needed.

## Documentation

- [Technical notes and development](docs/REPRODUCING.md)
- [Contributing](CONTRIBUTING.md)

For teaching and exploration, not clinical use. See [limitations](docs/SAFETY.md).

## Licence

Original code and procedural teaching assets: [MIT](LICENSE). The BodyParts3D-derived femur and authored core use the publisher’s CC BY 4.0 grant, not MIT; see [anatomy attribution and the retained historical licence notice](docs/BODYPARTS3D-LICENCE.md). Bundled libraries and fonts retain [their own licences](THIRD_PARTY_NOTICES.md).
