# Technical notes and development

Run commands from the repository root. See [architecture](ARCHITECTURE.md) for state flow and rendering, [model data](MODEL.md) for mesh coordinates and [benchmarks](STATUS.md) for measured results.

## Running the app

The app is static HTML/CSS/ES modules with local assets. Serve it with:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory demo
```

Open `http://localhost:8000`. Stop the server with Ctrl+C. No build step or application backend is required.

Use a current browser with ES modules and module workers. WebGL enables the live modes' explanatory 3D scenes; if those scenes cannot initialise, the controls and computed projections still work. The guided lesson uses Canvas 2D and image elements.

Open the app through HTTP on localhost or HTTPS on a remote host, not `file://`. The Femur loader uses Web Crypto to check model hashes, which requires a secure context; browsers treat localhost as secure.

Refreshing or switching pages resets lesson progress and beam state. Only the [colour-theme preference](ESTATE-UI.md) persists.

## Development environment

Development checks use Node 22+ and Python 3.12+. The default suite needs no Python package. Independent numerical checks additionally use the pinned NumPy dependency in an isolated environment:

```sh
python -m venv .venv
# Activate .venv for your shell, then:
python -m pip install -r requirements-numerical.txt
```

The pinned NumPy release requires Python >=3.12. The numerical checks have been run with Node 22.23.3, Python 3.14.7 and NumPy 2.5.0 on Linux. These tools are not browser-runtime dependencies.

## Repository layout

| Path | Contents |
| --- | --- |
| `demo/` | Pages, browser modules, image/model assets and bundled dependencies |
| `demo/tests/` | Node tests and browser QA modules |
| `spikes/001-projection-geometry/` | Primitive ray integration and projection checks |
| `spikes/002-guided-lessons/` | Guided-case generation and cached-image evidence |
| `spikes/004-3d-beam/` | Independent checks of 3D acquisition geometry |
| `spikes/005-mesh-projection/` | Mesh fixtures, raw-frame export and independent oracle |
| `evidence/` | Recorded numerical and browser measurements |
| `scripts/check.py` | Integrity, link and test runner |
| `MANIFEST.json` | File inventory and SHA-256 snapshot |

## Quick checks

```sh
python scripts/check.py
```

This checks file hashes, local Markdown links, navigation/resources, dependency and model identity, Node behaviour/geometry tests and analytic mesh evidence tests. It also scans for a limited set of private-path and credential patterns.

After editing tracked snapshot files, use:

```sh
python scripts/check.py --skip-snapshot
```

This skips the snapshot comparison, not the link, asset or functional tests. Geometry changes still need new independent numerical evidence.

## Cloudflare Pages routing checks

Cloudflare Pages serves `demo/` without a build. Its native clean-URL handling maps `/lab`, `/guided`, `/beam3d`, `/mesh-spike` and `/licences` to their HTML documents; `.html` aliases redirect to those routes and `/index.html` redirects to `/`. Keep the top-level `404.html`: it disables Pages' implicit homepage fallback for unknown paths, including missing assets. Its links and resources are root-relative so nested missing URLs work.

`robots.txt` allows crawling and points to the XML sitemap. The sitemap lists only the landing root. This is not a noindex policy for lab or experimental pages; their indexing policy has not been changed.

Python's simple HTTP server remains suitable for app use through `.html` links, but does not emulate Pages clean URLs. With an already available Wrangler installation, start a **local** Pages preview on loopback, using a compatibility date supported by its cached workerd binary, then run:

```sh
python -B scripts/check-pages-routing.py --base http://127.0.0.1:9315
```

The check validates crawl-file MIME types and bodies, parses the landing-only sitemap, checks true 404s, clean URLs and query-preserving aliases, and compares every other published demo resource against local bytes. It accepts loopback URLs only. This is local emulation, not proof of deployed Cloudflare behaviour; deployment and live acceptance are separate gates.

## Independent numerical checks

```sh
python scripts/check.py --numerical
```

This adds primitive unit tests, guided geometry/export tests, the 3D cross-language/occupancy verifier, bone raw-data export, an independent mesh oracle and raw-array/PNG readback tests. It writes ignored `results/` and `outputs/` directories under `spikes/`; recorded measurements in `evidence/` are not overwritten. It neither installs packages nor contacts the network. Combine `--numerical` with `--skip-snapshot` when testing intentional source edits.

Equivalent individual commands:

```sh
python -B -m unittest discover -s spikes/001-projection-geometry -p test_geometry.py -v
python -B -m unittest discover -s spikes/002-guided-lessons -p 'test_*.py' -v
python -B -m unittest discover -s spikes/004-3d-beam -p 'test_*.py' -v
node spikes/005-mesh-projection/export-evidence.mjs
python -B spikes/005-mesh-projection/independent_reference.py
python -B -m unittest discover -s spikes/005-mesh-projection -p 'test_*.py' -v
```

## Regenerating guided images

```sh
python -B spikes/002-guided-lessons/lessons.py
```

This rewrites `demo/assets/v2/` and the guided numerical outputs. It also regenerates lesson text in `lesson.json`, so review prompts and feedback as well as images. The manifest binds each PNG to its hash and the numerical source, `raw.npz` and `geometry.json`; keep those files together when updating the generated data.

The Femur OBJ files are inputs rather than generated outputs of this repository. Their authoring method, coordinates and hashes are documented in [model data](MODEL.md).

## Browser checks

With the app served as above, open each page and run its module in DevTools:

```js
// On guided.html
await (await import('./tests/guided-browser.mjs')).run()
// On beam3d.html
await (await import('./tests/beam-browser.mjs')).run()
// On mesh-spike.html
await (await import('./tests/mesh-spike-browser.mjs')).run()
```

`mesh-spike-browser.mjs` also exports `workerFailure()`, `imageAgreement()`, `measure(128)`, `measure(256)` and `coldLoads()`. Save the returned objects with the browser, viewport and hardware details when comparing performance.

For layout, theme, font and contrast checks on any page:

```js
await (await import('./tests/estate-browser.mjs')).audit()
```

These checks change controls, themes or acquired frames; reload afterwards. A narrow iframe exercises layout but does not replace testing on a physical touch device. `coldLoads()` creates fresh documents/workers without clearing browser or network caches.

## Integrity snapshot

`MANIFEST.json` records the distributed files and excludes itself. The checker rejects missing, modified and unexpected files, with exceptions for generated numerical outputs and development directories. `--skip-snapshot` is for an edited checkout; it does not establish agreement with the distributed snapshot. The checker verifies the manifest but does not rewrite it.
