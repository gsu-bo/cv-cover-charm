import { expect, test } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const ARTIFACT_DIR = "artifacts/dossier-docx-reference";

async function seedBriefDossier(page: import("@playwright/test").Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "brief",
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
        design: {
          template: "brief",
          font: "freundlich",
          colors: {},
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
          erfahrung: [],
          sprachen: [{ id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" }],
          hobbys: ["Programmieren"],
          staerken: ["Zuverlässig"],
          referenzen: [],
          labels: {},
          hidden: {},
        },
        design: {
          template: "brief",
          colors: {},
          bgOpacity: 0.25,
          useElements: false,
        },
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function setWholeDossierTemplate(
  page: import("@playwright/test").Page,
  template: string,
) {
  await page.evaluate((nextTemplate) => {
    const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
    const letter = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null");
    const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
    if (cover) {
      cover.template = nextTemplate;
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
    }
    if (letter?.design) {
      letter.design.template = nextTemplate;
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
    }
    if (cv?.design) {
      cv.design.template = nextTemplate;
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    }
  }, template);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function openDocxOption(page: import("@playwright/test").Page) {
  const exportCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
  await expect(exportCard).toBeEnabled();
  await exportCard.click();
  return page.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
}

test.describe("DOCX reference download", () => {
  test("complete Brief dossier downloads a real DOCX package", async ({ page }) => {
    await seedBriefDossier(page);

    const option = await openDocxOption(page);
    await expect(option).toBeEnabled();
    await expect(option).toContainText("Vorlage Brief");
    await option.click();

    const button = page.getByRole("button", { name: "DOCX herunterladen" });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    expect(download.suggestedFilename()).toBe("Bewerbungsdossier-Lea-Mueller.docx");

    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path!);
    expect(bytes.length).toBeGreaterThan(2_000);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    await mkdir(ARTIFACT_DIR, { recursive: true });
    await download.saveAs(`${ARTIFACT_DIR}/brief-reference.docx`);
  });

  test("Modern uses the generic family fallback and downloads a real DOCX", async ({ page }) => {
    await seedBriefDossier(page);
    await setWholeDossierTemplate(page, "modern");

    const option = await openDocxOption(page);
    await expect(option).toBeEnabled();
    await expect(option).toContainText("Vorlage Modern");
    await option.click();

    const button = page.getByRole("button", { name: "DOCX herunterladen" });
    await expect(button).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path!);
    expect(bytes.length).toBeGreaterThan(2_000);
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  test("DOCX stays disabled when dossier parts use different templates", async ({ page }) => {
    await seedBriefDossier(page);
    await page.evaluate(() => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      if (cover) {
        cover.template = "modern";
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      }
      if (cv?.design) {
        cv.design.template = "modern";
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const option = await openDocxOption(page);
    await expect(option).toBeDisabled();
    await expect(option).toContainText(
      "Benötigt ein vollständiges Dossier mit derselben aktiven Vorlage.",
    );
  });
});
