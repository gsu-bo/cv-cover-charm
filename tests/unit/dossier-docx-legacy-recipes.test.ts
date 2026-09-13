import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { createDossierDocxBlob, resolveDossierDocxProfile } from "../../src/lib/dossier-docx-export";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import { LEGACY_EXTRA_DOCX_RECIPES } from "../../src/lib/dossier-docx-template-recipe-legacy-extra";

const COLORS: Record<string, Record<string, string>> = {
  klassisch: { bg: "#f5efe4", ink: "#111111", accent: "#8a6a3b" },
  edel: { bg: "#fcfbf8", ink: "#181817", accent: "#8d6b2d" },
  colorful: { bg: "#fffdf7", primary: "#ef4444", secondary: "#3b82f6", accent: "#facc15", ink: "#161616" },
  blockig: { bg: "#f4f4f2", primary: "#1f2937", accent: "#f97316", ink: "#111111" },
  sonne: { bg: "#333333", primary: "#fbbf24", light: "#f7f5f0", ink: "#141414" },
  studio: { bg: "#ffffff", primary: "#232b3a", accent: "#f5d547", ink: "#1f2937" },
  neon: { bg: "#0d0b2b", primary: "#e11d8f", secondary: "#7c3aed", accent: "#e11d8f", ink: "#f8fafc" },
  aurora: { bg: "#ffffff", primary: "#0ea5e9", secondary: "#6d28d9", accent: "#6d28d9", ink: "#111827" },
  verlauf: { bg: "#ffffff", primary: "#7f5af0", secondary: "#2cb67d", ink: "#ffffff" },
  citrus: { bg: "#fffdf9", primary: "#fb7185", secondary: "#fbbf24", ink: "#3f1d2b" },
  edelDark: { bg: "#171716", sheet: "#171716", ink: "#f3eee5", accent: "#c7a35a" },
};

function documents(template: string) {
  const colors = COLORS[template] ?? { bg: "#ffffff", ink: "#111111" };
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
      schule: [{ id: "schule-1", zeit: "2023 – heute", titel: "Sekundarschule", ort: "Hubersdorf", beschreibung: "Sek B" }],
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
  if (!cover || !letter || !cv) throw new Error(`DOCX-Testdokument fehlt für ${template}.`);
  return { cover, letter, cv };
}

function documentXml(bytes: Uint8Array) {
  const entry = readStoredDocxEntries(bytes).find((item) => item.name === "word/document.xml");
  if (!entry) throw new Error("document.xml fehlt");
  return new TextDecoder().decode(entry.bytes);
}

describe("legacy individual DOCX recipes", () => {
  for (const [template, recipe] of Object.entries(LEGACY_EXTRA_DOCX_RECIPES)) {
    test(`${recipe.label} routes through its individual Word recipe`, async () => {
      const { cover, letter, cv } = documents(template);
      const profile = resolveDossierDocxProfile(cover, letter, cv);
      expect(profile?.architecture).toBe("template-recipe");
      expect(profile?.label).toBe(recipe.label);

      const blob = await createDossierDocxBlob(cover, letter, cv);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      const xml = documentXml(bytes);
      expect(xml).toContain(recipe.cover.shapes[0].id);
      expect(xml).toContain(recipe.letter.shapes[0].id);
      expect(xml).toContain(recipe.cv.shapes[0].id);
    });
  }

  test("Neon uses real white edit surface with dark editable text", async () => {
    const { cover, letter, cv } = documents("neon");
    const blob = await createDossierDocxBlob(cover, letter, cv);
    const xml = documentXml(new Uint8Array(await blob.arrayBuffer()));
    expect(xml).toContain('id="neon-letter-card"');
    expect(xml).toContain('fillcolor="#ffffff"');
    expect(xml).toContain('w:color w:val="1C2328"');
  });
});
