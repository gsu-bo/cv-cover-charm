import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const ARTIFACT_DIR = "artifacts/dossier-docx-reference";

async function seedWarmDossier(page: import("@playwright/test").Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "freundlich",
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
          text: "Die Informatik begeistert mich.\n\nIn der Schule arbeite ich besonders gerne an Projekten, bei denen ich logisch denken und eigene Lösungen ausprobieren kann.\n\nIch freue mich auf Ihre Rückmeldung.",
          gruss: "Freundliche Grüsse",
          unterschrift: "Lea Müller",
          showBeilagen: true,
          beilagen: ["Lebenslauf", "Zeugnis"],
        },
        design: {
          template: "freundlich",
          font: "freundlich",
          colors: {
            primary: "#0f766e",
            secondary: "#f59e0b",
            ink: "#0b1f24",
            bg: "#fff9ef",
          },
        },
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
          erfahrung: [
            {
              id: "erfahrung-1",
              zeit: "2026",
              titel: "Schnupperlehre Informatik",
              ort: "Beispiel AG",
              beschreibung: "Einblick in Support und Webentwicklung",
            },
          ],
          sprachen: [
            { id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" },
            { id: "sprache-2", name: "Englisch", niveau: "Gute Kenntnisse" },
          ],
          hobbys: ["Programmieren", "Volleyball"],
          staerken: ["Zuverlässig", "Neugierig"],
          referenzen: [],
          labels: {},
          hidden: {},
        },
        design: {
          template: "freundlich",
          colors: {
            primary: "#0f766e",
            secondary: "#f59e0b",
            ink: "#0b1f24",
            bg: "#fff9ef",
          },
          bgOpacity: 0.25,
          useElements: false,
        },
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function openDocxOption(page: import("@playwright/test").Page) {
  const exportCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
  await expect(exportCard).toBeEnabled();
  await exportCard.click();
  return page.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
}

test.describe("Warm DOCX reference download", () => {
  test("complete Warm dossier downloads a real DOCX package for render QA", async ({ page }) => {
    await seedWarmDossier(page);

    const option = await openDocxOption(page);
    await expect(option).toBeEnabled();
    await expect(option).toContainText("Vorlage Warm");
    await option.click();

    const button = page.getByRole("button", { name: "DOCX herunterladen" });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toBe("Bewerbungsdossier-Lea-Mueller.docx");

    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path!);
    expect(bytes.length).toBeGreaterThan(3_000);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    await mkdir(ARTIFACT_DIR, { recursive: true });
    await download.saveAs(`${ARTIFACT_DIR}/warm-reference.docx`);
  });

  test("mixed Brief/Warm dossier is not offered as a coherent DOCX", async ({ page }) => {
    await seedWarmDossier(page);
    await page.evaluate(() => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      if (cover) {
        cover.template = "brief";
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const option = await openDocxOption(page);
    await expect(option).toBeDisabled();
  });
});
