import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const ARTIFACT_DIR = "artifacts/dossier-docx-reference";

async function seedStudio3Dossier(page: import("@playwright/test").Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "studio3",
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
          lehrbetrieb: "Beispiel AG",
          ansprechperson: "Herr Thomas Weber",
          betriebAdresse: "Industriestrasse 8",
          ort: "Hubersdorf",
          datum: "15.11.2026",
          showBeilagenOnCover: true,
          beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
        },
        colors: {
          bg: "#f7fbfa",
          primary: "#173d3a",
          secondary: "#5ec6b6",
          accent: "#e2a94b",
          ink: "#18302d",
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
          absenderEmail: "lea.mueller@example.ch",
          empfaengerFirma: "Beispiel AG",
          empfaengerName: "Herr Thomas Weber",
          empfaengerAdresse: "Industriestrasse 8",
          empfaengerPlzOrt: "4535 Hubersdorf",
          ort: "Hubersdorf",
          datum: "15.11.2026",
          betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
          anrede: "Guten Tag Herr Weber",
          text: "Die Informatik begeistert mich, weil ich gerne logisch denke, Probleme löse und Neues ausprobiere. Deshalb bewerbe ich mich mit grossem Interesse um die Lehrstelle als Informatikerin EFZ bei der Beispiel AG.\n\nIn der Schule arbeite ich besonders gerne an Aufgaben, bei denen ich selbstständig Lösungen entwickeln kann. Ich bin zuverlässig, lerne schnell und arbeite gerne im Team.\n\nGerne möchte ich Ihr Unternehmen und den Beruf bei einem persönlichen Gespräch oder einer Schnupperlehre näher kennenlernen. Ich freue mich über Ihre Rückmeldung.",
          gruss: "Freundliche Grüsse",
          unterschrift: "Lea Müller",
          showBeilagen: true,
          beilagen: ["Lebenslauf", "Zeugnis"],
        },
        design: {
          template: "studio3",
          font: "freundlich",
          colors: {
            bg: "#f7fbfa",
            primary: "#173d3a",
            secondary: "#5ec6b6",
            accent: "#e2a94b",
            ink: "#18302d",
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
            email: "lea.mueller@example.ch",
            geburtsdatum: "14.03.2010",
            nationalitaet: "Schweiz",
            untertitel: "Schülerin, 3. Sek B",
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
            {
              id: "schule-2",
              zeit: "2017 – 2023",
              titel: "Primarschule",
              ort: "Primarschule Hubersdorf",
              beschreibung: "",
            },
          ],
          erfahrung: [
            {
              id: "erfahrung-1",
              zeit: "Sept. 2026",
              titel: "Schnupperlehre Informatik",
              ort: "Beispiel AG, Hubersdorf",
              beschreibung: "Support, kleine Automatisierungen mit Python",
            },
            {
              id: "erfahrung-2",
              zeit: "März 2026",
              titel: "Schnupperlehre Mediamatik",
              ort: "Muster GmbH, Hubersdorf",
              beschreibung: "Website-Pflege, Bildbearbeitung",
            },
          ],
          sprachen: [
            { id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" },
            { id: "sprache-2", name: "Englisch", niveau: "Gute Schulkenntnisse (B1)" },
            { id: "sprache-3", name: "Französisch", niveau: "Grundkenntnisse (A2)" },
          ],
          hobbys: ["Volleyball im Verein", "Programmieren kleiner Spiele", "Fotografieren"],
          staerken: ["Zuverlässig und pünktlich", "Arbeitet gern im Team", "Lernt schnell Neues"],
          referenzen: [
            {
              id: "referenz-1",
              name: "Herr Thomas Weber",
              funktion: "Klassenlehrer, Schulhaus Zentrum",
              kontakt: "+41 32 123 45 67",
              email: "",
              zusatz: "",
            },
          ],
          labels: {
            schule: "Schulbildung",
            erfahrung: "Praktika & Schnuppertage",
            sprachen: "Sprachen",
            hobbys: "Hobbys & Interessen",
            staerken: "Stärken",
            referenzen: "Referenzen",
          },
          hidden: {},
        },
        design: {
          template: "studio3",
          colors: {
            bg: "#f7fbfa",
            primary: "#173d3a",
            secondary: "#5ec6b6",
            accent: "#e2a94b",
            ink: "#18302d",
          },
          bgOpacity: 0.25,
          useElements: false,
        },
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function openDocxOption(page: import("@playwright/test").Page) {
  const exportCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
  await expect(exportCard).toBeEnabled();
  await exportCard.click();
  return page.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
}

test.describe("Studio 3 DOCX reference download", () => {
  test("complete Studio 3 dossier downloads a real DOCX package for render QA", async ({ page }) => {
    await seedStudio3Dossier(page);

    const option = await openDocxOption(page);
    await expect(option).toBeEnabled();
    await expect(option).toContainText("Vorlage Studio 3");
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
    await download.saveAs(`${ARTIFACT_DIR}/studio3-reference.docx`);
  });

  test("mixed Studio 3/Warm dossier is not offered as a coherent DOCX", async ({ page }) => {
    await seedStudio3Dossier(page);
    await page.evaluate(() => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      if (cover) {
        cover.template = "freundlich";
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const option = await openDocxOption(page);
    await expect(option).toBeDisabled();
  });
});
