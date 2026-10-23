// Generated from pinned @sangeev/estate-ui; regenerate with publication/vendor-estate.py.
const ESTATE_UI_VERSION = "2.0.0-alpha.7";
const ESTATE_LAYOUT_VARIANTS = Object.freeze(["landing", "standard-app", "wide-app"]);

const ESTATE_THEME_STORAGE_KEY = "sangeevSiteTheme";
const THEME_KEY = ESTATE_THEME_STORAGE_KEY;
const VALID_THEMES = new Set(["light", "dark"]);

function readCookieTheme(cookie) {
  for (const part of String(cookie || "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== THEME_KEY) continue;
    try {
      const value = decodeURIComponent(rawValue.join("="));
      return VALID_THEMES.has(value) ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}

function resolveEstateTheme({ cookie = "", storageValue = null, prefersDark = false } = {}) {
  void prefersDark;
  return readCookieTheme(cookie) || (VALID_THEMES.has(storageValue) ? storageValue : null) || "dark";
}

function resolveEnvironmentTheme(environment) {
  const doc = environment.document;
  const win = environment.window || environment;
  if (!doc || !win) return "dark";
  let cookie = "";
  let storageValue = null;
  try {
    cookie = doc.cookie || "";
  } catch {
    cookie = "";
  }
  try {
    storageValue = win.localStorage?.getItem(ESTATE_THEME_STORAGE_KEY) ?? null;
  } catch {
    storageValue = null;
  }
  return resolveEstateTheme({
    cookie,
    storageValue,
    prefersDark: Boolean(win.matchMedia?.("(prefers-color-scheme: dark)")?.matches),
  });
}

function getAppliedEstateTheme(environment = globalThis) {
  const applied = environment.document?.documentElement?.dataset?.theme;
  return VALID_THEMES.has(applied) ? applied : resolveEnvironmentTheme(environment);
}

function applyEstateTheme(theme, environment = globalThis, persist = true) {
  const next = VALID_THEMES.has(theme) ? theme : "dark";
  const document = environment.document;
  const window = environment.window || environment;
  if (!document?.documentElement) return next;
  document.documentElement.dataset.theme = next;
  document.documentElement.dataset.estateUi = ESTATE_UI_VERSION;
  document.documentElement.classList.toggle("dark", next === "dark");
  document.documentElement.style.colorScheme = next;
  document.querySelector?.('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#061e1d" : "#d9eee9");
  if (persist) {
    try {
      window.localStorage?.setItem(THEME_KEY, next);
    } catch {
      // Theme persistence is optional; rendering still succeeds.
    }
    try {
      const cookie = [`${THEME_KEY}=${encodeURIComponent(next)}`, "Path=/", "SameSite=Lax", "Max-Age=31536000"];
      const hostname = window.location?.hostname || "";
      if (hostname === "sangeev.me" || hostname.endsWith(".sangeev.me")) cookie.push("Domain=.sangeev.me");
      if (window.location?.protocol === "https:") cookie.push("Secure");
      document.cookie = cookie.join("; ");
    } catch {
      // Cookie persistence is optional outside the hosted estate.
    }
  }
  return next;
}

function initialiseEstateTheme(environment = globalThis) {
  return applyEstateTheme(resolveEnvironmentTheme(environment), environment, false);
}


initialiseEstateTheme();
const estateButtonBodies={"dark": "<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z\"></path></svg><span>Light</span>", "light": "<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><path d=\"M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42\"></path></svg><span>Dark</span>"};
document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('.estate-theme-toggle');
  if (!button) return;
  function paint(theme) {
    button.innerHTML = estateButtonBodies[theme];
    button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  }
  paint(getAppliedEstateTheme());
  button.addEventListener('click', () => {
    paint(applyEstateTheme(getAppliedEstateTheme() === 'dark' ? 'light' : 'dark'));
  });
});
