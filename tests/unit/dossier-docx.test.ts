import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import {
  briefDossierDocxSupported,
  createBriefDossierDocxBlob,
} from "../../src/lib/dossier-docx";

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function storedZipEntries(bytes: Uint8Array) {
  const result = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && u32(bytes, offset) === 0x04034b50) {
    const compressedSize = u32(bytes, offset + 18);
    const nameLength = u16(bytes, offset + 26);
    const extraLength = u16(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    result.set(name, bytes.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return result;
}

function documents(template = "brief") {
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template,
    data: {
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatikerin EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea@example.ch",
      lehrbetrieb: "Beispiel AG",
      ansprechperson: "Herr Thomas Weber",
      betriebAdresse: "Industriestrasse 8",
      ort: "Hubersdorf",
      datum: "15.11.2026",
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
    design: { template, font: "freundlich", colors: {} },
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
    design: { template, colors: {}, bgOpacity: 0.25, useElements: false },
  });
  if (!cover || !letter || !cv) throw new Error("Testdokumente konnten nicht erstellt werden.");
  return { cover, letter, cv };
}

describe("Brief DOCX reference export", () => {
  test("creates a readable OpenXML package with editable text and Cabin -> Trebuchet fallback", async () => {
    const { cover, letter, cv } = documents();
    expect(briefDossierDocxSupported(cover, letter, cv)).toBe(true);

    const blob = createBriefDossierDocxBlob(cover, letter, cv);
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(u32(bytes, 0)).toBe(0x04034b50);
    const entries = storedZipEntries(bytes);
    for (const required of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/fontTable.xml",
      "word/settings.xml",
      "docProps/core.xml",
      "docProps/app.xml",
    ]) {
      expect(entries.has(required)).toBe(true);
    }

    const decoder = new TextDecoder();
    const documentXml = decoder.decode(entries.get("word/document.xml"));
    const fontTableXml = decoder.decode(entries.get("word/fontTable.xml"));
    expect(documentXml).toContain("Informatikerin EFZ");
    expect(documentXml).toContain("Bewerbung um eine Lehrstelle");
    expect(documentXml).toContain("Lebenslauf");
    expect(documentXml).toContain("Schulbildung");
    expect(documentXml).toContain("Deutsch");
    expect(fontTableXml).toContain('w:font w:name="Cabin"');
    expect(fontTableXml).toContain('w:altName w:val="Trebuchet MS"');
  });

  test("refuses non-Brief dossiers until their visual contract is implemented", () => {
    const { cover, letter, cv } = documents("modern");
    expect(briefDossierDocxSupported(cover, letter, cv)).toBe(false);
    expect(() => createBriefDossierDocxBlob(cover, letter, cv)).toThrow(
      "nur für die Vorlage Brief",
    );
  });
});
