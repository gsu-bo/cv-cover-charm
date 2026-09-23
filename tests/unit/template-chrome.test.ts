import { describe, expect, test } from "bun:test";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  defaultFooterModeForTemplate,
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  recommendedHeaderPatchForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

describe("template-owned dossier chrome", () => {
  test("Brief uses the shared compact header/footer fallback", () => {
    expect(defaultHeaderModeForTemplate("brief")).toBe("compact");
    expect(defaultFooterModeForTemplate("brief")).toBe("compact");
    expect(defaultHeaderGapMmForTemplate("brief")).toBe(12);
  });

  test("all normal visual templates default to compact headers", () => {
    for (const template of [
      "klassisch",
      "modern",
      "edel",
      "edelDark",
      "colorful",
      "blockig",
      "serioes",
      "human",
      "welle",
      "edge",
      "ribbon",
      "aurora",
      "horizon",
      "violetPulse",
      "studio",
      "studio2",
      "studio3",
      "warm2",
      "warm3",
      "warm4",
      "warm5",
      "verlauf",
      "verlauf2",
      "verlauf3",
      "prism",
      "cove",
      "citrus",
      "neon",
    ]) {
      expect(defaultHeaderModeForTemplate(template)).toBe("compact");
      expect(defaultHeaderGapMmForTemplate(template)).toBe(12);
      expect(recommendedHeaderPatchForTemplate(template)).toBeNull();
    }
  });

  test("Warm alone intentionally recommends the reviewed stacked contact header", () => {
    expect(defaultHeaderModeForTemplate("freundlich")).toBe("contact");
    expect(defaultHeaderGapMmForTemplate("freundlich")).toBe(4);
    expect(recommendedHeaderPatchForTemplate("freundlich")).toMatchObject({
      headerMode: "contact",
      headerTextLayout: "stacked",
      headerHeightMm: 44,
      headerGapMm: 4,
    });
    expect(defaultHeaderModeForTemplate("citrus")).toBe("compact");
    expect(recommendedHeaderPatchForTemplate("citrus")).toBeNull();
  });

  test("contact gradient families inherit both template colours when contact is explicit", () => {
    const source = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerBackgroundColor: null,
      headerGradientColor: null,
    };

    for (const template of ["horizon", "violetPulse", "verlauf", "verlauf2", "verlauf3", "prism"]) {
      const resolved = resolveTemplateChromeOptions(
        template,
        { primary: "#123456", secondary: "#abcdef", accent: "#fedcba" },
        source,
      );
      expect(resolved.headerBackgroundColor).toBe("#123456");
      expect(resolved.headerGradientColor).toBe("#abcdef");
      expect(resolved.headerFontSizePt).toBe(14);
    }
  });

  test("explicit contact background colours remain authoritative", () => {
    const source = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerBackgroundColor: "#111111",
      headerGradientColor: null,
    };
    const resolved = resolveTemplateChromeOptions(
      "verlauf",
      { primary: "#123456", secondary: "#abcdef" },
      source,
    );
    expect(resolved.headerBackgroundColor).toBe(source.headerBackgroundColor);
    expect(resolved.headerGradientColor).toBe(source.headerGradientColor);
    expect(resolved.headerFontSizePt).toBe(14);
    expect(source.headerFontSizePt).toBeNull();
  });

  test("Modern mirrors compact header and footer without changing their geometry", () => {
    const source = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      footerMode: "compact" as const,
    };
    const resolved = resolveTemplateChromeOptions(
      "modern",
      { primary: "#111827", accent: "#f43f5e" },
      source,
    );

    expect(resolved.headerMode).toBe("compact");
    expect(resolved.footerMode).toBe("compact");
    expect(resolved.headerHeightMm).toBe(source.headerHeightMm);
    expect(resolved.footerHeightMm).toBe(source.footerHeightMm);
    expect(resolved.headerBackgroundColor).toBe("#111827");
    expect(resolved.footerBackgroundColor).toBe("#111827");
    expect(resolved.headerFontSizePt).toBe(14);
    expect(resolved.borderEnabled).toBe(true);
    expect(resolved.borderColor).toBe("#f43f5e");
    expect(resolved.borderWidthMm).toBe(0.6);
  });

  test("Modern compact pair follows customized template colours", () => {
    const source = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      footerMode: "compact" as const,
    };
    const resolved = resolveTemplateChromeOptions(
      "modern",
      { primary: "#223344", accent: "#ee4466" },
      source,
    );

    expect(resolved.headerBackgroundColor).toBe("#223344");
    expect(resolved.footerBackgroundColor).toBe("#223344");
    expect(resolved.borderColor).toBe("#ee4466");
  });

  test("Modern never overrides explicit contact / none / details mode choices", () => {
    const variants = [
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact" as const,
        footerMode: "compact" as const,
      },
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "none" as const,
        footerMode: "compact" as const,
      },
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "compact" as const,
        footerMode: "details" as const,
      },
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "compact" as const,
        footerMode: "none" as const,
      },
    ];

    for (const source of variants) {
      const resolved = resolveTemplateChromeOptions(
        "modern",
        { primary: "#111827", accent: "#f43f5e" },
        source,
      );
      expect(resolved.headerMode).toBe(source.headerMode);
      expect(resolved.footerMode).toBe(source.footerMode);
      expect(resolved.headerFontSizePt).toBe(14);
    }
  });

  test("ordinary templates keep the shared chrome contract except for the dossier-wide header default", () => {
    const source = { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" as const };
    const resolved = resolveTemplateChromeOptions(
      "colorful",
      { primary: "#ef4444", accent: "#3b82f6" },
      source,
    );

    expect(resolved).toEqual({ ...source, headerFontSizePt: 14 });
    expect(source.headerFontSizePt).toBeNull();
  });
});
