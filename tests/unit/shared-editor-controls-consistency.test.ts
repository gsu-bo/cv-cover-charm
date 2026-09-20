import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const cv = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const letter = readFileSync("src/routes/anschreiben.tsx", "utf8");
const letterLayout = readFileSync("src/components/letter/LetterLayoutControls.tsx", "utf8");
const cvMargins = readFileSync("src/components/cv/CvPageMarginsControl.tsx", "utf8");
const typographyControl = readFileSync(
  "src/components/dossier/DossierHyphenationControl.tsx",
  "utf8",
);

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
    expect(count(cv, /<DossierChromeControls\b/g)).toBe(1);
    expect(count(letter, /<DossierChromeControls\b/g)).toBe(1);
    expect(letterLayout).not.toContain("<DossierChromeControls");
    expect(section(cv, "Header & Footer")).toContain('scope="cv"');
    expect(section(letter, "Header & Footer")).toContain('scope="letter"');
  });

  test("exposes exactly one shared page-margin control for each document scope", () => {
    expect(count(cv, /<CvPageMarginsControl\b/g)).toBe(1);
    expect(count(cvMargins, /<DossierPageMarginsControl\b/g)).toBe(1);
    expect(cvMargins).toContain('scope="cv"');
    expect(count(letterLayout, /<DossierPageMarginsControl\b/g)).toBe(1);
    expect(letterLayout).toContain('scope="letter"');
    expect(letter).not.toContain("<DossierPageMarginsControl");
  });

  test("keeps CV-only document-title spacing under CV Schrift and out of Letter", () => {
    const cvTypography = section(cv, "Schrift");
    const letterTypography = section(letter, "Schrift");

    expect(cvTypography).toContain("<DossierHyphenationControl />");
    expect(count(cv, /<DossierHyphenationControl\b/g)).toBe(1);
    expect(typographyControl).toContain("data-cv-doc-title-margin-top-control");
    expect(typographyControl).toContain("Dokumenttitel – Abstand nach oben");

    expect(letterTypography).not.toContain("DossierHyphenationControl");
    expect(letterTypography).toContain("letterFontSelection(design)");
    expect(letterTypography).toContain("Schriftart");
    expect(count(letter, /<DossierHyphenationControl\b/g)).toBe(0);
    expect(letter).not.toContain("data-cv-doc-title-margin-top-control");
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
