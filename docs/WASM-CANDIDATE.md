# Opt-in guidewire Wasm candidate

**Retain JavaScript as default. This is a local candidate, not an adopted engine or a deployment.** Only *Guidewire across a fracture* has an alternative engine. *Femoral wire position*, both lessons' model/lesson assets, the shared estate pin and production response headers are unchanged.

## Run and roll back

The shipped binary needs no Rust installation. With Node 22+:

```sh
node scripts/wasm/preview.mjs --wasm-csp
```

Open the printed loopback URL ending in `/guidewire-fracture/?engine=wasm`. Without that query, the real application worker uses JavaScript and does not fetch the Wasm binary. Removing the query and reloading is the rollback; no saved preference or automatic engine selection is written. Ctrl-C stops the disposable preview.

Run `node scripts/wasm/preview.mjs` **without** `--wasm-csp` to apply the existing strict policy. Even with `?engine=wasm`, compilation is then rejected and the same request renders through JavaScript. The exact local-only policy delta is adding `'wasm-unsafe-eval'` to `script-src` for `/guidewire-fracture/` responses. No `'unsafe-eval'`, external origin or production `_headers` change is needed or permitted by this candidate. Python's basic HTTP server does not emulate the production CSP.

After a computed frame, inspect `window.guidewireLesson.getState().engine` in DevTools: `requested`, `active`, `fallbackReason`, setup timings, Wasm linear-memory capacity and whether prepared JS geometry remains owned. This describes the accepted displayed frame, not a pending request. Initial AP is a pinned PNG, not a computed Wasm frame, so its engine is `null`. No benchmark or diagnostic is sent off-device.

## Ownership and failure paths

- `transport.mjs` owns one lazy Worker, debounce and deadline. `state.mjs` still decides whether a case/pose/request is acceptable; `app.mjs` still owns DOM and canvas rendering. Reset terminates the old Worker; late messages cannot cancel a replacement's timeout. Retry **already replaced the Worker before this refactor** and continues to do so.
- `worker-core.mjs` owns verified initialization and an engine. Lesson/model identity, size/case/pose checks and zero-invalid-ray acceptance remain mandatory. Cancellation aborts asset loads and suppresses late delivery. A kernel call succeeding does not bypass frame acceptance.
- `engine.mjs` defaults to the unchanged JS kernel. Wasm load, compilation, setup or runtime exceptions become explicitly reported JS fallback. A runtime fallback re-fetches/re-verifies and rebuilds the JS geometry after its earlier release; a model integrity failure is still fatal. Invalid-ray results are errors, not successful fallback frames.
- The adapter writes the unchanged JS-prepared triangles/BVH directly into final Rust storage. It adds no new geometry algorithm, flattening array or second Wasm staging copy. After successful upload the engine drops prepared JS meshes. Rust retains f64 arithmetic, traversal/tie ordering and one whole-frame numerical call.
- Returned pixels/raw arrays are independent copies. The Wasm instance owns reusable calculation buffers; disposal frees Rust allocations and drops the JS instance reference. Wasm linear-memory capacity cannot shrink, and process RSS need not immediately return to the OS.
- Exceptional invalid diagnostics reconstruct the reference-shaped mesh from final Wasm storage and use the unchanged JS diagnostic calculation. Full reason/face/crossing/interval/ray details are compared against the strict reference. This rare path temporarily allocates JS diagnostic geometry; it is not used for headline warm valid-frame timing.

## Build

The crate has no external Cargo dependencies. Use a Rust 1.99.1 compiler with the `wasm32-unknown-unknown` standard library already installed; do not silently install/update a shared toolchain. Set `RUSTC` to that compiler, put its matching Cargo on `PATH`, and provide a fresh project-local `CARGO_TARGET_DIR` plus an isolated `CARGO_HOME`:

```sh
sh wasm/guidewire/build.sh
```

The script uses `--offline --locked --jobs 1`, release f64 code, no fast-math and no enabled SIMD campaign. It writes the binary and its SHA-256 identity. Release symbols are stripped: otherwise Cargo's checkout-dependent custom symbol names produce different full-file hashes. Independent source/target-directory builds must produce identical full binaries; all non-custom Wasm sections must remain identical when validating a symbol-only packaging change. The accompanying Rust library licence inventory is intentionally broader than the code linked into the binary.

## Checks and measurements

Run from the repository root under an appropriate finite process-tree resource guard, not merely a Node heap flag. The implementation evidence used a disposable Linux user cgroup **outside** the shared gateway: 3 GiB hard / 2 GiB high memory, zero swap, 150% CPU, 128 tasks and a finite deadline, requiring 6 GiB currently available host memory. Commands and descendants were verified inside it. Heavy jobs are serial.

```sh
python -B scripts/check.py --numerical
# Intentional source edits only: add --skip-snapshot
node --test --test-concurrency=1 demo/tests/guidewire-worker.test.mjs demo/tests/guidewire-engine.test.mjs demo/tests/guidewire-transport.test.mjs
node --test --test-concurrency=1 demo/tests/guidewire-wasm.test.mjs scripts/wasm/compare-frames.test.mjs
node --expose-gc scripts/wasm/memory.mjs js fresh-js.json
node --expose-gc scripts/wasm/memory.mjs wasm fresh-wasm.json
node --expose-gc scripts/wasm/memory.mjs fallback fresh-fallback.json
```

For the real browser smoke, set `PLAYWRIGHT_MODULE` to an existing compatible Playwright module directory and `CHROMIUM` to an existing Chromium executable. Nothing installs packages. Use a **fresh** output directory/file for each command:

```sh
node demo/tests/guidewire-app-browser.mjs fresh-app-evidence
node scripts/wasm/browser-measure.mjs fresh-browser-a.json compare forward
node scripts/wasm/browser-measure.mjs fresh-browser-b.json compare reverse
node scripts/wasm/browser-measure.mjs fresh-browser-memory-js.json memory-js
node scripts/wasm/browser-measure.mjs fresh-browser-memory-wasm.json memory-wasm
```

`browser-measure.mjs` reads Linux cgroup process membership to sample browser-tree RSS. It must run in a disposable cgroup containing only this workload. Shared RSS pages may be counted more than once; sampled peaks are lower bounds. Node forced-GC heap/array-buffer/external readings, process high-water RSS and Wasm capacity are separate measures. Fresh workers are **not** cache-cleared network starts. Double-rAF is a presentation proxy, not photon latency. Timings use the actual application worker; complete raw comparisons run separately through a test-only worker.

The fixed numerical gate is exact RGBA, validity and invalid coordinates; every raw channel must satisfy `abs(candidate-reference) <= 1e-9 + 1e-12*abs(reference)` with matching NaNs. Tests retain eight distinct shipped case/pose combinations, four asymmetric/translated-camera frames, analytic and invalid-nesting fixtures, ownership and complete diagnostics. No tolerance was weakened. Repetitions are not new scenarios.

The aggregate runner is serial and includes the comparator's negative controls. The unchanged femur test previously retained sixteen cache-busted module instances and their meshes; its failure/retry fixtures now run in disposable Node isolates with all integrity assertions and six exact-pixel references retained. No femur production code changed.

## Adoption decision

The desktop candidate delivers a measured end-to-end benefit and removes the prototype's large memory duplication, but remaining memory variation must stay visible, including any repeat exceeding the predeclared 10% criterion. Do not promote it on a favourable median alone. Full measurements, failed attempts, exact source/harness hashes and local build/containment receipts belong to the implementation handoff.

Physical iPhone/Safari performance, memory, thermal behaviour and touch use remain **pending**. A narrow Chromium viewport is layout evidence only. Neither numerical parity nor faster rendering establishes anatomical, perceptual, learner or clinical validity. Leave JavaScript default until the owner reviews memory/startup trade-offs and obtains the missing device evidence.
