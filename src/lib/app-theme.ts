export type ThemeMode = "light" | "grey" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const THEME_ORDER: readonly ThemeMode[] = ["light", "grey", "dark"];
export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "Hell",
  grey: "Grau",
  dark: "Dunkel",
};
export const THEME_CHANGE_EVENT = "cv-cover-charm-theme-change";

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "grey" || value === "dark";
}

export function resolveThemeMode(stored: string | null, prefersDark: boolean): ThemeMode {
  if (isThemeMode(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  const index = THEME_ORDER.indexOf(mode);
  return THEME_ORDER[(index + 1) % THEME_ORDER.length];
}

export function themeClassState(mode: ThemeMode) {
  return {
    dark: mode === "dark",
    grey: mode === "grey",
  };
}

type ThemeRoot = {
  classList: Pick<DOMTokenList, "toggle">;
  dataset: DOMStringMap;
};

export function applyThemeMode(root: ThemeRoot, mode: ThemeMode): void {
  const classes = themeClassState(mode);
  root.classList.toggle("dark", classes.dark);
  root.classList.toggle("grey", classes.grey);
  root.dataset.themeMode = mode;
}

type ThemeStorageWriter = {
  setItem(key: string, value: string): void;
};

export function persistThemeMode(storage: ThemeStorageWriter, mode: ThemeMode): void {
  storage.setItem(THEME_STORAGE_KEY, mode);
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function storedThemeMode(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") return "light";
  const initialized = document.documentElement.dataset.themeMode;
  if (isThemeMode(initialized)) return initialized;
  return resolveThemeMode(storedThemeMode(), systemPrefersDark());
}

export function getServerThemeSnapshot(): ThemeMode {
  return "light";
}

export function setThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  applyThemeMode(document.documentElement, mode);
  try {
    persistThemeMode(localStorage, mode);
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function subscribeTheme(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleThemeChange = () => listener();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const mode = resolveThemeMode(event.newValue, systemPrefersDark());
    applyThemeMode(document.documentElement, mode);
    listener();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
}

const storedModeChecks = THEME_ORDER.map((mode) => `s===${JSON.stringify(mode)}`).join("||");

/**
 * Runs in <head> before React hydration and before the document can visibly
 * paint with the wrong shell theme. Keep this dependency-free and synchronous.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(()=>{const r=document.documentElement;let s=null;try{s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch{}const d=typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches;const m=(${storedModeChecks})?s:(d?"dark":"light");r.classList.remove("dark","grey");if(m!=="light")r.classList.add(m);r.dataset.themeMode=m;})();`;
