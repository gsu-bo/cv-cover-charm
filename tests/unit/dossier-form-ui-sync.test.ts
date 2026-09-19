import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const panel = readFileSync(
  new URL("../../src/components/dossier/ResizableEditorPanel.tsx", import.meta.url),
  "utf8",
);
const panelCss = readFileSync(
  new URL("../../src/components/dossier/EditorPanelIntro.css", import.meta.url),
  "utf8",
);
const section = readFileSync(
  new URL("../../src/components/cover/Section.tsx", import.meta.url),
  "utf8",
);
const chromeControls = readFileSync(
  new URL("../../src/components/dossier/DossierChromeControls.tsx", import.meta.url),
  "utf8",
);
const letterLayoutControls = readFileSync(
  new URL("../../src/components/letter/LetterLayoutControls.tsx", import.meta.url),
  "utf8",
);
const coverRoute = readFileSync(new URL("../../src/routes/titelblatt.tsx", import.meta.url), "utf8");
const letterRoute = readFileSync(
  new URL("../../src/routes/anschreiben.tsx", import.meta.url),
  "utf8",
);
const cvRoute = readFileSync(new URL("../../src/routes/lebenslauf.tsx", import.meta.url), "utf8");

describe("shared dossier form UI", () => {
  test("all three document editors use the same resizable left form panel", () => {
    for (const route of [coverRoute, letterRoute, cvRoute]) {
      expect(route).toContain("<ResizableEditorPanel open={panelOpen}>");
    }
    expect(panel).toContain("data-editor-form-scroll");
  });

  test("the shared shell owns width, spacing, scrolling and control rhythm", () => {
    expect(panelCss).toContain("width: min(92vw, 420px) !important");
    expect(panelCss).toContain("padding: 0.75rem !important");
    expect(panelCss).toContain("scrollbar-gutter: stable");
    expect(panelCss).toContain("min-height: 2.25rem");
    expect(panelCss).toContain('input[type="checkbox"]');
    expect(panelCss).toContain('input[type="range"]');
  });

  test("sections share content, design and advanced hierarchy without ellipsis", () => {
    expect(section).toContain('type FormGroup = "content" | "design" | "advanced"');
    expect(section).toContain('data-form-group={group}');
    expect(section).toContain("Inhalt");
    expect(section).toContain("Gestaltung");
    expect(section).toContain("Erweitert");
    expect(section).toContain("whitespace-normal break-words");
    expect(panelCss).toContain('[data-form-group="design"]');
    expect(panelCss).toContain('[data-form-group="advanced"]');
  });

  test("CV chrome controls have one visible owner instead of a duplicate panel host", () => {
    expect(panel).not.toContain("DossierChromeControls");
    expect(cvRoute).toContain('<DossierChromeControls scope="cv" />');
  });

  test("CV and letter share the same common header/footer control structure", () => {
    expect(chromeControls).toContain('label="Header-Inhalt – vertikale Position"');
    expect(chromeControls).not.toContain("Eigene Anschrift – vertikale Position");
    expect(chromeControls).not.toContain("Firma / Lehrbetrieb – vertikale Position");
    expect(letterLayoutControls).toContain('scope="letter"');
  });

  test("letter-only geometry is grouped below the shared chrome controls", () => {
    expect(letterLayoutControls).toContain("Briefspezifische Positionen");
    expect(letterLayoutControls).toContain("data-letter-specific-layout-controls");
    expect(letterLayoutControls).toContain("data-letter-recipient-offset-control");
    expect(letterLayoutControls).toContain('label="Eigene Anschrift"');
    expect(letterLayoutControls.indexOf("<DossierChromeControls")).toBeLessThan(
      letterLayoutControls.indexOf("Briefspezifische Positionen"),
    );
  });
});
