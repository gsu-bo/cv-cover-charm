from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def section_bounds(source: str, title: str, indent: str) -> tuple[int, int]:
    title_index = source.index(f'title="{title}"')
    start = source.rfind(f"{indent}<Section", 0, title_index)
    if start < 0:
        raise SystemExit(f"section {title}: opening Section not found")
    closing = f"\n{indent}</Section>"
    end = source.index(closing, title_index) + len(closing)
    return start, end


# ---------------------------------------------------------------------------
# Letter: Layout owns only letter-specific layout + page margins.
# ---------------------------------------------------------------------------
letter_layout_path = "src/components/letter/LetterLayoutControls.tsx"
letter_layout = read(letter_layout_path)
letter_layout = replace_once(
    letter_layout,
    'import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";\n',
    "",
    "remove letter chrome import",
)
letter_layout = replace_once(
    letter_layout,
    'import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";\n',
    "",
    "remove letter typography import",
)
letter_layout = replace_once(
    letter_layout,
    "function legacyChromePatch(patch: Partial<DossierChromeOptions>): Partial<LetterDesign> {",
    "export function legacyLetterChromePatch(\n  patch: Partial<DossierChromeOptions>,\n): Partial<LetterDesign> {",
    "export letter legacy chrome bridge",
)
letter_layout = replace_once(
    letter_layout,
    '''      <DossierChromeControls
        scope="letter"
        onOptionsChange={(patch) => onChange(legacyChromePatch(patch))}
      />

''',
    "",
    "remove letter chrome rendering from Layout",
)
letter_layout = replace_once(
    letter_layout,
    "      <DossierHyphenationControl />\n\n",
    "",
    "remove letter typography rendering from Layout",
)
letter_layout = replace_once(
    letter_layout,
    '''            Diese Einstellungen gelten nur fürs Motivationsschreiben. Header und Footer darüber sind
            identisch aufgebaut wie im Lebenslauf.''',
    '''            Diese Einstellungen gelten nur fürs Motivationsschreiben. Header und Footer findest du
            im eigenen Bereich „Header & Footer“.''',
    "update letter layout ownership help",
)
if "<DossierChromeControls" in letter_layout or "<DossierHyphenationControl" in letter_layout:
    raise SystemExit("LetterLayoutControls still renders a shared chrome/typography control")
write(letter_layout_path, letter_layout)


# ---------------------------------------------------------------------------
# Letter route: Vorlage -> Header & Footer -> Layout, typography in Schrift.
# ---------------------------------------------------------------------------
letter_route_path = "src/routes/anschreiben.tsx"
letter_route = read(letter_route_path)
letter_route = replace_once(
    letter_route,
    'import { EditorMenuLabel } from "@/components/dossier/EditorMenuLabel";\n',
    '''import { EditorMenuLabel } from "@/components/dossier/EditorMenuLabel";
import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierHyphenationControl } from "@/components/dossier/DossierHyphenationControl";
''',
    "add letter shared control imports",
)
letter_route = replace_once(
    letter_route,
    'import { LetterLayoutControls } from "@/components/letter/LetterLayoutControls";\n',
    '''import {
  LetterLayoutControls,
  legacyLetterChromePatch,
} from "@/components/letter/LetterLayoutControls";
''',
    "import letter chrome compatibility bridge",
)
letter_route = replace_once(
    letter_route,
    '''    layout: false,
    brief: true,''',
    '''    layout: false,
    chrome: false,
    brief: true,''',
    "add letter chrome section state",
)
layout_start, layout_end = section_bounds(letter_route, "Layout", "            ")
vorlage_start, vorlage_end = section_bounds(letter_route, "Vorlage", "            ")
if layout_start > vorlage_start:
    raise SystemExit("unexpected letter section order before Package 2")
between = letter_route[layout_end:vorlage_start]
if between.strip():
    raise SystemExit("unexpected content between Letter Layout and Vorlage sections")
layout_section = letter_route[layout_start:layout_end]
vorlage_section = letter_route[vorlage_start:vorlage_end]
header_footer_section = '''            <Section
              title="Header & Footer"
              open={open.chrome}
              onToggle={() => toggle("chrome")}
            >
              <DossierChromeControls
                scope="letter"
                onOptionsChange={(patch) =>
                  setDesign((current) => ({ ...current, ...legacyLetterChromePatch(patch) }))
                }
              />
            </Section>'''
letter_route = (
    letter_route[:layout_start]
    + vorlage_section
    + "\n\n"
    + header_footer_section
    + "\n\n"
    + layout_section
    + letter_route[vorlage_end:]
)
letter_route = replace_once(
    letter_route,
    '''            <Section title="Schrift" open={open.typo} onToggle={() => toggle("typo")}>
              <label className="block text-xs font-medium">''',
    '''            <Section title="Schrift" open={open.typo} onToggle={() => toggle("typo")}>
              <DossierHyphenationControl />

              <label className="block text-xs font-medium">''',
    "place shared typography control in letter Schrift",
)
if letter_route.count("<DossierChromeControls") != 1:
    raise SystemExit("letter route must render DossierChromeControls exactly once")
if letter_route.count("<DossierHyphenationControl") != 1:
    raise SystemExit("letter route must render DossierHyphenationControl exactly once")
write(letter_route_path, letter_route)


# ---------------------------------------------------------------------------
# CV: expose existing margin engine and separate Layout from Schrift.
# ---------------------------------------------------------------------------
cv_route_path = "src/routes/lebenslauf.tsx"
cv_route = read(cv_route_path)
cv_route = replace_once(
    cv_route,
    'import { CvCanvas, type CvLayoutWarning } from "@/components/cv/CvCanvas";\n',
    '''import { CvCanvas, type CvLayoutWarning } from "@/components/cv/CvCanvas";
import { CvPageMarginsControl } from "@/components/cv/CvPageMarginsControl";
''',
    "import CV page margins UI adapter",
)
cv_route = replace_once(
    cv_route,
    '''    chrome: false,
    farben: false,''',
    '''    chrome: false,
    layout: false,
    farben: false,''',
    "add CV layout section state",
)
sidebar_text_marker = '''<span className="text-muted-foreground">
                      Seitenspalte'''
marker_pos = cv_route.index(sidebar_text_marker)
sidebar_start = cv_route.rfind(
    '                  <label className="flex flex-col gap-1 text-xs">',
    0,
    marker_pos,
)
if sidebar_start < 0:
    raise SystemExit("CV sidebar control start not found")
sidebar_closing = "\n                  </label>"
sidebar_end = cv_route.index(sidebar_closing, marker_pos) + len(sidebar_closing)
sidebar_block = cv_route[sidebar_start:sidebar_end]
cv_route = cv_route[:sidebar_start] + cv_route[sidebar_end:]
chrome_start, chrome_end = section_bounds(cv_route, "Header & Footer", "              ")
cv_layout_section = f'''\n\n              <Section title="Layout" open={{open.layout}} onToggle={{() => toggle("layout")}}>
                <div className="flex flex-col gap-3">
                  <CvPageMarginsControl design={{design}} chromeOptions={{chromeOptions}} />

{sidebar_block}
                </div>
              </Section>'''
cv_route = cv_route[:chrome_end] + cv_layout_section + cv_route[chrome_end:]
cv_route = replace_once(
    cv_route,
    'title="Schrift und Layout"',
    'title="Schrift"',
    "rename CV typography section",
)
if cv_route.count("<DossierChromeControls") != 1:
    raise SystemExit("CV route must render DossierChromeControls exactly once")
if cv_route.count("<DossierHyphenationControl") != 1:
    raise SystemExit("CV route must render DossierHyphenationControl exactly once")
if cv_route.count("<CvPageMarginsControl") != 1:
    raise SystemExit("CV route must render CvPageMarginsControl exactly once")
write(cv_route_path, cv_route)


# ---------------------------------------------------------------------------
# Tiny CV UI adapter: existing geometry functions + existing shared control.
# No new store and no renderer change.
# ---------------------------------------------------------------------------
write(
    "src/components/cv/CvPageMarginsControl.tsx",
    '''import { useSyncExternalStore } from "react";
import { DossierPageMarginsControl } from "@/components/dossier/DossierPageMarginsControl";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";
import {
  cvDefaultContentBox,
  cvFrameFor,
  cvSafePageMarginMinimums,
} from "./archetype";
import { getCvLayout, subscribeCvLayout } from "./layout";
import type { CvDesign } from "./types";

/**
 * Editor-only adapter around the existing shared page-margin store and the
 * existing CV geometry helpers. It exposes controls without changing defaults,
 * clamping rules or renderer ownership.
 */
export function CvPageMarginsControl({
  design,
  chromeOptions,
}: {
  design: CvDesign;
  chromeOptions: DossierChromeOptions;
}) {
  const layout = useSyncExternalStore(subscribeCvLayout, getCvLayout, () => "classic");
  const frame = cvFrameFor(design.template);
  const defaultMargins = cvDefaultContentBox(
    frame,
    0,
    layout,
    design.sidebarPct,
    chromeOptions,
  );
  const minimumMargins = cvSafePageMarginMinimums(
    frame,
    0,
    layout,
    design.sidebarPct,
    chromeOptions,
  );
  const accentColor = design.colors.accent ?? design.colors.primary ?? design.colors.ink;

  return (
    <DossierPageMarginsControl
      scope="cv"
      defaultMargins={defaultMargins}
      minimumMargins={minimumMargins}
      accentColor={accentColor}
    />
  );
}
''',
)


# ---------------------------------------------------------------------------
# Focused structural tests.
# ---------------------------------------------------------------------------
write(
    "tests/unit/shared-editor-controls-consistency.test.ts",
    '''import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cv = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const letter = readFileSync("src/routes/anschreiben.tsx", "utf8");
const letterLayout = readFileSync("src/components/letter/LetterLayoutControls.tsx", "utf8");
const cvMargins = readFileSync("src/components/cv/CvPageMarginsControl.tsx", "utf8");

const count = (source: string, pattern: RegExp) => source.match(pattern)?.length ?? 0;

function section(source: string, title: string): string {
  const titleIndex = source.indexOf(`title="${title}"`);
  expect(titleIndex).toBeGreaterThan(-1);
  const start = source.lastIndexOf("<Section", titleIndex);
  const end = source.indexOf("</Section>", titleIndex);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(titleIndex);
  return source.slice(start, end + "</Section>".length);
}

describe("shared CV / letter editor control ownership", () => {
  test("renders exactly one dedicated Header & Footer section and one chrome control per editor", () => {
    expect(count(cv, /title="Header & Footer"/g)).toBe(1);
    expect(count(letter, /title="Header & Footer"/g)).toBe(1);
    expect(count(cv, /<DossierChromeControls\\b/g)).toBe(1);
    expect(count(letter, /<DossierChromeControls\\b/g)).toBe(1);
    expect(letterLayout).not.toContain("<DossierChromeControls");
    expect(section(cv, "Header & Footer")).toContain('scope="cv"');
    expect(section(letter, "Header & Footer")).toContain('scope="letter"');
  });

  test("exposes exactly one shared page-margin control for each document scope", () => {
    expect(count(cv, /<CvPageMarginsControl\\b/g)).toBe(1);
    expect(count(cvMargins, /<DossierPageMarginsControl\\b/g)).toBe(1);
    expect(cvMargins).toContain('scope="cv"');
    expect(count(letterLayout, /<DossierPageMarginsControl\\b/g)).toBe(1);
    expect(letterLayout).toContain('scope="letter"');
    expect(letter).not.toContain("<DossierPageMarginsControl");
  });

  test("places the historical shared typography control in Schrift in both editors", () => {
    const cvTypography = section(cv, "Schrift");
    const letterTypography = section(letter, "Schrift");
    expect(cvTypography).toContain("<DossierHyphenationControl />");
    expect(letterTypography).toContain("<DossierHyphenationControl />");
    expect(count(cv, /<DossierHyphenationControl\\b/g)).toBe(1);
    expect(count(letter, /<DossierHyphenationControl\\b/g)).toBe(1);
    expect(letterLayout).not.toContain("DossierHyphenationControl");
  });

  test("keeps document-specific Layout controls in their owning editor", () => {
    const cvLayout = section(cv, "Layout");
    expect(cvLayout).toContain("<CvPageMarginsControl");
    expect(cvLayout).toContain("Seitenspalte");
    expect(cv).toContain("Rubriktitel gestalten");

    expect(letterLayout).toContain("Firma / Lehrbetrieb – vertikale Position");
    expect(letterLayout).toContain('label="Meine Kontaktdaten"');
    expect(letterLayout).toContain('label="Firma / Lehrbetrieb"');
    expect(letterLayout).toContain('label="Ort & Datum"');
    expect(letterLayout).toContain("Trennlinie nach meinen Kontaktdaten");
  });

  test("keeps Package 1 motif controls under Vorlage in both editors", () => {
    const cvTemplate = section(cv, "Vorlage");
    const letterTemplate = section(letter, "Vorlage");
    expect(cvTemplate).toContain("Hintergrund-Motiv");
    expect(letterTemplate).toContain("motifOpacity={design.bgOpacity}");
    expect(letterTemplate).toContain("onMotifOpacityChange");
  });
});
''',
)


# ---------------------------------------------------------------------------
# Targeted browser verification for placement, persistence and chrome sync.
# ---------------------------------------------------------------------------
write(
    "tests/e2e/shared-editor-controls-consistency.spec.ts",
    '''import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:5173";

async function resetStorage(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => window.localStorage.clear());
}

async function ready(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
}

async function section(page: Page, title: string): Promise<Locator> {
  const target = page.locator(`[data-editor-section-title="${title}"]`);
  await expect(target).toHaveCount(1);
  return target;
}

async function openSection(page: Page, title: string): Promise<Locator> {
  const target = await section(page, title);
  const toggle = target.locator("[data-editor-section-toggle]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return target;
}

async function setRange(control: Locator, value: number) {
  await control.evaluate((node, next) => {
    const input = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function openMargins(container: Locator, scope: "cv" | "letter") {
  const details = container.locator(`[data-dossier-page-margins-control="${scope}"]`);
  await expect(details).toHaveCount(1);
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
  return details;
}

test.describe("shared editor controls consistency", () => {
  test("CV owns one of each shared section and persists chrome + margins", async ({ page }) => {
    await resetStorage(page);
    await ready(page, "/lebenslauf");

    for (const title of ["Vorlage", "Header & Footer", "Layout", "Schrift"]) {
      await expect(page.locator(`[data-editor-section-title="${title}"]`)).toHaveCount(1);
    }

    const template = await openSection(page, "Vorlage");
    await expect(template.getByText(/Hintergrund-Motiv/).first()).toBeVisible();

    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator('[data-dossier-chrome-controls="cv"]')).toHaveCount(1);
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");
    const gap = chrome.locator("[data-dossier-header-gap-control]");
    await expect(gap).toBeVisible();
    await setRange(gap, 17);
    await expect(gap).toHaveValue("17");

    let layout = await openSection(page, "Layout");
    await expect(layout.getByText(/Seitenspalte/).first()).toBeVisible();
    let margins = await openMargins(layout, "cv");
    const right = margins.getByLabel("Seitenrand Rechts in Millimetern");
    await right.fill("30");
    await right.press("Tab");
    await expect(right).toHaveValue("30");

    const typography = await openSection(page, "Schrift");
    await expect(typography.locator("[data-cv-doc-title-margin-top-control]")).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await expect(chrome.locator("[data-dossier-header-gap-control]")).toHaveValue("17");
    layout = await openSection(page, "Layout");
    margins = await openMargins(layout, "cv");
    await expect(margins.getByLabel("Seitenrand Rechts in Millimetern")).toHaveValue("30");
  });

  test("Letter owns one of each shared section and keeps letter-specific Layout controls", async ({ page }) => {
    await resetStorage(page);
    await ready(page, "/anschreiben");

    for (const title of ["Vorlage", "Header & Footer", "Layout", "Schrift"]) {
      await expect(page.locator(`[data-editor-section-title="${title}"]`)).toHaveCount(1);
    }

    const template = await openSection(page, "Vorlage");
    await expect(template.getByRole("slider", { name: "Hintergrund-Motiv" })).toHaveValue("25");

    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator('[data-dossier-chrome-controls="letter"]')).toHaveCount(1);
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");
    const gap = chrome.locator("[data-dossier-header-gap-control]");
    await setRange(gap, 16);
    await expect(gap).toHaveValue("16");

    let layout = await openSection(page, "Layout");
    await expect(layout.getByRole("slider", { name: "Firma / Lehrbetrieb – vertikale Position" })).toBeVisible();
    let margins = await openMargins(layout, "letter");
    const left = margins.getByLabel("Seitenrand Links in Millimetern");
    await left.fill("31");
    await left.press("Tab");
    await expect(left).toHaveValue("31");

    const typography = await openSection(page, "Schrift");
    await expect(typography.locator("[data-cv-doc-title-margin-top-control]")).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await expect(chrome.locator("[data-dossier-header-gap-control]")).toHaveValue("16");
    layout = await openSection(page, "Layout");
    margins = await openMargins(layout, "letter");
    await expect(margins.getByLabel("Seitenrand Links in Millimetern")).toHaveValue("31");
  });

  test("Header & Footer sync still shares changes and can be disabled", async ({ page }) => {
    await resetStorage(page);
    await ready(page, "/lebenslauf");
    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-chrome-sync]")).toBeChecked();
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");

    await ready(page, "/anschreiben");
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await chrome.locator("[data-dossier-chrome-sync]").uncheck();
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("none");

    await ready(page, "/lebenslauf");
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-chrome-sync]")).not.toBeChecked();
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
  });
});
''',
)
