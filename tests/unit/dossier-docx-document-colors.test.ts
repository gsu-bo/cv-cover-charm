import { describe, expect, test } from "bun:test";
import { DEMO_CV } from "../../src/components/cv/types";
import { DEMO_LETTER, emptyLetterDesign } from "../../src/components/letter/types";
import { applyDossierDocumentColorsToDocumentXml } from "../../src/lib/dossier-docx-document-colors";
import type {
  CoverPdfDocument,
  CvPdfDocument,
  LetterPdfDocument,
} from "../../src/lib/dossier-pdf-document";

const sectionBreak =
  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="1" w:h="1"/></w:sectPr></w:pPr></w:p>';
const demoSchoolTime = DEMO_CV.schule[0]?.zeit ?? "";

function paragraph(text: string, color = "111111") {
  return `<w:p><w:r><w:rPr><w:color w:val="${color}"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

function baseXml() {
  return [
    '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
    paragraph("Lea Müller"),
    sectionBreak,
    paragraph("Guten Tag Herr Weber"),
    paragraph("Hubersdorf, 15.11.2026", "777777"),
    sectionBreak,
    paragraph("Lea Müller"),
    paragraph("Schulbildung", "556677"),
    paragraph(demoSchoolTime, "667788"),
    '<w:sectPr><w:pgSz w:w="1" w:h="1"/></w:sectPr>',
    "</w:body></w:document>",
  ].join("");
}

function documents() {
  const cover = {
    template: "brief",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "Lehrbeginn August 2027",
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "079 123 45 67",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "Beispiel AG",
      ansprechperson: "Herr Thomas Weber",
      betriebAdresse: "Industriestrasse 8",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
    colors: { bg: "#ffffff", coverPaper: "#fff4e6", coverInk: "#24364b" },
    blocks: [],
    fontScale: 1,
  } as unknown as CoverPdfDocument;

  const letter = {
    data: DEMO_LETTER,
    design: {
      ...emptyLetterDesign(),
      paperColor: "#f7fbff",
      textColor: "#182230",
    },
  } satisfies LetterPdfDocument;

  const cv = {
    data: DEMO_CV,
    design: {
      template: "brief",
      colors: {
        bg: "#ffffff",
        primary: "#334155",
        cvInk: "#172033",
        cvMuted: "#52606d",
        cvHeading: "#1d4ed8",
      },
      paperColor: "#f8fafc",
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
    elementStyles: {},
  } satisfies CvPdfDocument;

  return { cover, letter, cv };
}

describe("DOCX document color parity", () => {
  test("applies explicit paper and semantic text colors to their own dossier sections", () => {
    const patched = applyDossierDocumentColorsToDocumentXml(baseXml(), documents());

    expect(patched).toContain('xmlns:v="urn:schemas-microsoft-com:vml"');
    expect(patched).toContain('id="dossier-cover-paper-override"');
    expect(patched).toContain('fillcolor="#FFF4E6"');
    expect(patched).toContain('id="dossier-letter-paper-override"');
    expect(patched).toContain('fillcolor="#F7FBFF"');
    expect(patched).toContain('id="dossier-cv-paper-override"');
    expect(patched).toContain('fillcolor="#F8FAFC"');

    const coverEnd = patched.indexOf(sectionBreak);
    const coverXml = patched.slice(0, coverEnd);
    expect(coverXml).toContain('<w:color w:val="24364B"/>');

    const letterStart = coverEnd + sectionBreak.length;
    const letterEnd = patched.indexOf(sectionBreak, letterStart);
    const letterXml = patched.slice(letterStart, letterEnd);
    expect(letterXml).toContain('<w:color w:val="182230"/>');
    expect(letterXml).toContain(
      '<w:color w:val="777777"/></w:rPr><w:t>Hubersdorf, 15.11.2026',
    );

    const cvXml = patched.slice(letterEnd + sectionBreak.length);
    expect(cvXml).toContain('<w:color w:val="172033"/></w:rPr><w:t>Lea Müller');
    expect(cvXml).toContain('<w:color w:val="1D4ED8"/></w:rPr><w:t>Schulbildung');
    expect(cvXml).toContain(`<w:color w:val="52606D"/></w:rPr><w:t>${demoSchoolTime}`);
  });

  test("is a no-op when no explicit document colors exist", () => {
    const current = documents();
    current.cover.colors = { bg: "#ffffff" };
    current.letter.design.paperColor = null;
    current.letter.design.textColor = null;
    current.cv.design.paperColor = null;
    current.cv.design.colors = { bg: "#ffffff", primary: "#334155" };

    const source = baseXml();
    expect(applyDossierDocumentColorsToDocumentXml(source, current)).toBe(source);
  });
});
