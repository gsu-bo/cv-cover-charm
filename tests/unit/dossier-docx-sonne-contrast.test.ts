import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { createDossierDocxBlob } from "../../src/lib/dossier-docx-export";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

const colors = {
  bg: "#333333",
  primary: "#fbbf24",
  light: "#f7f5f0",
  ink: "#141414",
};

function paragraphContaining(xml: string, text: string) {
  const index = xml.indexOf(`>${text}</w:t>`);
  if (index < 0) return "";
  const start = xml.lastIndexOf("<w:p>", index);
  const end = xml.indexOf("</w:p>", index);
  return start >= 0 && end >= 0 ? xml.slice(start, end + 6) : "";
}

async function sonneXml() {
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template: "sonne",
    colors,
    data: {
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatikerin EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    },
  });
  const letter = letterPdfDocumentFromSaved({
    version: 1,
    data: {
      absenderName: "Lea Müller",
      absenderAdresse: "Dorfstrasse 12",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "+41 79 123 45 67",
      absenderEmail: "lea@example.ch",
      empfaengerFirma: "Beispiel AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4535 Hubersdorf",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
      anrede: "Guten Tag Herr Weber",
      text: "Die Informatik begeistert mich.\n\nIch freue mich auf Ihre Rückmeldung.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: { template: "sonne", font: "freundlich", colors },
  });
  const cv = cvPdfDocumentFromSaved({
    version: 6,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Dorfstrasse 12",
        plzOrt: "4535 Hubersdorf",
        telefon: "+41 79 123 45 67",
        email: "lea@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin, 3. Sek B",
        foto: null,
      },
      schule: [
        {
          id: "schule-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Hubersdorf",
          beschreibung: "Sek B",
        },
      ],
      erfahrung: [],
      sprachen: [{ id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Programmieren"],
      staerken: ["Zuverlässig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: { template: "sonne", colors, bgOpacity: 0.25, useElements: false },
  });
  if (!cover || !letter || !cv) throw new Error("Sonne-Testdokument fehlt.");

  const blob = await createDossierDocxBlob(cover, letter, cv);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entry = readStoredDocxEntries(bytes).find((item) => item.name === "word/document.xml");
  if (!entry) throw new Error("document.xml fehlt");
  return new TextDecoder().decode(entry.bytes);
}

describe("Sonne DOCX contrast", () => {
  test("keeps the dark cover but uses readable white letter/CV paper", async () => {
    const xml = await sonneXml();
    expect(xml).toContain('id="warm-cover-paper"');
    expect(xml).toContain('id="warm-cover-paper" style=');
    expect(xml).toMatch(/id="warm-cover-paper"[^>]*fillcolor="#333333"/);
    expect(xml).toMatch(/id="warm-letter-paper"[^>]*fillcolor="#FFFFFF"/);
    expect(xml).toMatch(/id="warm-cv-paper"[^>]*fillcolor="#FFFFFF"/);
  });

  test("keeps all cover contact details white and matches the PDF CV accent circle", async () => {
    const xml = await sonneXml();
    const coverSection = xml.slice(0, xml.indexOf("<w:sectPr>"));
    expect(paragraphContaining(coverSection, "lea@example.ch")).toContain(
      'w:color w:val="FFFFFF"',
    );
    expect(paragraphContaining(coverSection, "14.03.2010")).toContain(
      'w:color w:val="FFFFFF"',
    );
    expect(xml).toMatch(/id="sonne-cv-light"[^>]*fillcolor="#fbbf24"/);
    expect(xml).toMatch(/id="sonne-cv-light"[\s\S]*?<v:fill opacity="26%"\/>/);
  });

  test("uses dedicated PDF-like editable cover overlays", async () => {
    const xml = await sonneXml();
    const coverSection = xml.slice(0, xml.indexOf("<w:sectPr>"));
    for (const id of [
      "sonne-docx-cover-kicker",
      "sonne-docx-cover-date",
      "sonne-docx-cover-name",
      "sonne-docx-cover-role-label",
      "sonne-docx-cover-role",
      "sonne-docx-cover-initials",
      "sonne-docx-cover-lehrbeginn",
      "sonne-docx-cover-contact",
      "sonne-docx-cover-attachments",
    ]) {
      expect(coverSection, id).toContain(`id="${id}"`);
    }
    expect(coverSection).toContain("Lehrbeginn August 2027");
    expect(coverSection).toContain(">LM</w:t>");
    expect(coverSection).toMatch(
      /id="docx-recipe-cover-photo-mat"[^>]*style="[^"]*margin-left:114mm;[^"]*margin-top:16mm;[^"]*width:78mm;[^"]*height:78mm;/,
    );
  });
});
