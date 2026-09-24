from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# layout.ts — turn the old continuation *gap* into an independent page-2 top
# margin. Keep the old storage key read-only for migration of very recent saves.
# ---------------------------------------------------------------------------
path = 'src/components/cv/layout.ts'
text = read(path)
text = replace_once(
    text,
    'export const CV_CONTINUATION_GAP_STORAGE_KEY = "lebenslauf:continuation-gap:v1";',
    'export const CV_CONTINUATION_GAP_STORAGE_KEY = "lebenslauf:continuation-gap:v1";\n'
    'export const CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY =\n'
    '  "lebenslauf:continuation-top-margin:v1";',
    'layout storage key',
)
for old, new in [
    ('CV_CONTINUATION_GAP_MIN_MM', 'CV_CONTINUATION_TOP_MARGIN_MIN_MM'),
    ('CV_CONTINUATION_GAP_MAX_MM', 'CV_CONTINUATION_TOP_MARGIN_MAX_MM'),
    ('CV_CONTINUATION_GAP_DEFAULT_MM', 'CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM'),
    ('normalizeCvContinuationGapMm', 'normalizeCvContinuationTopMarginMm'),
    ('readContinuationGap', 'readContinuationTopMargin'),
    ('getCvContinuationGapMm', 'getCvContinuationTopMarginMm'),
    ('setCvContinuationGapMm', 'setCvContinuationTopMarginMm'),
    ('subscribeCvContinuationGap', 'subscribeCvContinuationTopMargin'),
]:
    text = text.replace(old, new)
text = replace_once(
    text,
    '/**\n * CV-only whitespace between a continuation header and content from page 2 on.\n * Page 1 continues to use the shared dossier header gap.\n */\n'
    'export const CV_CONTINUATION_TOP_MARGIN_MIN_MM = 0;\n'
    'export const CV_CONTINUATION_TOP_MARGIN_MAX_MM = 20;\n'
    'export const CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM = 4;',
    '/**\n * Independent physical top margin for CV continuation pages (page 2+).\n * Page 1 keeps the normal dossier page margin; visible continuation chrome is\n * protected separately by the renderer.\n */\n'
    'export const CV_CONTINUATION_TOP_MARGIN_MIN_MM = 0;\n'
    'export const CV_CONTINUATION_TOP_MARGIN_MAX_MM = 40;\n'
    'export const CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM = 10;',
    'layout constants',
)
text = replace_once(
    text,
    'function readContinuationTopMargin(): number {\n'
    '  if (typeof window === "undefined") return CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM;\n'
    '  try {\n'
    '    const raw = window.localStorage.getItem(CV_CONTINUATION_GAP_STORAGE_KEY);\n'
    '    return raw === null ? CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM : normalizeCvContinuationTopMarginMm(raw);\n'
    '  } catch {\n'
    '    return CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM;\n'
    '  }\n'
    '}',
    'function readContinuationTopMargin(): number {\n'
    '  if (typeof window === "undefined") return CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM;\n'
    '  try {\n'
    '    const raw = window.localStorage.getItem(CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY);\n'
    '    if (raw !== null) return normalizeCvContinuationTopMarginMm(raw);\n'
    '    // The old control stored a 0–20 mm continuation gap. Treat that value\n'
    '    // as the new top margin once, so recent project files remain predictable.\n'
    '    const legacy = window.localStorage.getItem(CV_CONTINUATION_GAP_STORAGE_KEY);\n'
    '    return legacy === null\n'
    '      ? CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM\n'
    '      : normalizeCvContinuationTopMarginMm(legacy);\n'
    '  } catch {\n'
    '    return CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM;\n'
    '  }\n'
    '}',
    'layout read continuation margin',
)
text = replace_once(
    text,
    '/** CV-only continuation whitespace from page 2 onward. */\n'
    'export function getCvContinuationTopMarginMm(): number {',
    '/** Independent CV top margin from page 2 onward. */\n'
    'export function getCvContinuationTopMarginMm(): number {',
    'layout getter comment',
)
text = replace_once(
    text,
    'export function setCvContinuationTopMarginMm(value: number) {\n'
    '  if (typeof window === "undefined") return;\n'
    '  const normalized = normalizeCvContinuationTopMarginMm(value);\n'
    '  try {\n'
    '    window.localStorage.setItem(CV_CONTINUATION_GAP_STORAGE_KEY, String(normalized));\n'
    '  } catch {\n'
    '    // Die laufende Seite reagiert trotzdem über das Event.\n'
    '  }\n'
    '  window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));\n'
    '}',
    'export function setCvContinuationTopMarginMm(value: number) {\n'
    '  if (typeof window === "undefined") return;\n'
    '  const normalized = normalizeCvContinuationTopMarginMm(value);\n'
    '  try {\n'
    '    window.localStorage.setItem(CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY, String(normalized));\n'
    '    window.localStorage.removeItem(CV_CONTINUATION_GAP_STORAGE_KEY);\n'
    '  } catch {\n'
    '    // Die laufende Seite reagiert trotzdem über das Event.\n'
    '  }\n'
    '  window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));\n'
    '}',
    'layout setter',
)
text = replace_once(
    text,
    '      event.key === SECTION_GAP_STORAGE_KEY ||\n'
    '      event.key === CV_CONTINUATION_GAP_STORAGE_KEY',
    '      event.key === SECTION_GAP_STORAGE_KEY ||\n'
    '      event.key === CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY ||\n'
    '      event.key === CV_CONTINUATION_GAP_STORAGE_KEY',
    'layout storage subscriber',
)
text = text.replace(
    '/** Fortsetzungsabstand teilt denselben Event-Stream wie die übrige CV-Geometrie. */',
    '/** Oberer Rand ab Seite 2 teilt denselben Event-Stream wie die übrige CV-Geometrie. */',
)
write(path, text)


# ---------------------------------------------------------------------------
# CvPageMarginsControl.tsx — one clear continuation control, not another gap.
# ---------------------------------------------------------------------------
path = 'src/components/cv/CvPageMarginsControl.tsx'
text = read(path)
for old, new in [
    ('CV_CONTINUATION_GAP_DEFAULT_MM', 'CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM'),
    ('CV_CONTINUATION_GAP_MAX_MM', 'CV_CONTINUATION_TOP_MARGIN_MAX_MM'),
    ('CV_CONTINUATION_GAP_MIN_MM', 'CV_CONTINUATION_TOP_MARGIN_MIN_MM'),
    ('getCvContinuationGapMm', 'getCvContinuationTopMarginMm'),
    ('setCvContinuationGapMm', 'setCvContinuationTopMarginMm'),
    ('subscribeCvContinuationGap', 'subscribeCvContinuationTopMargin'),
    ('continuationGap', 'continuationTopMargin'),
]:
    text = text.replace(old, new)
text = replace_once(
    text,
    '<span>Abstand oben ab Seite 2</span>',
    '<span>Oberer Rand ab Seite 2</span>',
    'control label',
)
text = replace_once(
    text,
    '                data-cv-continuation-gap-control\n'
    '                type="range"',
    '                data-cv-continuation-top-margin-control\n'
    '                data-cv-continuation-gap-control\n'
    '                type="range"',
    'control data attribute',
)
text = replace_once(
    text,
    '                aria-label="Abstand oben ab Seite 2"',
    '                aria-label="Oberer Rand ab Seite 2"',
    'control aria label',
)
text = replace_once(
    text,
    '                Gilt nur für den Lebenslauf ab Seite 2. Ein vorhandener Fortsetzungs-Header bleibt\n'
    '                geschützt.',
    '                Ersetzt im Lebenslauf ab Seite 2 den normalen oberen Seitenrand. Ein vorhandener\n'
    '                Fortsetzungs-Header bleibt automatisch geschützt.',
    'control helper',
)
text = replace_once(
    text,
    '                  Standardabstand (4 mm)',
    '                  Standardrand (10 mm)',
    'control reset text',
)
write(path, text)


# ---------------------------------------------------------------------------
# archetype.ts — page 2 must stop inheriting the page-1 physical top margin.
# Shared header geometry remains untouched; CV continuation pages use zero extra
# chrome gap and then resolve one explicit final top edge.
# ---------------------------------------------------------------------------
path = 'src/components/cv/archetype.ts'
text = read(path)
text = text.replace('getCvContinuationGapMm', 'getCvContinuationTopMarginMm')
text = replace_once(
    text,
    '/**\n * Page 1 keeps the shared dossier gap. Continuation pages use the CV-only\n'
    ' * control so they can start higher without changing the motivation letter.\n'
    ' */\n'
    'function cvChromeForPage(chrome: DossierChromeOptions, pageIndex: number): DossierChromeOptions {\n'
    '  return pageIndex > 0 ? { ...chrome, headerGapMm: getCvContinuationTopMarginMm() } : chrome;\n'
    '}',
    '/**\n * Page 1 keeps the shared dossier gap. From page 2 onward the CV owns one\n'
    ' * independent top margin, so no second hidden header-gap value is added.\n'
    ' */\n'
    'function cvChromeForPage(chrome: DossierChromeOptions, pageIndex: number): DossierChromeOptions {\n'
    '  return pageIndex > 0 ? { ...chrome, headerGapMm: 0 } : chrome;\n'
    '}',
    'archetype continuation chrome',
)
marker = '''export function cvSurface(\n'''
helper = '''/**\n * Final readable top edge for CV continuation pages. The user-owned page-2\n * margin replaces the normal page-1 physical top margin, while visible chrome\n * and structural card/frame interiors remain hard safety floors.\n */\nexport function cvContinuationContentTopMm(\n  frame: CvFrame,\n  requestedTopMm: number,\n  chrome: DossierChromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,\n  pageIndex = 1,\n): number {\n  const pageChrome = cvChromeForPage(chrome, pageIndex);\n  const headerFloor = dossierHeaderVisualHeightMmForOptions(pageChrome, pageIndex);\n  const structuralFloor =\n    frame.id === "card"\n      ? frame.cardInsetMm + 11\n      : frame.id === "quiet" && frame.borderInsetMm > 0\n        ? frame.borderInsetMm + 7\n        : 0;\n  return roundHalfMm(Math.max(0, requestedTopMm, headerFloor, structuralFloor));\n}\n\n'''
if helper not in text:
    text = replace_once(text, marker, helper + marker, 'archetype helper insertion')
old_box = '''  return (\n    resolveDossierContentMargins(\n      { ...pageMargins, bottom: CV_PAGE_MARGIN_BOTTOM_MM },\n      cvSafePageMarginMinimums(frame, pageIndex, layout, sidebarPct, chrome),\n      cvPageReserves(chrome, pageIndex),\n    ) ?? fallback\n  );\n}'''
new_box = '''  const resolved =\n    resolveDossierContentMargins(\n      { ...pageMargins, bottom: CV_PAGE_MARGIN_BOTTOM_MM },\n      cvSafePageMarginMinimums(frame, pageIndex, layout, sidebarPct, chrome),\n      cvPageReserves(chrome, pageIndex),\n    ) ?? fallback;\n\n  if (pageIndex === 0) return resolved;\n\n  return {\n    ...resolved,\n    top: cvContinuationContentTopMm(\n      frame,\n      getCvContinuationTopMarginMm(),\n      chrome,\n      pageIndex,\n    ),\n  };\n}'''
text = replace_once(text, old_box, new_box, 'archetype content box')
write(path, text)


# ---------------------------------------------------------------------------
# portable-state.ts — save the new semantic value; accept recent legacy files.
# ---------------------------------------------------------------------------
path = 'src/components/cv/portable-state.ts'
text = read(path)
text = replace_once(
    text,
    '  CV_CONTINUATION_GAP_STORAGE_KEY,\n'
    '  CV_INFO_POSITION_STORAGE_KEY,\n'
    '  normalizeCvContinuationGapMm,',
    '  CV_CONTINUATION_GAP_STORAGE_KEY,\n'
    '  CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY,\n'
    '  CV_INFO_POSITION_STORAGE_KEY,\n'
    '  normalizeCvContinuationTopMarginMm,',
    'portable imports 1',
)
text = text.replace('setCvContinuationGapMm', 'setCvContinuationTopMarginMm')
text = replace_once(
    text,
    'const CONTINUATION_GAP_KEY = CV_CONTINUATION_GAP_STORAGE_KEY;',
    'const CONTINUATION_TOP_MARGIN_KEY = CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY;\n'
    'const LEGACY_CONTINUATION_GAP_KEY = CV_CONTINUATION_GAP_STORAGE_KEY;',
    'portable keys',
)
text = replace_once(
    text,
    '  CONTINUATION_GAP_KEY,\n',
    '  CONTINUATION_TOP_MARGIN_KEY,\n  LEGACY_CONTINUATION_GAP_KEY,\n',
    'portable storage list',
)
text = replace_once(
    text,
    '  continuationGapMm?: number;\n',
    '  continuationTopMarginMm?: number;\n'
    '  /** Legacy field accepted when opening project files created before this control was renamed. */\n'
    '  continuationGapMm?: number;\n',
    'portable type',
)
text = replace_once(
    text,
    '    const continuationGapRaw = storage.getItem(CONTINUATION_GAP_KEY);',
    '    const continuationTopMarginRaw =\n'
    '      storage.getItem(CONTINUATION_TOP_MARGIN_KEY) ??\n'
    '      storage.getItem(LEGACY_CONTINUATION_GAP_KEY);',
    'portable read raw',
)
text = replace_once(
    text,
    '    const continuationGapMm =\n'
    '      continuationGapRaw === null ? undefined : normalizeCvContinuationGapMm(continuationGapRaw);',
    '    const continuationTopMarginMm =\n'
    '      continuationTopMarginRaw === null\n'
    '        ? undefined\n'
    '        : normalizeCvContinuationTopMarginMm(continuationTopMarginRaw);',
    'portable normalize',
)
text = replace_once(
    text,
    '      ...(continuationGapMm !== undefined ? { continuationGapMm } : {}),',
    '      ...(continuationTopMarginMm !== undefined ? { continuationTopMarginMm } : {}),',
    'portable output',
)
text = replace_once(
    text,
    '  if (typeof state.continuationGapMm === "number") {\n'
    '    setCvContinuationTopMarginMm(state.continuationGapMm);\n'
    '  }',
    '  if (typeof state.continuationTopMarginMm === "number") {\n'
    '    setCvContinuationTopMarginMm(state.continuationTopMarginMm);\n'
    '  } else if (typeof state.continuationGapMm === "number") {\n'
    '    setCvContinuationTopMarginMm(state.continuationGapMm);\n'
    '  }',
    'portable apply',
)
write(path, text)


# ---------------------------------------------------------------------------
# Regression tests — product semantics, migration, and header/frame protection.
# ---------------------------------------------------------------------------
path = 'tests/unit/cv-continuation-spacing.test.ts'
write(
    path,
    '''import { describe, expect, test } from "bun:test";\nimport { readFileSync } from "node:fs";\nimport {\n  cvContentBox,\n  cvContinuationContentTopMm,\n  cvFrameFor,\n  cvPageReserves,\n} from "../../src/components/cv/archetype";\nimport {\n  CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM,\n  CV_CONTINUATION_TOP_MARGIN_MAX_MM,\n  CV_CONTINUATION_TOP_MARGIN_MIN_MM,\n  normalizeCvContinuationTopMarginMm,\n} from "../../src/components/cv/layout";\nimport {\n  DEFAULT_DOSSIER_CHROME_OPTIONS,\n  dossierHeaderVisualHeightMmForOptions,\n} from "../../src/lib/dossier-chrome";\n\nconst read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");\n\ndescribe("CV continuation page top margin", () => {\n  test("page 2 owns one independent top margin instead of inheriting the page-1 gap", () => {\n    const chrome = {\n      ...DEFAULT_DOSSIER_CHROME_OPTIONS,\n      headerMode: "compact" as const,\n      headerDifferentFirstPage: true,\n      headerGapMm: 12,\n    };\n    const frame = cvFrameFor("brief");\n\n    expect(cvPageReserves(chrome, 0).headerGapMm).toBe(12);\n    expect(cvPageReserves(chrome, 1).headerGapMm).toBe(0);\n    expect(cvContentBox(frame, 1, "classic", undefined, chrome).top).toBe(\n      CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM,\n    );\n  });\n\n  test("allows 0–40 mm while keeping visible continuation chrome protected", () => {\n    expect(CV_CONTINUATION_TOP_MARGIN_MIN_MM).toBe(0);\n    expect(CV_CONTINUATION_TOP_MARGIN_MAX_MM).toBe(40);\n    expect(CV_CONTINUATION_TOP_MARGIN_DEFAULT_MM).toBe(10);\n    expect(normalizeCvContinuationTopMarginMm(-4)).toBe(0);\n    expect(normalizeCvContinuationTopMarginMm(7.26)).toBe(7.5);\n    expect(normalizeCvContinuationTopMarginMm(99)).toBe(40);\n\n    const chrome = {\n      ...DEFAULT_DOSSIER_CHROME_OPTIONS,\n      headerMode: "contact" as const,\n      headerDifferentFirstPage: true,\n      headerContinuationMode: "contact" as const,\n      headerGapMm: 0,\n    };\n    const headerHeight = dossierHeaderVisualHeightMmForOptions(chrome, 1);\n    expect(cvContinuationContentTopMm(cvFrameFor("brief"), 0, chrome, 1)).toBe(headerHeight);\n  });\n\n  test("keeps structural card and framed-template interiors as safety floors", () => {\n    expect(cvContinuationContentTopMm(cvFrameFor("citrus"), 0)).toBe(23);\n    expect(cvContinuationContentTopMm(cvFrameFor("klassisch"), 0)).toBe(17);\n  });\n\n  test("exposes one clear page-2 top-margin control and persists it portably", () => {\n    const control = read("src/components/cv/CvPageMarginsControl.tsx");\n    const portable = read("src/components/cv/portable-state.ts");\n\n    expect(control).toContain("Oberer Rand ab Seite 2");\n    expect(control).toContain("data-cv-continuation-top-margin-control");\n    expect(control).toContain('scope="cv"');\n    expect(control).toContain("Standardrand (10 mm)");\n    expect(portable).toContain("continuationTopMarginMm");\n    expect(portable).toContain("CV_CONTINUATION_TOP_MARGIN_STORAGE_KEY");\n    expect(portable).toContain("continuationGapMm");\n  });\n});\n''',
)

path = 'tests/unit/dossier-header-gap.test.ts'
text = read(path)
text = text.replace('data-cv-continuation-gap-control', 'data-cv-continuation-top-margin-control')
text = text.replace('Abstand oben ab Seite 2', 'Oberer Rand ab Seite 2')
write(path, text)

print('page-2 top-margin patch prepared')
