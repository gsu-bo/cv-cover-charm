import { describe, expect, test } from "bun:test";
import { DEMO_CV } from "../../src/components/cv/types";
import { createDossierDocxBlob } from "../../src/lib/dossier-docx-export";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

const colors = {
  primary: "#8c4a3d",
  secondary: "#d7a98f",
  accent: "#8c4a3d",
  ink: "#201a18",
  bg: "#fffaf7",
};

function kolumneDocuments() {
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template: "terracotta",
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
      text: "Die Informatik begeistert mich.\n\nIch freue mich auf Ihre Rückmeldung.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: { template: "terracotta", font: "freundlich", colors },
  });
  const cv = cvPdfDocumentFromSaved({
    version: 6,
    data: DEMO_CV,
    design: { template: "terracotta", colors, bgOpacity: 0.25, useElements: false },
  });

  if (!cover || !letter || !cv) throw new Error("Kolumne DOCX test documents are incomplete.");
  return { cover, letter, cv };
}

function expectBalancedTableStructure(xml: string) {
  const stack: string[] = [];
  for (const match of xml.matchAll(/<\/?w:(tbl|tr|tc)(?:\s[^>]*|)>/g)) {
    const closing = match[0].startsWith("</");
    const tag = match[1];
    if (closing) {
      expect(stack.pop()).toBe(tag);
    } else if (!match[0].endsWith("/>")) {
      stack.push(tag);
    }
  }
  expect(stack).toEqual([]);
}

describe("Kolumne DOCX structure", () => {
  test("keeps the default family order and valid nested sidebar table XML", async () => {
    const documents = kolumneDocuments();
    const blob = await createDossierDocxBlob(documents.cover, documents.letter, documents.cv);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const documentEntry = readStoredDocxEntries(bytes).find(
      (entry) => entry.name === "word/document.xml",
    );

    expect(documentEntry).toBeDefined();
    const xml = new TextDecoder().decode(documentEntry!.bytes);
    expectBalancedTableStructure(xml);
    expect(xml.indexOf("FAMILIE")).toBeGreaterThan(-1);
    expect(xml.indexOf("SCHULBILDUNG")).toBeGreaterThan(-1);
    expect(xml.indexOf("FAMILIE")).toBeLessThan(xml.indexOf("SCHULBILDUNG"));
  });
});
