from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"patch target missing in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


def write(path: str, content: str) -> None:
    file = Path(path)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)


write(
    "src/lib/dossier-default-presentation.ts",
    '''/**
 * Canonical fallback presentation for a dossier with no explicit user design.
 *
 * Renderers must consume the resolved document state and must not invent their
 * own fallback template, chrome, continuation chrome or CV layout.
 */
export const CANONICAL_DOSSIER_PRESENTATION = {
  template: "brief",
  letter: {
    headerMode: "none",
    footerMode: "none",
    continuationHeaderMode: "none",
    continuationFooterMode: "none",
  },
  cv: {
    layout: "classic",
    headerMode: "none",
    footerMode: "none",
  },
} as const;
''',
)

replace(
    "src/default-config.ts",
    '''/**
 * Zentrale Voreinstellungen des Titelblatt-Generators.
''',
    '''import type { TemplateId } from "@/components/cover/types";
import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";

/**
 * Zentrale Voreinstellungen des Titelblatt-Generators.
''',
)
replace(
    "src/default-config.ts",
    '  TEMPLATE: "modern",',
    '  TEMPLATE: CANONICAL_DOSSIER_PRESENTATION.template as TemplateId,',
)

replace(
    "src/lib/dossier-chrome.ts",
    'import { FONT_LABELS, type FontKey } from "@/components/cover/types";\n',
    'import { FONT_LABELS, type FontKey } from "@/components/cover/types";\nimport { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";\n',
)
replace(
    "src/lib/dossier-chrome.ts",
    '  /** Word-like first-page behavior. Follow-up pages use a compact identity header by default. */',
    '  /** Word-like first-page behavior for templates that explicitly use shared chrome. */',
)
replace(
    "src/lib/dossier-chrome.ts",
    '  headerMode: "contact",',
    '  headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,',
)
replace(
    "src/lib/dossier-chrome.ts",
    '  footerMode: "compact",',
    '  footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,',
)

replace(
    "src/lib/template-chrome.ts",
    'import type { DossierChromeOptions, DossierHeaderMode } from "@/lib/dossier-chrome";',
    'import type {\n  DossierChromeOptions,\n  DossierFooterMode,\n  DossierHeaderMode,\n} from "@/lib/dossier-chrome";\nimport { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";',
)
replace(
    "src/lib/template-chrome.ts",
    '''export function defaultHeaderModeForTemplate(template: string): DossierHeaderMode {
  return CONTACT_HEADER_DEFAULT_TEMPLATES.has(template) ? "contact" : "compact";
}
''',
    '''export function defaultHeaderModeForTemplate(template: string): DossierHeaderMode {
  if (template === CANONICAL_DOSSIER_PRESENTATION.template) {
    return CANONICAL_DOSSIER_PRESENTATION.letter.headerMode;
  }
  return CONTACT_HEADER_DEFAULT_TEMPLATES.has(template) ? "contact" : "compact";
}

/** Footer mode written when a template is deliberately selected. */
export function defaultFooterModeForTemplate(template: string): DossierFooterMode {
  return template === CANONICAL_DOSSIER_PRESENTATION.template
    ? CANONICAL_DOSSIER_PRESENTATION.letter.footerMode
    : "compact";
}
''',
)

replace(
    "src/components/cover/TemplatePicker.tsx",
    '''import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
} from "@/lib/template-chrome";''',
    '''import {
  defaultFooterModeForTemplate,
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
} from "@/lib/template-chrome";''',
)
replace(
    "src/components/cover/TemplatePicker.tsx",
    '''function applyTemplateHeaderDefault(template: TemplateId) {
  const headerMode = defaultHeaderModeForTemplate(template);
  const headerGapMm = defaultHeaderGapMmForTemplate(template);
  const cvOnly = window.location.pathname.includes("lebenslauf");
  patchDossierChrome("cv", { headerMode, headerGapMm });
  if (!cvOnly) patchDossierChrome("letter", { headerMode, headerGapMm });
}''',
    '''function applyTemplateHeaderDefault(template: TemplateId) {
  const headerMode = defaultHeaderModeForTemplate(template);
  const footerMode = defaultFooterModeForTemplate(template);
  const headerGapMm = defaultHeaderGapMmForTemplate(template);
  const cvOnly = window.location.pathname.includes("lebenslauf");
  patchDossierChrome("cv", { headerMode, footerMode, headerGapMm });
  if (!cvOnly) patchDossierChrome("letter", { headerMode, footerMode, headerGapMm });
}''',
)
replace(
    "src/components/cover/TemplatePicker.tsx",
    '''  // Brand-new dossiers start on Modern. Establish its template default before
  // parent autosave effects can create a draft key. Existing canonical chrome
''',
    '''  // Brand-new dossiers start on the canonical Brief fallback. Establish its
  // neutral chrome before parent autosave effects can create a draft key. Existing canonical chrome
''',
)

replace(
    "src/components/letter/types.ts",
    'import { LETTER_STORAGE_KEY } from "@/lib/dossier-project";\n',
    'import { LETTER_STORAGE_KEY } from "@/lib/dossier-project";\nimport { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";\n',
)
replace(
    "src/components/letter/types.ts",
    '''  const definition = TEMPLATES.find((candidate) => candidate.id === template) ?? TEMPLATES[0];
  return Object.fromEntries(definition.slots.map((slot) => [slot.key, slot.default]));''',
    '''  const definition =
    TEMPLATES.find((candidate) => candidate.id === template) ??
    TEMPLATES.find(
      (candidate) => candidate.id === (CANONICAL_DOSSIER_PRESENTATION.template as TemplateId),
    );
  if (!definition) return defaultLetterColors("brief");
  return Object.fromEntries(definition.slots.map((slot) => [slot.key, slot.default]));''',
)
replace(
    "src/components/letter/types.ts",
    '  const template: LetterTemplateId = "brief";',
    '  const template: LetterTemplateId = CANONICAL_DOSSIER_PRESENTATION.template;',
)
replace(
    "src/components/letter/types.ts",
    '''    footerMode: "compact",
    footerHeightMm: null,
''',
    '''    footerMode: CANONICAL_DOSSIER_PRESENTATION.letter.footerMode,
    footerHeightMm: null,
''',
)
replace(
    "src/components/letter/types.ts",
    '''    headerMode: "none",
    headerShowName: true,
''',
    '''    headerMode: CANONICAL_DOSSIER_PRESENTATION.letter.headerMode,
    headerShowName: true,
''',
)

replace(
    "src/components/letter/LetterCanvas.tsx",
    '''function resolveLetterChrome(
  design: LetterDesign,
  chromeOptions?: DossierChromeOptions,
): DossierChromeOptions {
  const requested = chromeOptions ?? legacyChromeFromDesign(design);
  const plainBriefDefault =
    design.template === "brief" &&
    design.headerMode === "none" &&
    requested.headerMode === "contact";
  const effectiveRequested = plainBriefDefault
    ? {
        ...requested,
        headerMode: "none" as const,
        headerHeightMm: null,
        headerBackgroundColor: null,
        headerGradientColor: null,
      }
    : requested;

  return resolveTemplateChromeOptions(design.template, design.colors, effectiveRequested);
}''',
    '''function resolveLetterChrome(
  design: LetterDesign,
  chromeOptions?: DossierChromeOptions,
): DossierChromeOptions {
  const requested = chromeOptions ?? legacyChromeFromDesign(design);
  return resolveTemplateChromeOptions(design.template, design.colors, requested);
}''',
)

replace(
    "src/components/cv/layout.ts",
    'export type CvLayoutId =',
    'import { CANONICAL_DOSSIER_PRESENTATION } from "@/lib/dossier-default-presentation";\n\nexport type CvLayoutId =',
)
replace(
    "src/components/cv/layout.ts",
    'const DEFAULT_LAYOUT: CvLayoutId = "classic";',
    'const DEFAULT_LAYOUT: CvLayoutId = CANONICAL_DOSSIER_PRESENTATION.cv.layout;',
)

replace(
    "src/lib/dossier.ts",
    '''function defaultColors(template: TemplateId): Record<string, string> {
  const t = TEMPLATES.find((x) => x.id === template) ?? TEMPLATES[0];
  return Object.fromEntries(t.slots.map((s) => [s.key, s.default]));
}''',
    '''function templateDefinition(template: TemplateId) {
  const definition =
    TEMPLATES.find((candidate) => candidate.id === template) ??
    TEMPLATES.find((candidate) => candidate.id === DEFAULTS.TEMPLATE);
  if (!definition) throw new Error("Canonical dossier template is missing");
  return definition;
}

function defaultColors(template: TemplateId): Record<string, string> {
  const t = templateDefinition(template);
  return Object.fromEntries(t.slots.map((s) => [s.key, s.default]));
}''',
)
replace(
    "src/lib/dossier.ts",
    '    const templateDef = TEMPLATES.find((t) => t.id === p.template) ?? TEMPLATES[0];',
    '    const templateDef =\n      TEMPLATES.find((t) => t.id === p.template) ?? templateDefinition(DEFAULTS.TEMPLATE);',
)

replace(
    "src/lib/dossier-pdf-document.ts",
    'import { emptyCoverDraft } from "@/lib/dossier";\n',
    'import { emptyCoverDraft } from "@/lib/dossier";\nimport { DEFAULTS } from "@/default-config";\n',
)
replace(
    "src/lib/dossier-pdf-document.ts",
    '''const defaultColors = (template: TemplateId): Record<string, string> => {
  const definition = TEMPLATES.find((candidate) => candidate.id === template) ?? TEMPLATES[0];
  return Object.fromEntries(definition.slots.map((slot) => [slot.key, slot.default]));
};''',
    '''const templateDefinition = (template: TemplateId) => {
  const definition =
    TEMPLATES.find((candidate) => candidate.id === template) ??
    TEMPLATES.find((candidate) => candidate.id === DEFAULTS.TEMPLATE);
  if (!definition) throw new Error("Canonical dossier template is missing");
  return definition;
};

const defaultColors = (template: TemplateId): Record<string, string> =>
  Object.fromEntries(templateDefinition(template).slots.map((slot) => [slot.key, slot.default]));''',
)
replace(
    "src/lib/dossier-pdf-document.ts",
    '''  const template =
    typeof raw.template === "string" && TEMPLATES.some((item) => item.id === raw.template)
      ? (raw.template as TemplateId)
      : TEMPLATES[0].id;
  const definition = TEMPLATES.find((item) => item.id === template) ?? TEMPLATES[0];''',
    '''  const template =
    typeof raw.template === "string" && TEMPLATES.some((item) => item.id === raw.template)
      ? (raw.template as TemplateId)
      : DEFAULTS.TEMPLATE;
  const definition = templateDefinition(template);''',
)

replace(
    "tests/unit/letter-brief-default.test.tsx",
    '''  test("fresh Brief template renders without a header even before shared chrome is customized", () => {
    const design = emptyLetterDesign();
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
        chromeOptions: { ...DEFAULT_DOSSIER_CHROME_OPTIONS },
      }),
    );

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(markup).toContain('data-letter-template="brief"');
    expect(markup).toContain('data-letter-header-mode="none"');
  });''',
    '''  test("fresh Brief template renders without shared header or footer chrome", () => {
    const design = emptyLetterDesign();
    const markup = renderToStaticMarkup(
      createElement(LetterCanvas, {
        data: DEMO_LETTER,
        design,
      }),
    );

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(design.footerMode).toBe("none");
    expect(markup).toContain('data-letter-template="brief"');
    expect(markup).toContain('data-letter-header-mode="none"');
    expect(markup).toContain('data-letter-footer-mode="none"');
  });''',
)
replace(
    "tests/unit/letter-brief-default.test.tsx",
    '''  test("an explicitly selected contact header still renders on the Brief template", () => {
    const design = { ...emptyLetterDesign(), headerMode: "contact" as const };
''',
    '''  test("an explicitly selected shared contact header still renders on the Brief template", () => {
    const design = emptyLetterDesign();
''',
)

write(
    "tests/unit/dossier-canonical-default.test.ts",
    '''import { describe, expect, test } from "bun:test";
import { defaultCvLayoutForTemplate } from "../../src/components/cv/layout";
import { cvFrameFor } from "../../src/components/cv/archetype";
import { EMPTY_LETTER, emptyLetterDesign, normalizeLetterDesign } from "../../src/components/letter/types";
import { letterPageGeometry } from "../../src/components/letter/layout-system";
import { DEFAULTS } from "../../src/default-config";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import { CANONICAL_DOSSIER_PRESENTATION } from "../../src/lib/dossier-default-presentation";
import { resolveDossierDocxProfile } from "../../src/lib/dossier-docx-export";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";

describe("canonical neutral dossier fallback", () => {
  test("one contract owns the fresh template and neutral chrome", () => {
    expect(CANONICAL_DOSSIER_PRESENTATION.template).toBe("brief");
    expect(DEFAULTS.TEMPLATE as string).toBe("brief");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerMode).toBe("none");
    expect(CANONICAL_DOSSIER_PRESENTATION.letter.continuationHeaderMode).toBe("none");
    expect(CANONICAL_DOSSIER_PRESENTATION.letter.continuationFooterMode).toBe("none");
  });

  test("fresh Brief keeps page 1 and continuation pages plain", () => {
    const design = emptyLetterDesign();
    const first = letterPageGeometry(EMPTY_LETTER, design, { pageIndex: 0, finalPage: false });
    const continuation = letterPageGeometry(EMPTY_LETTER, design, {
      pageIndex: 1,
      finalPage: true,
    });

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(design.footerMode).toBe("none");
    expect(first.effectiveHeaderMode).toBe("none");
    expect(first.effectiveFooterMode).toBe("none");
    expect(continuation.effectiveHeaderMode).toBe("none");
    expect(continuation.effectiveFooterMode).toBe("none");
  });

  test("fresh CV resolves to Brief + Standard without a sidebar frame", () => {
    expect(defaultCvLayoutForTemplate(CANONICAL_DOSSIER_PRESENTATION.template)).toBe("classic");
    const frame = cvFrameFor(DEFAULTS.TEMPLATE);
    expect(frame.id).toBe("quiet");
    expect(frame.columnMm).toBe(0);
  });

  test("PDF document fallbacks resolve all dossier parts to Brief", () => {
    const cover = coverPdfDocumentFromSaved({ data: {} });
    const letter = letterPdfDocumentFromSaved({ data: {} });
    const cv = cvPdfDocumentFromSaved({ data: {} });

    expect(String(cover?.template)).toBe("brief");
    expect(letter?.design.template).toBe("brief");
    expect(letter?.design.headerMode).toBe("none");
    expect(letter?.design.footerMode).toBe("none");
    expect(String(cv?.design.template)).toBe("brief");
    expect(resolveDossierDocxProfile(cover, letter, cv)?.templateId).toBe("brief");
  });

  test("explicit legacy choices remain authoritative", () => {
    const legacy = normalizeLetterDesign({
      template: "modern",
      colors: {},
      font: "freundlich",
      headerMode: "contact",
      footerMode: "compact",
    });
    expect(legacy.template).toBe("modern");
    expect(legacy.headerMode).toBe("contact");
    expect(legacy.footerMode).toBe("compact");
  });
});
''',
)

# The temporary patch runner removes itself so the repository is left with only
# product/test changes and normal forward history.
Path(".github/scripts/apply-canonical-brief-default.py").unlink(missing_ok=True)
Path(".github/workflows/canonical-brief-default.yml").unlink(missing_ok=True)
