import { describe, expect, test } from "bun:test";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderHeightMmForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

const warmColors = {
  primary: "#16857b",
  secondary: "#dfa20d",
  accent: "#dfa20d",
};

describe("Warm 1 dossier chrome", () => {
  test("defaults to the reviewed stacked-contact geometry", () => {
    expect(defaultHeaderModeForTemplate("freundlich")).toBe("contact");
    expect(defaultHeaderHeightMmForTemplate("freundlich")).toBe(44);
    expect(defaultHeaderGapMmForTemplate("freundlich")).toBe(4);
    expect(defaultHeaderHeightMmForTemplate("modern")).toBeNull();
  });

  test("preserves an explicit contact header and user geometry", () => {
    const resolved = resolveTemplateChromeOptions("freundlich", warmColors, {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
      headerHeightMm: 61,
      headerGapMm: 4,
    });

    expect(resolved.headerMode).toBe("contact");
    expect(resolved.headerHeightMm).toBe(61);
    expect(resolved.headerGapMm).toBe(4);
  });

  test("still respects an explicit no-header choice", () => {
    const resolved = resolveTemplateChromeOptions("freundlich", warmColors, {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "none",
    });

    expect(resolved.headerMode).toBe("none");
  });

  test("does not rewrite contact mode for templates that genuinely own it", () => {
    const resolved = resolveTemplateChromeOptions("aurora", warmColors, {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
    });

    expect(resolved.headerMode).toBe("contact");
  });
});
