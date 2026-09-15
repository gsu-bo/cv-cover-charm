import { describe, expect, test } from "bun:test";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

const warmColors = {
  primary: "#16857b",
  secondary: "#dfa20d",
  accent: "#dfa20d",
};

describe("Warm 1 dossier chrome", () => {
  test("uses the compact contract that drives the reviewed letter masthead and CV edge", () => {
    expect(defaultHeaderModeForTemplate("freundlich")).toBe("compact");
    expect(defaultHeaderGapMmForTemplate("freundlich")).toBe(12);
  });

  test("maps a generic contact header back to the reviewed Warm composition", () => {
    const resolved = resolveTemplateChromeOptions("freundlich", warmColors, {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
      headerHeightMm: 22,
      headerGapMm: 4,
    });

    expect(resolved.headerMode).toBe("compact");
    expect(resolved.headerHeightMm).toBeNull();
    expect(resolved.headerGapMm).toBe(12);
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
