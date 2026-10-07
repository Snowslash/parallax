# Contributing

Read [architecture](docs/ARCHITECTURE.md) for the state and rendering model, [development](docs/REPRODUCING.md) for commands and [limitations](docs/SAFETY.md) for the project's intended use.

- Keep changes small. Write a failing test before a geometry or state change, then run the applicable suites.
- Preserve acquisition/observer separation, full image-pose correspondence, last-valid-frame semantics and the guided entire-wire reveal gate.
- Use finite-source geometry with explicit mm units, axes, pixel centres and fixed material/display mapping.
- Check numerical changes against independent formulations and asymmetric fixtures. Do not turn numerical agreement into a clinical accuracy claim.
- Do not add patient data, uploads, clinical recommendations, anatomical downloads or real device control.
- Do not repair or replace frozen v001 assets silently. A model revision needs separate identity/provenance and review.
- Keep raw arrays, fixed configurations, measurements and failure disclosures together. State browser/device and sampling method for performance results.
- Keep third-party notices and synthetic asset attribution intact.

After editing, run `python scripts/check.py --skip-snapshot`; for numerical changes, also run `python scripts/check.py --skip-snapshot --numerical` with the optional NumPy dependency installed. Test changed pages in a browser. Keep the source, generated images, geometry metadata and their hashes consistent.

Include a reproduction command, expected/observed behaviour and relevant test output with a bug report or change. For rendering or performance issues, include the acquisition pose, resolution, browser and device. Do not submit private paths, hosts, credentials or operational records.
