# Estate UI integration

The shared styling uses `@sangeev/estate-ui` **2.0.0-alpha.7**, archive SHA-256 `d062371402bb538c008888255597349d5cf7425d5bb51e399f7b3cf97b69ef76`.

## Files and responsibilities

- The package owns the exact CSS, tokens, Literata/Atkinson fonts, theme preference, header, focus treatment, reduced-motion contract and named shell geometry. Its files and licences are under `demo/vendor/estate-ui/`, bound by `provenance.json`.
- The static header uses the package's `PublicEstateHeader` with `navigation="projects"` and sits outside the application shell on every page.
- Home and licences use `landing`; the three labs use `wide-app`. App controls and dense subheadings are local composition. The package's named page/section titles are not restyled.
- `publication.css` owns page composition and bounded UI motion. `lab.css` owns functional lab layout. Neither redefines package tokens or shared chrome. Scientific image wells and geometry-key colours deliberately remain fixed in both themes.

## Static adapter

The pages contain static HTML for the package's `PublicEstateHeader`. The browser does not load React or run a build step. [`estate-theme.js`](../demo/estate-theme.js) contains the package's framework-independent theme functions and a DOM adapter for the theme button. The upstream [`src/index.js`](../demo/vendor/estate-ui/src/index.js) is included as a reference, not imported by the browser. Tests compare the extracted function text against it.

The adapter's generator header is a source-provenance comment; that generator is not included. Changes to local layout belong in `publication.css` or `lab.css`, not in the vendored package. A dependency update must keep the header markup, theme functions, CSS, fonts and provenance hashes consistent.

## Theme state

The adapter applies `data-theme`, the `dark` class and CSS `color-scheme` to the document root. Initial selection is:

1. A valid `sangeevSiteTheme` cookie.
2. A valid value under the same local-storage key.
3. Dark mode.

Only `light` and `dark` are accepted; system colour preference does not override this order. Initialisation reads the preference without persisting a new one. Toggling writes both storage and a one-year `SameSite=Lax` cookie. HTTPS adds `Secure`; hosts on `sangeev.me` use `Domain=.sangeev.me`, while other hosts use a host-only cookie. Storage failures do not prevent the theme from changing.

## Images and motion

Motion is limited to short text entrances, disclosure/reveal text and control feedback. Acquisition canvases and projection images are never animated, blended, filtered or normalised by the theme. Reduced-motion preferences remove non-essential animation. Palette changes are immediate to avoid transient contrast failures.

## Tests

[`estate.test.mjs`](../demo/tests/estate.test.mjs) checks artifact identity, wiring, cookie precedence, malformed/denied storage, persistence scope, reduced-motion rules and lab-load failure isolation. [`estate-browser.mjs`](../demo/tests/estate-browser.mjs) checks rendered layout, fonts, labels, contrast, control sizes and motion. Run them using the [development instructions](REPRODUCING.md).
