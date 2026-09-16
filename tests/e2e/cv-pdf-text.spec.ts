import { expect, test } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";

async function extractPdfPages(path: string): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const pdfPage = await document.getPage(pageNumber);
    const content = await pdfPage.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" "),
    );
  }
  return pages;
}

function expectCabinEmbedded(source: string) {
  expect(source, "Cabin must be embedded as the real PDF font").toMatch(/Cabin/i);
}

function cvPayload({ long = false } = {}) {
  const school = long
    ? Array.from({ length: 12 }, (_, index) => ({
        id: `school-${index}`,
        zeit: `${2026 - index} – ${2027 - index}`,
        titel: `Schulmarker${index + 1}`,
        ort: `Schulhaus ${index + 1}, Hubersdorf`,
        beschreibung:
          "Schwerpunkt Informatik, selbstständiges Arbeiten und Dokumentation im Schulalltag.",
      }))
    : [
        {
          id: "school-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Schulhaus Beispiel, Hubersdorf",
          beschreibung: "Schwerpunkt Informatik und selbstständiges Arbeiten.",
        },
      ];
  const experience = long
    ? Array.from({ length: 10 }, (_, index) => ({
        id: `work-${index}`,
        zeit: `${2026 - index}`,
        titel: `Praxismarker${index + 1}`,
        ort: `Beispielbetrieb ${index + 1}, Solothurn`,
        beschreibung:
          "Mitarbeit im Team, Dokumentation kleiner Aufgaben und Einblick in verschiedene Arbeitsabläufe.",
      }))
    : [
        {
          id: "work-1",
          zeit: "2026",
          titel: "Schnupperlehre Informatik",
          ort: "Beispielbetrieb Solothurn",
          beschreibung: "Mitarbeit im Team und Dokumentation kleiner Aufgaben.",
        },
      ];

  return {
    version: 6,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Dorfstrasse 12",
        plzOrt: "4535 Hubersdorf",
        telefon: "079 123 45 67",
        email: "lea.mueller@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin, 3. Sekundarklasse",
        foto: null,
      },
      schule: school,
      erfahrung: experience,
      sprachen: long
        ? []
        : [
            { id: "de", name: "Deutsch", niveau: "Muttersprache" },
            { id: "en", name: "Englisch", niveau: "B1" },
          ],
      hobbys: long ? [] : ["Volleyball", "Programmieren"],
      staerken: long ? [] : ["Zuverlässig", "Teamfähig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: {
      template: "modern",
      colors: { primary: "#24364b", accent: "#d6a47d", bg: "#ffffff" },
      font: "freundlich",
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
    elementStyles: {},
  };
}

function coverPayload() {
  return {
    version: 7,
    template: "modern",
    colors: {
      modern: {
        bg: "#ffffff",
        primary: "#24364b",
        accent: "#d6a47d",
      },
    },
    layout: { modern: {} },
    customs: [],
    fontScale: 1.2,
    font: "sans",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "Lehrbeginn August 2027",
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "079 123 45 67",
      email: "lea.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "Beispiel AG",
      ansprechperson: "Herr Thomas Weber",
      betriebAdresse: "Industriestrasse 8, 4500 Solothurn",
      ort: "Hubersdorf",
      datum: "29.08.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
  };
}

function letterPayload() {
  return {
    version: 1,
    data: {
      absenderName: "Lea Müller",
      absenderAdresse: "Dorfstrasse 12",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "079 123 45 67",
      absenderEmail: "lea.mueller@example.ch",
      empfaengerFirma: "Beispiel AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4500 Solothurn",
      ort: "Hubersdorf",
      datum: "29.08.2026",
      betreff: "Bewerbung Informatik Textlayer Test",
      anrede: "Guten Tag Herr Weber",
      text: "Ich interessiere mich sehr für die Lehrstelle und möchte Ihr Team kennenlernen.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
    },
    design: {
      template: "modern",
      colors: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
      font: "freundlich",
    },
  };
}

async function seedCv(page: import("@playwright/test").Page, options: { long?: boolean } = {}) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
    localStorage.setItem("lebenslauf:layout:v1", "classic");
  }, cvPayload(options));
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function downloadStandaloneCv(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Download" }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: /Nur Lebenslauf als PDF/i }).click();
  return downloadPromise;
}

test.describe("CV PDF real text layer", () => {
  test.setTimeout(120_000);

  test("standalone CV masks raster glyphs and exports searchable/selectable native text", async ({
    page,
  }) => {
    await seedCv(page);

    const preview = page.locator(
      '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page]',
    );
    await preview.first().waitFor({ state: "visible" });
    await expect(preview.first()).toContainText("Lea");
    await expect(preview.first()).toContainText("Beispielbetrieb Solothurn");

    const exportText = page
      .locator('[data-dossier-document="cv"][data-export-mode="true"] [data-cv-page]')
      .first()
      .getByText("Lea", { exact: false })
      .first();
    await expect
      .poll(async () => exportText.evaluate((element) => getComputedStyle(element).color))
      .toMatch(/rgba\([^)]*,\s*0\)|transparent/i);

    const download = await downloadStandaloneCv(page);
    const path = await download.path();

    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(8_000);

    const pdfSource = (await readFile(path ?? "")).toString("latin1");
    const pdfPages = await extractPdfPages(path ?? "");
    const pdfText = pdfPages.join(" ");
    expect(pdfText).toContain("Lea");
    expect(pdfText).toContain("Sekundarschule");
    expect(pdfText).toContain("Beispielbetrieb");
    expect(pdfText).toContain("Volleyball");
    expectCabinEmbedded(pdfSource);
  });

  test("second CV page also contributes real PDF text", async ({ page }) => {
    await seedCv(page, { long: true });

    const exportPages = page.locator(
      '[data-dossier-document="cv"][data-export-mode="true"] [data-cv-page]',
    );
    await expect.poll(() => exportPages.count()).toBeGreaterThan(1);

    const secondPageText = await exportPages.nth(1).innerText();
    const marker = secondPageText.match(/(?:Schulmarker|Praxismarker)\d+/)?.[0];
    expect(marker, "second page should contain a unique seeded marker").toBeTruthy();

    const download = await downloadStandaloneCv(page);
    const path = await download.path();
    expect(path).not.toBeNull();

    const pdfPages = await extractPdfPages(path ?? "");
    expect(pdfPages.length).toBeGreaterThan(1);
    expect(pdfPages.slice(1).join(" ")).toContain(marker ?? "__missing_second_page_marker__");
  });

  test("combined dossier keeps letter before real CV text", async ({ page }) => {
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ cover, cv, letter }) => {
        localStorage.clear();
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
        localStorage.setItem("lebenslauf:layout:v1", "classic");
        localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      },
      { cover: coverPayload(), cv: cvPayload(), letter: letterPayload() },
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    const downloadToggle = page.locator('button[data-editor-ready]');
    await expect(downloadToggle).toHaveAttribute("data-editor-ready", "true", { timeout: 10_000 });
    await downloadToggle.click();

    const menu = page.locator("[data-editor-action-menu]");
    await expect(menu).toBeVisible();
    const fullPdfButton = menu.getByRole("button", { name: /Ganzes Dossier als PDF/i });
    await expect(fullPdfButton).toBeEnabled({ timeout: 10_000 });
    await fullPdfButton.click();

    const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Titelblatt · Motivationsschreiben · 1 CV-Seite/);
    const confirm = dialog.getByRole("button", { name: "Dossier herunterladen" });
    await expect(confirm).toBeEnabled({ timeout: 10_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await confirm.click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(12_000);

    const pdfSource = (await readFile(path ?? "")).toString("latin1");
    const pdfPages = await extractPdfPages(path ?? "");
    expect(pdfPages.length).toBeGreaterThanOrEqual(3);
    expect(pdfPages[1]).toContain("Bewerbung Informatik Textlayer Test");
    expect(pdfPages.slice(2).join(" ")).toContain("Sekundarschule");
    expectCabinEmbedded(pdfSource);
  });
});
