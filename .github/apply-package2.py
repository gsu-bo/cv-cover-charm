from pathlib import Path
import re

def load(path):
    return Path(path).read_text()

def save(path, text):
    Path(path).write_text(text)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

def sub_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return out

# ---------------------------------------------------------------------------
# Canonical chrome state: additive explicit continuation header.
# ---------------------------------------------------------------------------
path = "src/lib/dossier-chrome.ts"
s = load(path)

s = replace_once(
    s,
    '''const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
''',
    '''const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
''',
    "dossier-chrome hasOwn",
)

s = replace_once(
    s,
    '''  /** Word-like first-page behavior for templates that explicitly use shared chrome. */
  headerDifferentFirstPage?: boolean;
  headerHeightMm: number | null;
''',
    '''  /** Word-like first-page behavior for templates that explicitly use shared chrome. */
  headerDifferentFirstPage?: boolean;
  /** Explicit page-2+ header. Missing means the exact legacy continuation behavior. */
  headerContinuationMode?: DossierHeaderMode;
  headerHeightMm: number | null;
''',
    "dossier-chrome type",
)

s = replace_once(
    s,
    '''    headerDifferentFirstPage:
      typeof value.headerDifferentFirstPage === "boolean"
        ? value.headerDifferentFirstPage
        : (fallback.headerDifferentFirstPage ?? true),
    headerHeightMm: normalizedMm(value.headerHeightMm, 1, 40),
''',
    '''    headerDifferentFirstPage:
      typeof value.headerDifferentFirstPage === "boolean"
        ? value.headerDifferentFirstPage
        : (fallback.headerDifferentFirstPage ?? true),
    headerContinuationMode: hasOwn(value, "headerContinuationMode")
      ? value.headerContinuationMode === "compact" ||
        value.headerContinuationMode === "contact" ||
        value.headerContinuationMode === "none"
        ? value.headerContinuationMode
        : undefined
      : fallback.headerContinuationMode,
    headerHeightMm: normalizedMm(value.headerHeightMm, 1, 40),
''',
    "dossier-chrome normalize continuation",
)

s = replace_once(
    s,
    '''      headerDifferentFirstPage: design.headerDifferentFirstPage,
      headerHeightMm: design.headerHeightMm,
''',
    '''      headerDifferentFirstPage: design.headerDifferentFirstPage,
      headerContinuationMode: design.headerContinuationMode,
      headerHeightMm: design.headerHeightMm,
''',
    "dossier-chrome legacy load",
)

s = replace_once(
    s,
    '''      design.headerDifferentFirstPage === (options.headerDifferentFirstPage ?? true) &&
      design.headerHeightMm === options.headerHeightMm &&
''',
    '''      design.headerDifferentFirstPage === (options.headerDifferentFirstPage ?? true) &&
      design.headerContinuationMode === options.headerContinuationMode &&
      design.headerHeightMm === options.headerHeightMm &&
''',
    "dossier-chrome legacy compare",
)

s = replace_once(
    s,
    '''        headerDifferentFirstPage: options.headerDifferentFirstPage ?? true,
        headerHeightMm: options.headerHeightMm,
''',
    '''        headerDifferentFirstPage: options.headerDifferentFirstPage ?? true,
        headerContinuationMode: options.headerContinuationMode,
        headerHeightMm: options.headerHeightMm,
''',
    "dossier-chrome legacy mirror",
)

helpers_start = s.index("/** Contact remains contact on continuation pages; only its visual treatment reduces. */")
helpers_end = s.index("\nexport function dossierFooterVisualHeightMmForOptions", helpers_start)
new_helpers = '''/**
 * Resolve the semantic header for one page. An explicit continuation choice
 * wins on page 2+, while old projects that do not contain the new field keep
 * the historical reduced-contact continuation exactly as before.
 */
export function effectiveDossierHeaderModeForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): DossierHeaderMode {
  if (
    pageIndex > 0 &&
    options.headerDifferentFirstPage !== false &&
    options.headerContinuationMode !== undefined
  ) {
    return options.headerContinuationMode;
  }
  return options.headerMode;
}

export function hasReducedContinuationHeader(
  options: {
    headerMode?: string;
    headerDifferentFirstPage?: boolean;
    headerContinuationMode?: string;
  },
  pageIndex: number,
): boolean {
  return (
    pageIndex > 0 &&
    options.headerDifferentFirstPage !== false &&
    options.headerContinuationMode === undefined &&
    options.headerMode === "contact"
  );
}

export function dossierHeaderVisualHeightMmForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): number {
  const mode = effectiveDossierHeaderModeForOptions(options, pageIndex);
  if (mode === "none") return 0;

  const custom = options.headerHeightMm;
  if (hasReducedContinuationHeader(options, pageIndex)) {
    return custom === null ? 8 : Math.min(18, Math.max(5, custom));
  }

  if (mode === "contact") return custom === null ? 22 : Math.min(40, Math.max(10, custom));
  if (mode === "compact") return custom === null ? 3 : Math.min(18, Math.max(1, custom));
  return 0;
}

export function dossierHeaderContentTopMmForOptions(
  options: DossierChromeOptions,
  pageIndex = 0,
): number {
  const mode = effectiveDossierHeaderModeForOptions(options, pageIndex);
  if (mode === "none") return pageIndex > 0 ? 16 : 18;

  const height = dossierHeaderVisualHeightMmForOptions(options, pageIndex);
  const gap = Math.min(40, Math.max(0, options.headerGapMm ?? 12));
  if (pageIndex > 0 && options.headerDifferentFirstPage !== false) {
    const base = mode === "contact" ? Math.max(18, height + 10) : Math.max(18, height + 15);
    return base + gap;
  }
  const base = mode === "contact" ? Math.max(18, height + 9) : Math.max(18, height + 18);
  return base + gap;
}
'''
s = s[:helpers_start] + new_helpers + s[helpers_end:]
save(path, s)

# ---------------------------------------------------------------------------
# Web/PDF semantic renderer: use the effective header mode per page.
# ---------------------------------------------------------------------------
path = "src/components/dossier/DossierHeaderFooterChrome.tsx"
s = load(path)

s = replace_once(
    s,
    '''  hasReducedContinuationHeader,
  dossierFooterVisualHeightMmForOptions,
''',
    '''  effectiveDossierHeaderModeForOptions,
  hasReducedContinuationHeader,
  dossierFooterVisualHeightMmForOptions,
''',
    "chrome renderer import",
)

old = '''  const resolvedContact = contact;
  // Contact-mode template gradients must render identically in motivation
  // letter and CV. Compact snapshots stay untouched here: their document-level
  // resolver (not this generic shared renderer) owns special treatments such as
  // Modern's mirrored dark/pink pair, so explicit chrome snapshots remain authoritative.
  const visualOptions =
    options.headerMode === "contact"
      ? resolveTemplateChromeOptions(template, colors, options)
      : options;
  const headerMode = options.headerMode;
  const differentFirstPage = options.headerDifferentFirstPage !== false;
'''
new = '''  const resolvedContact = contact;
  const headerMode = effectiveDossierHeaderModeForOptions(options, pageIndex);
  const differentFirstPage = options.headerDifferentFirstPage !== false;
  // Keep document-level template styling stable for the footer, while allowing
  // an explicitly selected continuation contact header to receive the same
  // template-derived contact treatment as a first-page contact header.
  const visualOptions =
    options.headerMode === "contact"
      ? resolveTemplateChromeOptions(template, colors, options)
      : options;
  const headerVisualOptions =
    headerMode === options.headerMode
      ? visualOptions
      : headerMode === "contact"
        ? resolveTemplateChromeOptions(template, colors, { ...options, headerMode })
        : visualOptions;
'''
s = replace_once(s, old, new, "chrome renderer page mode")
s = replace_once(
    s,
    '  const headerBackground = visualOptions.headerBackgroundColor ?? primary;\n',
    '  const headerBackground = headerVisualOptions.headerBackgroundColor ?? primary;\n',
    "chrome header background",
)
s = replace_once(
    s,
    '''  const headerRoles = onColorRoles(
    headerBackground,
    visualOptions.headerGradientColor ?? secondary,
  );
''',
    '''  const headerRoles = onColorRoles(
    headerBackground,
    headerVisualOptions.headerGradientColor ?? secondary,
  );
''',
    "chrome header roles",
)
s = replace_once(
    s,
    '  const headerSurface = surfaceBackground(headerBackground, visualOptions.headerGradientColor);\n',
    '  const headerSurface = surfaceBackground(headerBackground, headerVisualOptions.headerGradientColor);\n',
    "chrome header surface",
)
s = replace_once(
    s,
    '      headerGradient: visualOptions.headerGradientColor,\n',
    '      headerGradient: headerVisualOptions.headerGradientColor,\n',
    "chrome border header gradient",
)
s = replace_once(
    s,
    '''      data-dossier-header-mode={headerMode}
      data-dossier-first-page-different={differentFirstPage ? "true" : "false"}
''',
    '''      data-dossier-header-mode={options.headerMode}
      data-dossier-effective-header-mode={headerMode}
      data-dossier-continuation-mode={
        pageIndex > 0 && differentFirstPage
          ? (options.headerContinuationMode ?? "legacy")
          : undefined
      }
      data-dossier-first-page-different={differentFirstPage ? "true" : "false"}
''',
    "chrome renderer data attrs",
)
s = replace_once(
    s,
    '      data-letter-header-mode={letter ? headerMode : undefined}\n',
    '      data-letter-header-mode={letter ? options.headerMode : undefined}\n',
    "chrome base letter mode attr",
)
save(path, s)

# ---------------------------------------------------------------------------
# Controls: topology first, real page-2 choice, explicit template/custom color,
# and only then shared dependent styling.
# ---------------------------------------------------------------------------
path = "src/components/dossier/DossierChromeControls.tsx"
s = load(path)
s = s.replace('import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";\n', '')

start = s.index("function BackgroundControl({")
end = s.index("\nexport function DossierChromeControls", start)
background = r'''function BackgroundControl({
  label,
  color,
  gradientColor,
  fallback,
  onColor,
  onGradientColor,
}: {
  label: string;
  color: string | null;
  gradientColor: string | null;
  fallback: string;
  onColor: (value: string | null) => void;
  onGradientColor: (value: string | null) => void;
}) {
  const custom = color !== null || gradientColor !== null;
  const gradient = custom && gradientColor !== null;
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-2.5">
      <label className="block text-xs font-medium">
        {label}
        <select
          data-dossier-background-mode-control
          value={custom ? "custom" : "template"}
          onChange={(event) => {
            if (event.target.value === "template") {
              onColor(null);
              onGradientColor(null);
            } else {
              onColor(color ?? fallback);
            }
          }}
          className={selectClass}
        >
          <option value="template">Wie Vorlage</option>
          <option value="custom">Eigene Farbe</option>
        </select>
      </label>

      {custom ? (
        <>
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <span className="mr-auto text-xs text-muted-foreground">Erste Farbe</span>
            <input
              type="color"
              value={color ?? fallback}
              onChange={(event) => onColor(event.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
              aria-label={`${label} erste Farbe`}
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={gradient}
              onChange={(event) => onGradientColor(event.target.checked ? "#ffffff" : null)}
            />
            Verlauf mit zweiter Farbe
          </label>

          {gradient ? (
            <div className="flex items-center justify-between gap-2 pl-5">
              <span className="text-[11px] text-muted-foreground">Zweite Farbe</span>
              <input
                type="color"
                value={gradientColor ?? "#ffffff"}
                onChange={(event) => onGradientColor(event.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
                aria-label={`${label} zweite Verlaufsfarbe`}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
'''
s = s[:start] + background + s[end:]

s = replace_once(
    s,
    '  const headerInlineSeparator = options.headerInlineSeparator ?? "icons";\n',
    '''  const headerInlineSeparator = options.headerInlineSeparator ?? "icons";
  const continuationHeaderControlValue = options.headerContinuationMode ?? "legacy";
  const contactHeaderVisible =
    options.headerMode === "contact" ||
    (options.headerDifferentFirstPage !== false && options.headerContinuationMode === "contact");
  const hasChromeSurface = options.headerMode !== "none" || options.footerMode !== "none";
''',
    "controls derived state",
)

sync_start = s.index('      <div className="flex items-start gap-2">', s.index("  return ("))
sync_end = s.index('\n\n      <div className="mt-3 grid gap-3 border-t pt-3">', sync_start)
sync_block = s[sync_start:sync_end]
s = s[:sync_start] + s[sync_end + 2:]

s = replace_once(s, '        <DossierHyphenationControl />\n\n', '', "remove hyphenation from chrome")

font_start = s.index('        <label className="block text-xs font-medium">\n          Schrift in Header &amp; Footer')
border_start = s.index('        <div\n          data-dossier-border-controls', font_start)
font_block = s[font_start:border_start].rstrip()
header_start = s.index(
    '        <div className="grid gap-2 rounded-md border p-2.5">\n          <label className="block text-xs font-medium">\n            Header',
    border_start,
)
border_block = s[border_start:header_start].rstrip()
s = s[:font_start] + s[header_start:]

first_page_pattern = r'''(?ms)^[ \t]*<label className="grid gap-1 rounded-md border bg-muted/20 p-2\.5 text-xs">\n[ \t]*<span className="flex items-center gap-2 font-medium">\n[ \t]*<input\n[ \t]*data-dossier-header-different-first-page-control\n.*?^[ \t]*</label>\n'''
s = sub_once(s, first_page_pattern, "", "remove old first-page block")

header_description = '''          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Kompakt zeigt nur das Designband. Die Kontaktvarianten integrieren Name, Adresse/Wohnort,
            Telefon und E-Mail direkt in den farbigen Header. Bei der waagrechten Variante kannst du
            die Trennung unten auswählen.
          </span>
'''
continuation_ui = header_description + '''
          {options.headerMode !== "none" ? (
            <div
              data-dossier-continuation-settings
              className="grid gap-2 rounded-md border bg-muted/20 p-2.5"
            >
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  data-dossier-header-different-first-page-control
                  type="checkbox"
                  checked={options.headerDifferentFirstPage !== false}
                  onChange={(event) =>
                    patchOptions({ headerDifferentFirstPage: event.target.checked })
                  }
                />
                Erste Seite anders
              </label>

              {options.headerDifferentFirstPage !== false ? (
                <label className="block text-xs font-medium">
                  Header ab Seite 2
                  <select
                    data-dossier-continuation-header-mode-control
                    value={continuationHeaderControlValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchOptions({
                        headerContinuationMode:
                          value === "legacy" ? undefined : (value as DossierHeaderMode),
                      });
                    }}
                    className={selectClass}
                  >
                    <option value="legacy">Automatisch wie bisher</option>
                    <option value="compact">Header kompakt</option>
                    <option value="contact">Kontaktdaten</option>
                    <option value="none">Kein Header</option>
                  </select>
                  <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">
                    Alte Dossiers bleiben bei „Automatisch wie bisher“ unverändert. Eine bewusste
                    Auswahl gilt nur für Seite 2 und folgende.
                  </span>
                </label>
              ) : (
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  Derselbe Header wird auf allen Seiten verwendet. Die gespeicherte Folgeseitenwahl
                  bleibt erhalten.
                </span>
              )}
            </div>
          ) : null}
'''
s = replace_once(s, header_description, continuation_ui, "insert continuation UI")
s = replace_once(
    s,
    '{options.headerMode === "contact" ? (',
    '{contactHeaderVisible ? (',
    "show contact dependencies for continuation contact",
)

tail = '''        </div>
      </div>
    </section>'''
dependencies = f'''        </div>

        {{hasChromeSurface ? (
          <>
{sync_block}

{font_block}

{border_block}
          </>
        ) : (
          <p
            data-dossier-chrome-empty-note
            className="rounded-md border border-dashed p-2.5 text-[11px] leading-relaxed text-muted-foreground"
          >
            Header und Footer sind deaktiviert. Zusätzliche Schrift- und Rahmenoptionen werden erst
            eingeblendet, sobald eine Fläche aktiv ist.
          </p>
        )}}
      </div>
    </section>'''
s = replace_once(s, tail, dependencies, "controls dependency tail")
save(path, s)

# ---------------------------------------------------------------------------
# Move hyphenation into the actual typography/layout areas.
# ---------------------------------------------------------------------------
path = "src/components/letter/LetterLayoutControls.tsx"
s = load(path)
s = replace_once(
    s,
    'import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";\n',
    '''import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";
''',
    "letter hyphenation import",
)
s = replace_once(
    s,
    '''      <DossierPageMarginsControl
        scope="letter"
''',
    '''      <DossierHyphenationControl />

      <DossierPageMarginsControl
        scope="letter"
''',
    "letter hyphenation placement",
)
save(path, s)

path = "src/routes/lebenslauf.tsx"
s = load(path)
s = replace_once(
    s,
    'import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";\n',
    '''import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";
''',
    "cv hyphenation import",
)
section = s.index('title="Schrift und Layout"')
stack = s.index('<div className="flex flex-col gap-3">', section)
insert = stack + len('<div className="flex flex-col gap-3">')
s = s[:insert] + '\n                  <DossierHyphenationControl />\n' + s[insert:]
save(path, s)

# ---------------------------------------------------------------------------
# Native DOCX: page-aware header type + all existing separator choices.
# ---------------------------------------------------------------------------
path = "src/lib/dossier-docx-chrome.ts"
s = load(path)
s = replace_once(
    s,
    '''  dossierHeaderVisualHeightMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  hasReducedContinuationHeader,
''',
    '''  dossierHeaderContentTopMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  effectiveDossierHeaderModeForOptions,
  hasReducedContinuationHeader,
''',
    "docx chrome imports",
)

header_start = s.index("function header(\n")
header_end = s.index("\nfunction footer(", header_start)
new_header = r'''type HeaderContactRow = {
  key: "name" | "address" | "place" | "phone" | "email";
  value: string;
};

export function dossierDocxInlineHeaderText(
  rows: HeaderContactRow[],
  separator: DossierChromeOptions["headerInlineSeparator"] = "icons",
) {
  return rows
    .map((row, index) => {
      if (separator === "icons" && row.key === "phone") {
        return `${index ? "  " : ""}☎ ${row.value}`;
      }
      if (separator === "icons" && row.key === "email") {
        return `${index ? "  " : ""}✉ ${row.value}`;
      }
      if (index === 0) return row.value;
      const joiner =
        separator === "slash"
          ? " / "
          : separator === "pipe"
            ? " | "
            : separator === "space"
              ? "     "
              : " · ";
      return `${joiner}${row.value}`;
    })
    .join("");
}

function header(
  options: DossierChromeOptions,
  contact: DossierChromeContact,
  colors: Record<string, string>,
  page: number,
) {
  const mode = effectiveDossierHeaderModeForOptions(options, page);
  if (mode === "none") return part("header", "");
  const background = color(
    options.headerBackgroundColor ?? colors.primary ?? colors.accent,
    "111111",
  );
  let body = band(
    `semantic-header-${page}`,
    background,
    0,
    dossierHeaderVisualHeightMmForOptions(options, page),
  );
  if (mode === "contact") {
    const reduced = hasReducedContinuationHeader(options, page);
    const rows = (
      reduced
        ? [
            options.headerShowName && contact.name
              ? { key: "name", value: contact.name }
              : null,
            options.headerShowEmail && contact.email
              ? { key: "email", value: contact.email }
              : null,
            options.headerShowPhone && contact.phone
              ? { key: "phone", value: contact.phone }
              : null,
          ]
        : [
            options.headerShowName && contact.name
              ? { key: "name", value: contact.name }
              : null,
            options.headerShowAddress && contact.address
              ? { key: "address", value: contact.address }
              : null,
            options.headerShowAddress && contact.place
              ? { key: "place", value: contact.place }
              : null,
            options.headerShowPhone && contact.phone
              ? { key: "phone", value: contact.phone }
              : null,
            options.headerShowEmail && contact.email
              ? { key: "email", value: contact.email }
              : null,
          ]
    ).filter((row): row is HeaderContactRow => row !== null);
    const inline = reduced || options.headerTextLayout === "inline";
    const lines = inline
      ? [dossierDocxInlineHeaderText(rows, options.headerInlineSeparator)]
      : rows.map((row) => row.value);
    body += lines
      .map((line) =>
        paragraph(
          line,
          ink(background),
          !inline && options.headerShowName && line === contact.name,
        ),
      )
      .join("");
  }
  return part("header", body);
}
'''
s = s[:header_start] + new_header + s[header_end:]

old_margin = '''    if (options.headerMode === "contact") {
      const minTop = twips(
        dossierHeaderVisualHeightMmForOptions(options, 0) + 9 + (options.headerGapMm ?? 12),
      );
      properties = properties.replace(
        /w:top="(\\d+)"/,
        (_m, value) => `w:top="${Math.max(Number(value), minTop)}"`,
      );
    }
'''
new_margin = '''    const firstHeaderMode = effectiveDossierHeaderModeForOptions(options, 0);
    const continuationHeaderMode = effectiveDossierHeaderModeForOptions(options, 1);
    if (firstHeaderMode === "contact" || continuationHeaderMode === "contact") {
      // Word page margins are section-wide. Reserve enough top space for the
      // larger of page 1 and the continuation pages so an explicit full
      // contact header on page 2 can never overlap editable document content.
      const minTop = twips(
        Math.max(
          dossierHeaderContentTopMmForOptions(options, 0),
          dossierHeaderContentTopMmForOptions(options, 1),
        ),
      );
      properties = properties.replace(
        /w:top="(\\d+)"/,
        (_m, value) => `w:top="${Math.max(Number(value), minTop)}"`,
      );
    }
'''
s = replace_once(s, old_margin, new_margin, "docx page-aware top margin")
save(path, s)

# ---------------------------------------------------------------------------
# Focused regression coverage.
# ---------------------------------------------------------------------------
Path("tests/unit/dossier-package2.test.tsx").write_text(r'''import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  effectiveDossierHeaderModeForOptions,
  hasReducedContinuationHeader,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";
import { dossierDocxInlineHeaderText } from "../../src/lib/dossier-docx-chrome";

const contact = {
  name: "Lea Müller",
  address: "Bahnhofstrasse 42",
  place: "8000 Zürich",
  email: "lea@example.ch",
  phone: "079 123 45 67",
};
const colors = { primary: "#173a5e", secondary: "#315d7d", accent: "#315d7d" };

function markup(
  options: typeof DEFAULT_DOSSIER_CHROME_OPTIONS & {
    headerContinuationMode?: "compact" | "contact" | "none";
  },
  pageIndex: number,
) {
  return renderToStaticMarkup(
    createElement(DossierHeaderFooterChrome, {
      scope: "cv",
      template: "klassisch",
      colors,
      contact,
      pageIndex,
      options,
    }),
  );
}

describe("Package 2 continuation header model", () => {
  test("legacy JSON without continuation field preserves reduced contact behavior", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode: "contact" },
    });
    expect(state.shared.headerContinuationMode).toBeUndefined();
    expect(hasReducedContinuationHeader(state.shared, 1)).toBe(true);
    expect(effectiveDossierHeaderModeForOptions(state.shared, 1)).toBe("contact");
  });

  test("explicit continuation choices survive normalization", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerContinuationMode: "compact",
      },
    });
    expect(state.shared.headerContinuationMode).toBe("compact");
    expect(effectiveDossierHeaderModeForOptions(state.shared, 1)).toBe("compact");
    expect(hasReducedContinuationHeader(state.shared, 1)).toBe(false);
  });

  test("page 1 contact can switch to compact on page 2", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "compact" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="compact"');
    expect(html).toContain('data-dossier-continuation-mode="compact"');
    expect(html).toContain("data-dossier-compact-header");
    expect(html).not.toContain("data-dossier-continuation-contact-header");
    expect(html).not.toContain("Lea Müller");
  });

  test("page 1 compact can switch to full contact on page 2", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      headerContinuationMode: "contact" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="contact"');
    expect(html).toContain("data-dossier-integrated-contact");
    expect(html).toContain("Lea Müller");
    expect(html).toContain("Bahnhofstrasse 42");
    expect(html).toContain("8000 Zürich");
  });

  test("continuation header can be disabled independently", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "none" as const,
    };
    const html = markup(options, 1);
    expect(html).toContain('data-dossier-effective-header-mode="none"');
    expect(html).not.toContain("data-dossier-compact-header");
    expect(html).not.toContain("data-dossier-integrated-contact");
    expect(html).not.toContain("data-dossier-continuation-contact-header");
  });

  test("first-page-different off ignores but preserves dormant continuation choice", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      headerContinuationMode: "none" as const,
      headerDifferentFirstPage: false,
    };
    expect(effectiveDossierHeaderModeForOptions(options, 1)).toBe("contact");
    expect(options.headerContinuationMode).toBe("none");
    const html = markup(options, 1);
    expect(html).toContain("data-dossier-integrated-contact");
    expect(html).toContain("Bahnhofstrasse 42");
  });

  test("DOCX inline separator mapping reflects every existing separator choice", () => {
    const rows = [
      { key: "name" as const, value: "Lea Müller" },
      { key: "phone" as const, value: "079 123" },
      { key: "email" as const, value: "lea@example.ch" },
    ];
    expect(dossierDocxInlineHeaderText(rows, "dot")).toBe(
      "Lea Müller · 079 123 · lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "slash")).toBe(
      "Lea Müller / 079 123 / lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "pipe")).toBe(
      "Lea Müller | 079 123 | lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "space")).toBe(
      "Lea Müller     079 123     lea@example.ch",
    );
    expect(dossierDocxInlineHeaderText(rows, "icons")).toBe(
      "Lea Müller  ☎ 079 123  ✉ lea@example.ch",
    );
  });
});
''')

for transient in [
    ".github/workflows/apply-package2.yml",
    ".github/apply-package2.py",
]:
    candidate = Path(transient)
    if candidate.exists():
        candidate.unlink()
