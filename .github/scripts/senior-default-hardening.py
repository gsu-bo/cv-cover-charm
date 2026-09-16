from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch target in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, count))


# 1) Make Brief a real member of the shared template type instead of lying via casts.
replace(
    "src/components/cover/types.ts",
    'export type TemplateId =\n  | "klassisch"',
    'export type TemplateId =\n  | "brief"\n  | "klassisch"',
)
replace(
    "src/components/cover/types.ts",
    '    id: "brief" as TemplateId,',
    '    id: "brief",',
)
replace(
    "src/default-config.ts",
    'import type { TemplateId } from "@/components/cover/types";\n',
    '',
)
replace(
    "src/default-config.ts",
    '  TEMPLATE: CANONICAL_DOSSIER_PRESENTATION.template as TemplateId,',
    '  TEMPLATE: CANONICAL_DOSSIER_PRESENTATION.template,',
)
replace(
    "src/components/letter/types.ts",
    'export type LetterTemplateId = "brief" | TemplateId;',
    'export type LetterTemplateId = TemplateId;',
)

# 2) Keep technical legacy/template fallbacks distinct from fresh semantic state.
# A malformed/partial DossierChromeState must still recover to the canonical fresh state,
# while migration from an old letter continues to use DEFAULT_DOSSIER_CHROME_OPTIONS.
replace(
    "src/lib/dossier-chrome.ts",
    '  const shared = normalizeOptions(value.shared);',
    '  const shared = normalizeOptions(value.shared, CANONICAL_DOSSIER_CHROME_OPTIONS);',
)

# 3) Actually consume the canonical Brief page/continuation contract when a design has
# no explicit chrome choice. Explicit legacy/user choices remain authoritative.
replace(
    "src/components/letter/layout-system.ts",
    'import type { TemplateId } from "@/components/cover/types";\n',
    'import type { TemplateId } from "@/components/cover/types";\nimport { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";\n',
)
replace(
    "src/components/letter/layout-system.ts",
    '''function effectiveHeaderMode(design: LetterDesign): LetterHeaderMode {
  // Header modes have the same semantic meaning as in the CV. The shared chrome
  // renderer decides how the contact mode is visually condensed on continuation pages.
  return design.headerMode ?? "compact";
}

function effectiveFooterMode(design: LetterDesign, finalPage: boolean): LetterFooterMode {
  const requested = design.footerMode ?? "compact";
  // Attachment lists belong on the final page only. Earlier pages keep the compact band.
  if (requested === "attachments" && !finalPage) return "compact";
  return requested;
}''',
    '''function effectiveHeaderMode(design: LetterDesign, pageIndex: number): LetterHeaderMode {
  // Explicit legacy/user choices always win. Only an actually missing choice may
  // consume the semantic Brief contract.
  if (design.headerMode) return design.headerMode;
  if (design.template === CANONICAL_DOSSIER_PRESENTATION.template) {
    return pageIndex > 0
      ? CANONICAL_DOSSIER_PRESENTATION.letter.continuationHeaderMode
      : CANONICAL_DOSSIER_PRESENTATION.letter.headerMode;
  }
  // Established template compatibility remains intentionally compact here.
  return "compact";
}

function effectiveFooterMode(
  design: LetterDesign,
  finalPage: boolean,
  pageIndex: number,
): LetterFooterMode {
  const requested =
    design.footerMode ??
    (design.template === CANONICAL_DOSSIER_PRESENTATION.template
      ? pageIndex > 0
        ? CANONICAL_DOSSIER_PRESENTATION.letter.continuationFooterMode
        : CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
      : "compact");
  // Attachment lists belong on the final page only. Earlier pages keep the compact band.
  if (requested === "attachments" && !finalPage) return "compact";
  return requested;
}''',
)
replace(
    "src/components/letter/layout-system.ts",
    '  const headerMode = effectiveHeaderMode(design);\n  const footerMode = effectiveFooterMode(design, finalPage);',
    '  const headerMode = effectiveHeaderMode(design, pageIndex);\n  const footerMode = effectiveFooterMode(design, finalPage, pageIndex);',
    2,
)
replace(
    "src/components/letter/layout-system.ts",
    '  const requestedHeaderMode = design.headerMode ?? "compact";\n  const requestedFooterMode = design.footerMode ?? "compact";',
    '''  const requestedHeaderMode =
    design.headerMode ??
    (design.template === CANONICAL_DOSSIER_PRESENTATION.template
      ? CANONICAL_DOSSIER_PRESENTATION.letter.headerMode
      : "compact");
  const requestedFooterMode =
    design.footerMode ??
    (design.template === CANONICAL_DOSSIER_PRESENTATION.template
      ? CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
      : "compact");''',
)

# SSR/raw renderer adapter must not re-invent contact chrome for an un-normalized
# fresh Brief design. normalizeLetterDesign still preserves old saved-letter defaults.
replace(
    "src/components/letter/LetterCanvas.tsx",
    'import { effectiveDossierFont } from "@/lib/dossier-theme";\n',
    'import { effectiveDossierFont } from "@/lib/dossier-theme";\nimport { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";\n',
)
replace(
    "src/components/letter/LetterCanvas.tsx",
    '    headerMode: design.headerMode ?? "contact",',
    '''    headerMode:
      design.headerMode ??
      (design.template === CANONICAL_DOSSIER_PRESENTATION.template
        ? CANONICAL_DOSSIER_PRESENTATION.letter.headerMode
        : "contact"),''',
)
replace(
    "src/components/letter/LetterCanvas.tsx",
    '''    footerMode:
      design.footerMode === "attachments"
        ? "details"
        : design.footerMode === "none"
          ? "none"
          : "compact",''',
    '''    footerMode:
      design.footerMode === "attachments"
        ? "details"
        : design.footerMode === "none"
          ? "none"
          : design.footerMode === "compact"
            ? "compact"
            : design.template === CANONICAL_DOSSIER_PRESENTATION.template
              ? CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
              : "compact",''',
)

# 4) Regression coverage: compile-time TemplateId contract, partial-state recovery,
# raw Brief page 1/2 fallback, plus legacy normalization staying historical.
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    'import { defaultCvLayoutForTemplate } from "../../src/components/cv/layout";\n',
    'import type { TemplateId } from "../../src/components/cover/types";\nimport { defaultCvLayoutForTemplate } from "../../src/components/cv/layout";\n',
)
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    '''  DEFAULT_DOSSIER_CHROME_OPTIONS,
  DEFAULT_DOSSIER_CHROME_STATE,
} from "../../src/lib/dossier-chrome";''',
    '''  DEFAULT_DOSSIER_CHROME_OPTIONS,
  DEFAULT_DOSSIER_CHROME_STATE,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";''',
)
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    '''    expect(CANONICAL_DOSSIER_PRESENTATION.template).toBe("brief");
    expect(DEFAULTS.TEMPLATE as string).toBe("brief");''',
    '''    const typedDefault: TemplateId = DEFAULTS.TEMPLATE;
    expect(CANONICAL_DOSSIER_PRESENTATION.template).toBe("brief");
    expect(typedDefault).toBe("brief");''',
)
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    '''  test("fresh Brief keeps page 1 and continuation pages plain", () => {
    const design = emptyLetterDesign();''',
    '''  test("fresh and raw Brief designs keep page 1 and continuation pages plain", () => {
    const design = emptyLetterDesign();''',
)
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    '''    expect(continuation.effectiveHeaderMode).toBe("none");
    expect(continuation.effectiveFooterMode).toBe("none");
  });''',
    '''    expect(continuation.effectiveHeaderMode).toBe("none");
    expect(continuation.effectiveFooterMode).toBe("none");

    const rawDesign = { ...design, headerMode: undefined, footerMode: undefined };
    const rawFirst = letterPageGeometry(EMPTY_LETTER, rawDesign, {
      pageIndex: 0,
      finalPage: false,
    });
    const rawContinuation = letterPageGeometry(EMPTY_LETTER, rawDesign, {
      pageIndex: 1,
      finalPage: true,
    });
    expect(rawFirst.effectiveHeaderMode).toBe("none");
    expect(rawFirst.effectiveFooterMode).toBe("none");
    expect(rawContinuation.effectiveHeaderMode).toBe("none");
    expect(rawContinuation.effectiveFooterMode).toBe("none");
  });

  test("partial chrome state recovers to the fresh Brief contract, not legacy chrome", () => {
    const recovered = normalizeDossierChromeState({});
    expect(recovered.shared.headerMode).toBe("none");
    expect(recovered.shared.footerMode).toBe("none");
    expect(recovered.cv.headerMode).toBe("none");
    expect(recovered.letter.headerMode).toBe("none");
  });''',
)

# Add an SSR/raw adapter regression without weakening historical save migration.
replace(
    "tests/unit/letter-brief-default.test.tsx",
    '''  test("an explicitly selected shared contact header still renders on the Brief template", () => {''',
    '''  test("an un-normalized fresh Brief design cannot re-invent legacy chrome in SSR", () => {
    const design = { ...emptyLetterDesign(), headerMode: undefined, footerMode: undefined };
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(markup).toContain('data-letter-header-mode="none"');
    expect(markup).toContain('data-letter-footer-mode="none"');
  });

  test("an explicitly selected shared contact header still renders on the Brief template", () => {''',
)

# Temporary patch runner removes itself after a successful product commit.
Path(".github/scripts/senior-default-hardening.py").unlink(missing_ok=True)
Path(".github/workflows/senior-default-hardening.yml").unlink(missing_ok=True)
