import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemeMode,
  nextTheme,
  persistThemeMode,
  resolveThemeMode,
  themeClassState,
} from "../../src/lib/app-theme";

const rootSource = readFileSync(new URL("../../src/routes/__root.tsx", import.meta.url), "utf8");
const toggleSource = readFileSync(
  new URL("../../src/components/cover/ThemeToggle.tsx", import.meta.url),
  "utf8",
);

describe("three-mode application theme", () => {
  test("keeps stored light/dark values compatible and accepts grey", () => {
    expect(resolveThemeMode("light", true)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
    expect(resolveThemeMode("grey", true)).toBe("grey");
  });

  test("falls back to the system preference only without a valid stored mode", () => {
    expect(resolveThemeMode(null, false)).toBe("light");
    expect(resolveThemeMode(null, true)).toBe("dark");
    expect(resolveThemeMode("unexpected", true)).toBe("dark");
  });

  test("cycles light to grey to dark to light", () => {
    expect(nextTheme("light")).toBe("grey");
    expect(nextTheme("grey")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  test("dark and grey classes are mutually exclusive", () => {
    expect(themeClassState("light")).toEqual({ dark: false, grey: false });
    expect(themeClassState("grey")).toEqual({ dark: false, grey: true });
    expect(themeClassState("dark")).toEqual({ dark: true, grey: false });

    const active = new Set(["dark", "grey"]);
    const dataset: Record<string, string> = {};
    const root = {
      classList: {
        toggle(name: string, force?: boolean) {
          if (force) active.add(name);
          else active.delete(name);
          return Boolean(force);
        },
      },
      dataset,
    };

    applyThemeMode(root as Parameters<typeof applyThemeMode>[0], "grey");
    expect([...active]).toEqual(["grey"]);
    expect(dataset.themeMode).toBe("grey");

    applyThemeMode(root as Parameters<typeof applyThemeMode>[0], "dark");
    expect([...active]).toEqual(["dark"]);
    expect(dataset.themeMode).toBe("dark");
  });

  test("persists the selected mode under the established storage key", () => {
    const writes: Array<[string, string]> = [];
    persistThemeMode(
      {
        setItem(key, value) {
          writes.push([key, value]);
        },
      },
      "grey",
    );
    expect(THEME_STORAGE_KEY).toBe("theme");
    expect(writes).toEqual([["theme", "grey"]]);
  });

  test("initializes the shell before hydration instead of inside the toggle", () => {
    expect(rootSource).toContain("THEME_BOOTSTRAP_SCRIPT");
    expect(rootSource).toContain(
      '<script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />',
    );
    expect(rootSource).toContain("suppressHydrationWarning");
    expect(rootSource).toContain("themeToggleCss");
    expect(toggleSource).toContain("useSyncExternalStore");
    expect(toggleSource).not.toContain("useEffect");
    expect(toggleSource).not.toContain("localStorage");
  });

  test("bootstrap reads storage and clears competing theme classes", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('localStorage.getItem("theme")');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain('classList.remove("dark","grey")');
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("prefers-color-scheme: dark");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("dataset.themeMode=m");
  });
});
