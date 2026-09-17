import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  patchDossierDocxHyphenationSettings,
  patchDossierDocxHyphenationXml,
} from "../../src/lib/dossier-docx-hyphenation";
import {
  DEFAULT_DOSSIER_HYPHENATION_STATE,
  normalizeDossierHyphenationState,
} from "../../src/lib/dossier-hyphenation";
import type { CvPdfDocument, LetterPdfDocument } from "../../src/lib/dossier-pdf-document";

const letter = {
  data: {
    text: "Die abwechslungsreiche Applikationsentwicklung begeistert mich.",
  },
} as unknown as LetterPdfDocument;

const cv = {
  data: {
    schule: [
      {
        beschreibung: "Selbstständige Projektarbeiten und Dokumentationen im Informatikunterricht.",
      },
    ],
    erfahrung: [],
    customSections: [],
  },
} as unknown as CvPdfDocument;

const p = (text: string, extra = "") =>
  `<w:p><w:pPr>${extra}</w:pPr><w:r><w:rPr></w:rPr><w:t>${text}</w:t></w:r></w:p>`;

describe("retired dossier hyphenation", () => {
  test("is permanently disabled, including legacy and imported true values", () => {
    expect(DEFAULT_DOSSIER_HYPHENATION_STATE.enabled).toBe(false);
    expect(normalizeDossierHyphenationState(null).enabled).toBe(false);
    expect(normalizeDossierHyphenationState(true).enabled).toBe(false);
    expect(normalizeDossierHyphenationState({ enabled: true }).enabled).toBe(false);
    expect(normalizeDossierHyphenationState(false).enabled).toBe(false);
  });

  test("suppresses automatic hyphenation in every Word paragraph", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      p("Informatikerin Applikationsentwicklung EFZ"),
      p("Die abwechslungsreiche Applikationsentwicklung begeistert mich."),
      p("Selbstständige Projektarbeiten und Dokumentationen im Informatikunterricht."),
      "</w:body></w:document>",
    ].join("");

    const patched = patchDossierDocxHyphenationXml(xml, letter, cv, true);
    const paragraphs = [...patched.matchAll(/<w:p>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);

    expect(paragraphs).toHaveLength(3);
    for (const paragraph of paragraphs) {
      expect(paragraph).toContain("<w:suppressAutoHyphens/>");
      expect(paragraph).not.toContain('w:suppressAutoHyphens w:val="0"');
      expect(paragraph).not.toContain('w:lang w:val="de-CH"');
    }
  });

  test("Word settings never enable auto-hyphenation", () => {
    const settings =
      '<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat/><w:autoHyphenation/></w:settings>';
    expect(patchDossierDocxHyphenationSettings(settings, true)).not.toContain(
      "<w:autoHyphenation/>",
    );
    expect(patchDossierDocxHyphenationSettings(settings, false)).not.toContain(
      "<w:autoHyphenation/>",
    );
  });

  test("Web/PDF policy is permanently no-hyphenation and the retired control renders nothing", () => {
    const source = readFileSync(
      "src/components/dossier/DossierHyphenationControl.tsx",
      "utf8",
    );
    expect(source).toContain('[data-letter-pdf-richtext="body"]');
    expect(source).toContain("[data-cv-entry] [data-cv-body]");
    expect(source).toContain("hyphens: none;");
    expect(source).toContain("overflow-wrap: normal;");
    expect(source).not.toContain("hyphens: auto;");
    expect(source).toContain("export function DossierHyphenationControl() {");
    expect(source).toContain("return null;");
  });
});
