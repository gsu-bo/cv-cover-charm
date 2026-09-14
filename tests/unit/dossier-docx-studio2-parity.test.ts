import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { createDossierDocxBlob } from "../../src/lib/dossier-docx-export";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

const colors = {
  bg: "#fbfbf8",
  primary: "#202a3b",
  secondary: "#f2c84b",
  accent: "#e78a2f",
  ink: "#1b2430",
};

async function studio2Xml() {
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template: "studio2",
    colors,
    data: {
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea.mueller@example.ch",
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
      absenderEmail: "lea.mueller@example.ch",
      empfaengerFirma: "Beispiel AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4535 Hubersdorf",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
      anrede: "Guten Tag Herr Weber",
      text: "Die Informatik begeistert mich.\n\nIch freue mich auf Ihre Rückmeldung.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: { template: "studio2", font: "freundlich", colors },
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
        email: "lea.mueller@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin, Niveau A",
        foto: null,
      },
      schule: [
        {
          id: "schule-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule, Niveau A",
          ort: "Schulhaus Zentrum, Hubersdorf",
          beschreibung: "Schwerpunkt Mathematik und Informatik",
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
    design: { template: "studio2", colors, bgOpacity: 0.25, useElements: false },
  });
  if (!cover || !letter || !cv) throw new Error("Studio-2-Testdokument fehlt.");

  const blob = await createDossierDocxBlob(cover, letter, cv);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entry = readStoredDocxEntries(bytes).find((item) => item.name === "word/document.xml");
  if (!entry) throw new Error("document.xml fehlt");
  return new TextDecoder().decode(entry.bytes);
}

describe("Studio 2 DOCX PDF parity", () => {
  test("uses the PDF-like split cover and editable hero overlays", async () => {
    const xml = await studio2Xml();
    const cover = xml.slice(0, xml.indexOf("<w:sectPr>"));

    expect(cover).toMatch(
      /id="studio2-cover-rail"[^>]*margin-left:0mm;[^>]*margin-top:0mm;[^>]*width:210mm;[^>]*height:96mm;[^>]*fillcolor="#202a3b"/,
    );
    expect(cover).toMatch(
      /id="studio2-cover-signal"[^>]*margin-left:124mm;[^>]*margin-top:0mm;[^>]*width:86mm;[^>]*height:96mm;/,
    );
    expect(cover).toContain('<v:shape id="studio2-cover-signal" coordorigin="0,0" coordsize="1000,1000"');
    expect(cover).toContain('path="m 0,0 l 1000,0 1000,1000 190,1000 c 85,1000 0,915 0,810 l 0,0 x e"');
    expect(cover).not.toContain('studio2-cover-signal-top-square');
    expect(cover).not.toContain('studio2-cover-signal-right-square');
    expect(cover).toMatch(
      /<v:oval id="docx-recipe-cover-photo-mat"[^>]*margin-left:128mm;[^>]*margin-top:54mm;[^>]*width:49mm;[^>]*height:49mm;/,
    );
    expect(cover).toContain(">LM</w:t>");
    for (const id of [
      "studio2-docx-cover-name",
      "studio2-docx-cover-role",
      "studio2-docx-cover-lehrbeginn",
      "studio2-docx-cover-contact",
      "studio2-docx-cover-attachments",
    ]) {
      expect(cover, id).toContain(`id="${id}"`);
    }
    expect(cover).toContain("Lehrbeginn · August 2027");
  });

  test("matches the PDF letter masthead and CV sidebar geometry", async () => {
    const xml = await studio2Xml();

    expect(xml).toMatch(
      /id="studio2-letter-rail"[^>]*margin-left:0mm;[^>]*margin-top:0mm;[^>]*width:210mm;[^>]*height:22mm;/,
    );
    expect(xml).toMatch(
      /id="studio2-letter-signal"[^>]*margin-left:153mm;[^>]*margin-top:19mm;[^>]*width:57mm;[^>]*height:20mm;/,
    );
    expect(xml).toContain('id="studio2-docx-letter-contact"');

    expect(xml).toMatch(
      /id="studio2-cv-rail"[^>]*margin-left:0mm;[^>]*margin-top:0mm;[^>]*width:58mm;[^>]*height:297mm;/,
    );
    expect(xml).toMatch(
      /id="studio2-cv-signal"[^>]*margin-left:153mm;[^>]*margin-top:0mm;[^>]*width:57mm;[^>]*height:22mm;/,
    );
    expect(xml).toContain('id="studio2-docx-cv-contact"');
    expect(xml).toMatch(
      /id="studio2-cv-rail-rule"[^>]*margin-left:10mm;[^>]*margin-top:10mm;[^>]*width:190mm;[^>]*height:277mm;[^>]*strokecolor="#f5d9bc"/,
    );
    expect(xml).toContain('w:bottom w:val="single" w:sz="8" w:space="1" w:color="B18F6F"');
    expect(
      (xml.match(/<w:tcBorders><w:left w:val="single" w:sz="28" w:space="0" w:color="F2C84B"\/><\/w:tcBorders>/g) ?? []).length,
    ).toBeGreaterThanOrEqual(4);
    expect(xml).not.toContain('<w:pBdr><w:left w:val="single" w:sz="24"');
    expect(xml).toMatch(/<w:color w:val="626974"\/><\/w:rPr><w:t xml:space="preserve">2023 – heute<\/w:t>/);
    expect(xml).toMatch(/<w:color w:val="626974"\/><\/w:rPr><w:t xml:space="preserve">Muttersprache<\/w:t>/);
    expect((xml.match(/<w:sectPr>/g) ?? []).length).toBe(3);
  });
});
