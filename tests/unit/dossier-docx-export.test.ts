import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import {
  DOSSIER_DOCX_PROFILES,
  createDossierDocxBlob,
  resolveDossierDocxProfile,
} from "../../src/lib/dossier-docx-export";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  transformStoredDocxDocumentXml,
  writeStoredDocxEntries,
} from "../../src/lib/dossier-docx-package";

function documents(template: string) {
  const palettes: Record<string, Record<string, string>> = {
    brief: {},
    freundlich: {
      primary: "#0f766e",
      secondary: "#f59e0b",
      ink: "#0b1f24",
      bg: "#fff9ef",
    },
    studio3: {
      primary: "#173d3a",
      secondary: "#5ec6b6",
      accent: "#e2a94b",
      ink: "#18302d",
      bg: "#f7fbfa",
    },
  };
  const colors = palettes[template] ?? {};

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
    design: { template, colors, bgOpacity: 0.25, useElements: false },
  });

  if (!cover || !letter || !cv) throw new Error(`DOCX-Testdokumente fehlen für ${template}.`);
  return { cover, letter, cv };
}

describe("generic DOCX export profiles", () => {
  test("registry exposes the three reviewed visual models", () => {
    expect(
      DOSSIER_DOCX_PROFILES.map(({ templateId, label, architecture, visualModel }) => ({
        templateId,
        label,
        architecture,
        visualModel,
      })),
    ).toEqual([
      {
        templateId: "brief",
        label: "Brief",
        architecture: "native",
        visualModel: { cover: "plain", letter: "edge-bars", cv: "edge-bars" },
      },
      {
        templateId: "freundlich",
        label: "Warm",
        architecture: "native+polish",
        visualModel: {
          cover: "organic-hero",
          letter: "organic-masthead",
          cv: "banded",
        },
      },
      {
        templateId: "studio3",
        label: "Studio 3",
        architecture: "native+transform+polish",
        visualModel: {
          cover: "editorial-split",
          letter: "two-tone-masthead",
          cv: "two-tone-masthead",
        },
      },
    ]);
  });

  for (const [template, label] of [
    ["brief", "Brief"],
    ["freundlich", "Warm"],
    ["studio3", "Studio 3"],
  ] as const) {
    test(`${label} resolves through the shared registry and creates a real DOCX`, async () => {
      const { cover, letter, cv } = documents(template);
      expect(resolveDossierDocxProfile(cover, letter, cv)?.label).toBe(label);
      const blob = await createDossierDocxBlob(cover, letter, cv);
      expect(blob.type).toBe(DOCX_MIME_TYPE);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(readStoredDocxEntries(bytes).some((entry) => entry.name === "word/document.xml")).toBe(
        true,
      );
    });
  }

  test("mixed template families remain unsupported", () => {
    const brief = documents("brief");
    const warm = documents("freundlich");
    expect(resolveDossierDocxProfile(brief.cover, warm.letter, brief.cv)).toBeNull();
  });
});

describe("shared stored-DOCX transform core", () => {
  test("round-trips package entries while replacing editable document XML", async () => {
    const original = new Blob([
      writeStoredDocxEntries([
        {
          name: "word/document.xml",
          bytes: new TextEncoder().encode("<w:document>ALT</w:document>"),
        },
        {
          name: "word/styles.xml",
          bytes: new TextEncoder().encode("<w:styles/>") ,
        },
      ]),
    ], { type: DOCX_MIME_TYPE });

    const transformed = await transformStoredDocxDocumentXml(
      original,
      (xml) => xml.replace("ALT", "NEU"),
      "Test-DOCX",
    );
    const entries = readStoredDocxEntries(new Uint8Array(await transformed.arrayBuffer()));
    const document = entries.find((entry) => entry.name === "word/document.xml");
    const styles = entries.find((entry) => entry.name === "word/styles.xml");

    expect(new TextDecoder().decode(document?.bytes)).toBe("<w:document>NEU</w:document>");
    expect(new TextDecoder().decode(styles?.bytes)).toBe("<w:styles/>");
  });
});
