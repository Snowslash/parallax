import { createElement, useEffect, useRef, useState } from "react";

export const ESTATE_UI_VERSION = "2.0.0-alpha.7";
export const ESTATE_LAYOUT_VARIANTS = Object.freeze(["landing", "standard-app", "wide-app"]);

export const ESTATE_THEME_STORAGE_KEY = "sangeevSiteTheme";
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

export function resolveEstateTheme({ cookie = "", storageValue = null, prefersDark = false } = {}) {
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

export function getAppliedEstateTheme(environment = globalThis) {
  const applied = environment.document?.documentElement?.dataset?.theme;
  return VALID_THEMES.has(applied) ? applied : resolveEnvironmentTheme(environment);
}

export function applyEstateTheme(theme, environment = globalThis, persist = true) {
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

export function initialiseEstateTheme(environment = globalThis) {
  return applyEstateTheme(resolveEnvironmentTheme(environment), environment, false);
}

export function useEstateTheme() {
  const [theme, setTheme] = useState(() => getAppliedEstateTheme());
  const initialRender = useRef(true);
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    applyEstateTheme(theme);
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };
  return { theme, toggleTheme };
}

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function themeIcon(isDark) {
  return createElement(
    "svg",
    { "aria-hidden": "true", viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 2 },
    isDark
      ? createElement("path", { d: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z" })
      : [
          createElement("circle", { key: "c", cx: 12, cy: 12, r: 4 }),
          createElement("path", { key: "p", d: "M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" }),
        ],
  );
}

export function GitHubMark({ size = 18, className = "" } = {}) {
  return createElement(
    "svg",
    {
      className: joinClasses("estate-github-mark", className),
      "aria-hidden": "true",
      focusable: "false",
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "currentColor",
    },
    createElement("path", { d: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.084-.729.084-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.435.372.81 1.102.81 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297 24 5.67 18.627.297 12 .297z" }),
  );
}

export function ThemeToggle({ theme, onToggle, className = "" }) {
  const isDark = theme === "dark";
  return createElement(
    "button",
    {
      type: "button",
      className: joinClasses("estate-theme-toggle", className),
      "aria-label": `Switch to ${isDark ? "light" : "dark"} mode`,
      "aria-pressed": isDark,
      onClick: onToggle,
    },
    themeIcon(isDark),
    createElement("span", null, isDark ? "Light" : "Dark"),
  );
}

const links = [
  { page: "home", label: "Projects", href: "https://sangeev.me/#projects" },
  { page: "opnotes", label: "Op notes", href: "https://opnotes.sangeev.me" },
  { page: "scratchpad", label: "Scratchpad", href: "https://scratchpad.sangeev.me" },
  { page: "aligned", label: "AlignEd", href: "https://aligned.sangeev.me" },
  { page: "github", label: "GitHub", href: "https://github.com/Snowslash" },
];

export function PublicEstateHeader({ current, theme, onToggleTheme, className = "", navigation = "full" }) {
  return createElement(
    "header",
    { className: joinClasses("estate-site-header", className), "data-estate-ui": ESTATE_UI_VERSION, "data-print-hidden": true },
    createElement(
      "div",
      { className: "estate-site-header__inner" },
      createElement(
        "a",
        { className: "estate-wordmark", href: "https://sangeev.me", "aria-current": current === "home" ? "page" : undefined },
        "Sangeev",
        createElement("span", { className: "estate-wordmark__suffix" }, ".me"),
      ),
      createElement(
        "nav",
        { "aria-label": "Primary navigation" },
        links.filter((link) => navigation !== "projects" || link.page === "home" || link.page === "github").map((link) => link.page === "github"
          ? createElement("a", { key: link.page, href: link.href, className: "estate-github-link", "aria-label": "GitHub", title: "GitHub" }, createElement(GitHubMark))
          : createElement("a", { key: link.page, href: link.href, "aria-current": current === link.page && current !== "home" ? "page" : undefined }, link.label)),
      ),
      createElement(ThemeToggle, { theme, onToggle: onToggleTheme }),
    ),
  );
}

export function EstateShell({ variant, as = "div", className = "", children, ...props }) {
  if (!ESTATE_LAYOUT_VARIANTS.includes(variant)) throw new Error(`Unsupported estate layout variant: ${variant}`);
  return createElement(as, { ...props, className: joinClasses("estate-shell", `estate-shell--${variant}`, className), "data-estate-layout": variant }, children);
}

export function EstatePageTitle({ variant = "landing", as = "h1", className = "", children, ...props }) {
  return createElement(as, { ...props, className: joinClasses("estate-page-title", `estate-page-title--${variant}`, className) }, children);
}

export function EstateSectionTitle({ as = "h2", className = "", children, ...props }) {
  return createElement(as, { ...props, className: joinClasses("estate-section-title", className) }, children);
}

export function EstateRegistrationRule({ className = "" }) {
  return createElement("div", { className: joinClasses("estate-registration-rule", className), "aria-hidden": "true" });
}

export function EstateBoundary({ label, variant = "stack", as = "aside", className = "", children, ...props }) {
  return createElement(as, { ...props, className: joinClasses("estate-boundary", `estate-boundary--${variant}`, className), "aria-label": label }, children);
}

export function EstateEvidenceFrame({ as = "figure", className = "", children, ...props }) {
  return createElement(as, { ...props, className: joinClasses("estate-evidence-frame", className) }, children);
}
