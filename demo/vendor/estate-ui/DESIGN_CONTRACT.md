# Estate design contract

## Selected language

- Evidence Window: bounded evidence and content-honesty posture.
- Drenched Atlas light / Deep Atlas dark: teal surfaces, theme-aware evidence panels and unchanged `#ff7a66` coral. Dark working surfaces are never forced pale.
- Field Ledger: Literata identity/headings and Atkinson Hyperlegible Next body/UI.

## Shared invariants

- exact tokens, font files and licence texts;
- header, theme control and cross-subdomain theme persistence;
- focus ring, target floor and reduced-motion behavior;
- title and section-heading roles;
- registration rule, safety boundary, evidence frame and primary-action geometry;
- named shell variants rather than local width values.

## Header navigation

`PublicEstateHeader` defaults to `navigation="full"`: Projects, Op notes, Scratchpad, AlignEd and GitHub. The opt-in `navigation="projects"` mode renders only Projects and GitHub; the main site alone selects it. Both modes retain the same wordmark, theme control, full-bleed chrome, inner rail, focus and responsive geometry. Filtering occurs during React rendering, not CSS hiding or DOM surgery. Per-site audit expectations are recorded in `estate.manifest.json`.

## Named layouts

- `landing`: project index and static project-note pages; standard 1180px rail.
- `standard-app`: normal functional tools; standard 1180px rail with app title scale.
- `wide-app`: dense functional tools such as AlignEd; 1480px rail with the same chrome and app title scale.

## Non-goals

The package does not own forms, workflow stages, cards, records, generated clinical text, persistence or application state. Those remain in their canonical repositories.
