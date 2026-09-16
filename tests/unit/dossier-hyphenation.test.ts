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

describe("selective dossier hyphenation", () => {
  test("is enabled by default and accepts old boolean project values", () => {
    expect(DEFAULT_DOSSIER_HYPHENATION_STATE.enabled).toBe(true);
    expect(normalizeDossierHyphenationState(null).enabled).toBe(true);
    expect(normalizeDossierHyphenationState(false).enabled).toBe(false);
    expect(normalizeDossierHyphenationState({ enabled: false }).enabled).toBe(false);
  });

  test("keeps the title page suppressed while enabling letter prose and CV descriptions", () => {
    const xml = [
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      p("Informatikerin Applikationsentwicklung EFZ"),
      p("", "<w:sectPr></w:sectPr>"),
      p("Die abwechslungsreiche Applikationsentwicklung begeistert mich."),
      p("Lea Müller"),
      p("", "<w:sectPr></w:sectPr>"),
      p("Selbstständige Projektarbeiten und Dokumentationen im Informatikunterricht."),
      p("lea.mueller@example.ch"),
      "</w:body></w:document>",
    ].join("");

    const patched = patchDossierDocxHyphenationXml(xml, letter, cv, true);
    const paragraphs = [...patched.matchAll(/<w:p>[\s\S]*?<\/w:p>/g)].map((match) => match[0]);

    expect(paragraphs[0]).toContain("<w:suppressAutoHyphens/>");
    expect(paragraphs[0]).not.toContain('w:lang w:val="de-CH"');
    expect(paragraphs[2]).toContain('<w:suppressAutoHyphens w:val="0"/>');
    expect(paragraphs[2]).toContain('<w:lang w:val="de-CH"/>');
    expect(paragraphs[3]).toContain("<w:suppressAutoHyphens/>");
    expect(paragraphs[5]).toContain('<w:suppressAutoHyphens w:val="0"/>');
    expect(paragraphs[5]).toContain('<w:lang w:val="de-CH"/>');
    expect(paragraphs[6]).toContain("<w:suppressAutoHyphens/>");
  });

  test("off explicitly suppresses automatic hyphenation everywhere", () => {
    const xml = `${p("Die abwechslungsreiche Applikationsentwicklung begeistert mich.")}`;
    const patched = patchDossierDocxHyphenationXml(xml, letter, cv, false);
    expect(patched).toContain("<w:suppressAutoHyphens/>");
    expect(patched).not.toContain('w:suppressAutoHyphens w:val="0"');
    expect(patched).not.toContain('w:lang w:val="de-CH"');
  });

  test("Word settings mirror the switch", () => {
    const settings =
      '<?xml version="1.0"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat/></w:settings>';
    const enabled = patchDossierDocxHyphenationSettings(settings, true);
    expect(enabled).toContain("<w:autoHyphenation/>");
    expect(patchDossierDocxHyphenationSettings(enabled, false)).not.toContain(
      "<w:autoHyphenation/>",
    );
  });

  test("Web/PDF policy targets only letter prose and CV descriptions, never the cover", () => {
    const source = readFileSync(
      "src/components/dossier/DossierHyphenationControl.tsx",
      "utf8",
    );
    expect(source).toContain('[data-letter-pdf-richtext="body"]');
    expect(source).toContain("[data-cv-entry] > div > [data-cv-body]");
    expect(source).not.toContain("data-dossier-document=\\\"cover\\\"");
    expect(source).toContain("Das Titelblatt bleibt unverändert.");
  });
});
