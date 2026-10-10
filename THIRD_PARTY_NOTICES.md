# Third-party notices

## Three.js 0.186.0 (r186)

`demo/vendor/three-r186/` contains `three.module.js`, `three.core.js`, the exact upstream MIT `LICENSE` and `provenance.json` with version, upstream archive/commit and SHA-256 values. The licence belongs to the original Three.js contributors and is not replaced by this project's notice.

The static `demo/` distributable also contains `LICENSE.txt` for original work and `licences.html` linking both licence texts, so serving only that directory does not lose notices.

## Estate UI and fonts

`demo/vendor/estate-ui/` pins `@sangeev/estate-ui` 2.0.0-alpha.7 from archive SHA-256 `d062371402bb538c008888255597349d5cf7425d5bb51e399f7b3cf97b69ef76`. The exact CSS, package source, MIT licence and both font files are retained, with per-file hashes in `provenance.json`. The static header is rendered from that package; `estate-theme.js` contains its mechanically extracted framework-independent theme functions and a small DOM button adapter. React was used at authoring time only and is not bundled or required by the browser.

Literata and Atkinson Hyperlegible Next retain their verbatim SIL Open Font Licence texts under `demo/vendor/estate-ui/LICENSES/`. The browser licence page links both. No remote font service is used.

## NumPy (optional development dependency)

Numerical reproduction uses NumPy installed separately into the developer's own environment; it is not bundled. The pinned requirement is not a runtime requirement for the browser. Consult the installed NumPy distribution for its BSD licence and notices.

## BodyParts3D femur and derived core

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

`demo/mesh-spike/bp3d-cortex-v001/` contains the imported whole-femur outer surface and authored inward-offset core. These are not MIT assets. Redistribution relies on the [current publisher CC BY 4.0 grant](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html). The unchanged historical OBJ notice says CC Attribution-Share Alike 2.1 Japan; the publisher README also retains an old summary link despite its current CC BY 4.0 text. See [licence interpretation and changes](docs/BODYPARTS3D-LICENCE.md) and [exact provenance](docs/model-provenance.json). The served asset directory carries `LICENSE.md` and `PROVENANCE.json` so anatomy attribution accompanies a demo-only distribution.

## Original synthetic data

The primitive images, fixtures and frozen procedural bone exports are original synthetic project assets, under the root MIT licence. That historical procedural model’s authoring provenance reports no external anatomy, donor scan, downloaded model or texture; this does not describe the current Femur assets. Blender was an authoring tool, not a redistributed application or a browser dependency. Model generation source is outside this package; see `docs/MODEL.md`.
