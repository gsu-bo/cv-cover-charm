import { expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { createDossierDocxBlob } from "../../src/lib/dossier-docx-export";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

function seriousDocuments() {
  const colors = {
    bg: "#ffffff",
    primary: "#1e3a5f",
    accent: "#94a3b8",
    ink: "#1f2937",
  };
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template: "serioes",
    data: {
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatikerin EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea@example.ch",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    },
    colors,
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
      text: "Die Informatik begeistert mich.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: { template: "serioes", font: "freundlich", colors },
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
      schule: [],
      erfahrung: [],
      sprachen: [],
      hobbys: [],
      staerken: [],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: { template: "serioes", colors, bgOpacity: 0.25, useElements: false },
  });
  if (!cover || !letter || !cv) throw new Error("Seriös DOCX fixture fehlt.");
  return { cover, letter, cv };
}

function documentXml(bytes: Uint8Array) {
  const entry = readStoredDocxEntries(bytes).find((item) => item.name === "word/document.xml");
  if (!entry) throw new Error("document.xml fehlt");
  return new TextDecoder().decode(entry.bytes);
}

function letterSection(xml: string) {
  const sections = [...xml.matchAll(/<w:sectPr>[\s\S]*?<\/w:sectPr>/g)];
  if (
    sections.length < 2 ||
    sections[0].index === undefined ||
    sections[1].index === undefined
  ) {
    throw new Error("DOCX enthält nicht die erwarteten drei Dossier-Sektionen.");
  }
  const start = sections[0].index + sections[0][0].length;
  return xml.slice(start, sections[1].index);
}

test("Seriös keeps the editable sender visible inside the letter section", async () => {
  const { cover, letter, cv } = seriousDocuments();
  const blob = await createDossierDocxBlob(cover, letter, cv);
  const section = letterSection(documentXml(new Uint8Array(await blob.arrayBuffer())));

  const senderIndex = section.indexOf(">Lea Müller</w:t>");
  expect(senderIndex).toBeGreaterThan(-1);
  const paragraphStart = section.lastIndexOf("<w:p>", senderIndex);
  const paragraphEnd = section.indexOf("</w:p>", senderIndex);
  const senderParagraph = section.slice(paragraphStart, paragraphEnd + 6);
  expect(senderParagraph).toContain('w:color w:val="1F2937"');
});
