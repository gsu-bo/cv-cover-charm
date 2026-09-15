import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const ARTIFACT_DIR = "artifacts/dossier-docx-reference";

const CASES = [
  {
    id: "serioes",
    label: "Seriös",
    colors: { bg: "#ffffff", primary: "#1e3a5f", accent: "#94a3b8", ink: "#1f2937" },
  },
  {
    id: "pastell",
    label: "Rahmen",
    colors: { bg: "#fbfaf8", primary: "#4a4e69", secondary: "#e8e4de", ink: "#22212b" },
  },
  {
    id: "terracotta",
    label: "Kolumne",
    colors: { bg: "#fdfaf6", primary: "#8c3f28", secondary: "#e0bfa3", ink: "#2b211c" },
  },
  {
    id: "human",
    label: "Human",
    colors: { bg: "#fdf6f0", primary: "#9c5b3c", secondary: "#e7d3c4", ink: "#3b2a22" },
  },
  {
    id: "welle",
    label: "Horizont",
    colors: { bg: "#fbf8f4", primary: "#243447", secondary: "#c08457", ink: "#1b232c" },
  },
  {
    id: "modern",
    label: "Modern",
    colors: { bg: "#fafafa", primary: "#111827", accent: "#f43f5e", ink: "#111827" },
  },
  {
    id: "neon",
    label: "Neon",
    colors: { bg: "#0d0b2b", primary: "#e11d8f", secondary: "#7c3aed", ink: "#f8fafc" },
  },
] as const;

async function seedCompleteDossier(page: import("@playwright/test").Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "modern",
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
          showBeilagenOnCover: true,
          beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
        },
        colors: {},
      }),
    );
    localStorage.setItem(
      "anschreiben:v1",
      JSON.stringify({
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
        design: { template: "modern", font: "freundlich", colors: {} },
      }),
    );
    localStorage.setItem(
      "lebenslauf:v1",
      JSON.stringify({
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
        design: { template: "modern", colors: {}, bgOpacity: 0.25, useElements: false },
      }),
    );
  });
}

test("one real browser DOCX per geometry family", async ({ page }) => {
  await seedCompleteDossier(page);
  await mkdir(ARTIFACT_DIR, { recursive: true });

  for (const item of CASES) {
    await page.evaluate(({ id, colors }) => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      const letter = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null");
      const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      cover.template = id;
      cover.colors = colors;
      letter.design.template = id;
      letter.design.colors = colors;
      cv.design.template = id;
      cv.design.colors = colors;
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    }, item);
    await page.reload({ waitUntil: "domcontentloaded" });

    const exportCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
    await expect(exportCard).toBeEnabled();
    await exportCard.click();

    const docxOption = page.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
    await expect(docxOption).toBeEnabled();
    await expect(docxOption).toContainText(`Vorlage ${item.label}`);
    await docxOption.click();

    const button = page.getByRole("button", { name: "DOCX herunterladen" });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path!);
    expect(bytes.length).toBeGreaterThan(2_000);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    await download.saveAs(`${ARTIFACT_DIR}/family-${item.id}.docx`);
  }
});
