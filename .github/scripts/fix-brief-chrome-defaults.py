from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch target in {path}: {old[:140]!r}")
    p.write_text(text.replace(old, new, count))


# Keep the legacy/template technical defaults intact. Fresh no-storage state is
# a separate semantic layer so special templates do not accidentally inherit
# Brief's neutral chrome.
replace(
    "src/lib/dossier-chrome.ts",
    '  headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,',
    '  headerMode: "contact",',
)
replace(
    "src/lib/dossier-chrome.ts",
    '  footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,',
    '  footerMode: "compact",',
)
replace(
    "src/lib/dossier-chrome.ts",
    '''export const DEFAULT_DOSSIER_CHROME_STATE: DossierChromeState = {
  version: 1,
  sync: true,
  shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
  cv: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
  letter: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
};''',
    '''export const CANONICAL_DOSSIER_CHROME_OPTIONS: DossierChromeOptions = {
  ...DEFAULT_DOSSIER_CHROME_OPTIONS,
  headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,
  footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,
};

export const DEFAULT_DOSSIER_CHROME_STATE: DossierChromeState = {
  version: 1,
  sync: true,
  shared: { ...CANONICAL_DOSSIER_CHROME_OPTIONS },
  cv: { ...CANONICAL_DOSSIER_CHROME_OPTIONS },
  letter: { ...CANONICAL_DOSSIER_CHROME_OPTIONS },
};''',
)

# Fresh state expectations now reflect the semantic dossier state, not the
# generic renderer/template fallback used for backwards compatibility.
replace(
    "tests/unit/dossier-chrome-sync.test.ts",
    '''    expect(state.shared.headerMode).toBe("contact");
    expect(state.shared.footerMode).toBe("compact");''',
    '''    expect(state.shared.headerMode).toBe("none");
    expect(state.shared.footerMode).toBe("none");''',
)
replace(
    "tests/unit/dossier-chrome-sync.test.ts",
    '''    const cv = patchDossierChromeState(split, "cv", { headerMode: "none" });

    expect(cv.cv.headerMode).toBe("none");
    expect(cv.letter.headerMode).toBe("contact");''',
    '''    const cv = patchDossierChromeState(split, "cv", { headerMode: "contact" });

    expect(cv.cv.headerMode).toBe("contact");
    expect(cv.letter.headerMode).toBe("none");''',
)

# This test explicitly exercises both header and footer collision protection.
replace(
    "tests/unit/dossier-page-margins.test.ts",
    '    const design = { ...emptyLetterDesign(), headerMode: "contact" as const };',
    '''    const design = {
      ...emptyLetterDesign(),
      headerMode: "contact" as const,
      footerMode: "compact" as const,
    };''',
)

# Brief is the one neutral template fallback. Other template-owned defaults are
# unchanged.
replace(
    "tests/unit/template-chrome.test.ts",
    '''  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,''',
    '''  defaultFooterModeForTemplate,
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  resolveTemplateChromeOptions,''',
)
replace(
    "tests/unit/template-chrome.test.ts",
    '''  test("ordinary templates and Warm default to compact headers", () => {
    for (const template of [
      "brief",''',
    '''  test("Brief owns the neutral no-header/no-footer fallback", () => {
    expect(defaultHeaderModeForTemplate("brief")).toBe("none");
    expect(defaultFooterModeForTemplate("brief")).toBe("none");
    expect(defaultHeaderGapMmForTemplate("brief")).toBe(12);
  });

  test("ordinary templates and Warm default to compact headers", () => {
    for (const template of [''',
)

# This is a source-boundary test; it should accept the central semantic source
# rather than require a duplicated literal.
replace(
    "tests/unit/templatefix-edge-consistency.test.ts",
    '    expect(layout).toContain(\'const DEFAULT_LAYOUT: CvLayoutId = "classic";\');',
    '''    expect(layout).toContain(
      "const DEFAULT_LAYOUT: CvLayoutId = CANONICAL_DOSSIER_PRESENTATION.cv.layout;",
    );''',
)

# Canonical regression checks the actual fresh state. Also lock the deliberate
# split so future work cannot make the renderer fallback neutral again.
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    'import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";',
    '''import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  DEFAULT_DOSSIER_CHROME_STATE,
} from "../../src/lib/dossier-chrome";''',
)
replace(
    "tests/unit/dossier-canonical-default.test.ts",
    '''    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerMode).toBe("none");''',
    '''    expect(DEFAULT_DOSSIER_CHROME_STATE.shared.headerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_STATE.shared.footerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerMode).toBe("contact");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerMode).toBe("compact");''',
)

Path(".github/scripts/fix-brief-chrome-defaults.py").unlink(missing_ok=True)
Path(".github/workflows/fix-brief-chrome-defaults.yml").unlink(missing_ok=True)
