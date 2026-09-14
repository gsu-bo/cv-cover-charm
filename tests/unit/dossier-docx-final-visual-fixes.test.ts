import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import { createDossierDocxBlob as createStudio } from "../../src/lib/dossier-docx-templates/studio";
import { createDossierDocxBlob as createAurora } from "../../src/lib/dossier-docx-templates/aurora";
import { createDossierDocxBlob as createVerlauf } from "../../src/lib/dossier-docx-templates/verlauf";
import { createDossierDocxBlob as createVerlauf2 } from "../../src/lib/dossier-docx-templates/verlauf2";
import { createDossierDocxBlob as createVerlauf3 } from "../../src/lib/dossier-docx-templates/verlauf3";

const colors = {
  bg: "#f7f7f5",
  primary: "#334155",
  secondary: "#eab308",
  accent: "#0ea5e9",
  ink: "#1c2328",
};

function documents(template: string) {
  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template,
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
    design: { template, font: "freundlich", colors },
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
    design: { template, colors, bgOpacity: 0.25, useElements: false },
  });
  if (!cover || !letter || !cv) throw new Error(`Testdokument ${template} fehlt.`);
  return { cover, letter, cv };
}

async function xmlFor(
  template: string,
  create: (docs: ReturnType<typeof documents>) => Promise<Blob>,
) {
  const blob = await create(documents(template));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const entry = readStoredDocxEntries(bytes).find((item) => item.name === "word/document.xml");
  if (!entry) throw new Error("document.xml fehlt");
  return new TextDecoder().decode(entry.bytes);
}

function paragraphContaining(xml: string, text: string) {
  const index = xml.indexOf(`>${text}</w:t>`);
  if (index < 0) return "";
  const start = xml.lastIndexOf("<w:p>", index);
  const end = xml.indexOf("</w:p>", index);
  return start >= 0 && end >= 0 ? xml.slice(start, end + 6) : "";
}

describe("final DOCX visual fixes", () => {
  test("Studio keeps cover attachments readable over the pale circle", async () => {
    const xml = await xmlFor("studio", createStudio);
    const cover = xml.slice(0, xml.indexOf("<w:sectPr>"));
    for (const text of ["BEILAGEN", "Motivationsschreiben", "Lebenslauf", "Zeugnis"]) {
      expect(paragraphContaining(cover, text), text).toContain('<w:color w:val="232B3A"/>');
    }
  });

  test("Aurora keeps the profession visible on the cyan hero", async () => {
    const xml = await xmlFor("aurora", createAurora);
    const cover = xml.slice(0, xml.indexOf("<w:sectPr>"));
    const role = paragraphContaining(cover, "Informatiker/in EFZ");
    expect(role).toContain("Informatiker/in EFZ");
    expect(role).not.toMatch(/<w:color w:val="(?!111827)[0-9A-F]{6}"\/>/);
    expect((role.match(/<w:color w:val="111827"\/>/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  test("Verlauf uses a transparent white portrait ring instead of covering title text", async () => {
    const xml = await xmlFor("verlauf", createVerlauf);
    const cover = xml.slice(0, xml.indexOf("<w:sectPr>"));
    expect(cover).toMatch(
      /<v:oval[^>]*id="warm-cover-photo-mat"[^>]*z-index:251658050[^>]*filled="f" stroked="t" strokecolor="#FFFFFF" strokeweight="1\.2pt">/,
    );
    expect(cover).toContain('<v:fill opacity="0"/></v:oval>');
  });

  for (const [template, create] of [
    ["verlauf2", createVerlauf2],
    ["verlauf3", createVerlauf3],
  ] as const) {
    test(`${template} places the name fully below the hard hero boundary`, async () => {
      const xml = await xmlFor(template, create);
      const cover = xml.slice(0, xml.indexOf("<w:sectPr>"));
      const name = paragraphContaining(cover, "Lea Müller");
      expect(name).toContain('w:before="900"');
      expect((xml.match(/<w:sectPr>/g) ?? []).length).toBe(3);
    });
  }
});
