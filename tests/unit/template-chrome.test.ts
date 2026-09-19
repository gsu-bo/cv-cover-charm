import { describe, expect, test } from "bun:test";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  defaultFooterModeForTemplate,
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

describe("template-owned dossier chrome", () => {
  test("Brief owns the neutral no-header/no-footer fallback", () => {
    expect(defaultHeaderModeForTemplate("brief")).toBe("none");
    expect(defaultFooterModeForTemplate("brief")).toBe("none");
    expect(defaultHeaderGapMmForTemplate("brief")).toBe(12);
  });

  test("ordinary templates and Warm default to compact headers", () => {
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
      "freundlich",
    ]) {
      expect(defaultHeaderModeForTemplate(template)).toBe("compact");
      expect(defaultHeaderGapMmForTemplate(template)).toBe(12);
    }
  });

  test("Aurora keeps the reviewed deep contact clearance", () => {
    expect(defaultHeaderModeForTemplate("aurora")).toBe("contact");
    expect(defaultHeaderGapMmForTemplate("aurora")).toBe(12);
  });

  test("designed masthead families opt into contact headers", () => {
    for (const template of [
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
    ]) {
      expect(defaultHeaderModeForTemplate(template)).toBe("contact");
      expect(defaultHeaderGapMmForTemplate(template)).toBe(4);
    }
  });

  test("contact gradient families inherit both template colours", () => {
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
    }
  });

  test("explicit contact background colours remain authoritative", () => {
    const source = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerBackgroundColor: "#111111",
      headerGradientColor: null,
    };
    expect(
      resolveTemplateChromeOptions("verlauf", { primary: "#123456", secondary: "#abcdef" }, source),
    ).toBe(source);
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
      expect(
        resolveTemplateChromeOptions("modern", { primary: "#111827", accent: "#f43f5e" }, source),
      ).toBe(source);
    }
  });

  test("ordinary templates keep the shared chrome contract unchanged", () => {
    const source = { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" as const };
    const resolved = resolveTemplateChromeOptions(
      "colorful",
      { primary: "#ef4444", accent: "#3b82f6" },
      source,
    );

    expect(resolved).toBe(source);
  });
});
