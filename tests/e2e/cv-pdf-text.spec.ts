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

async function expectOnlyInvisibleNativeText(path: string, pageNumber: number) {
  const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableFontFace: true }).promise;
  const pdfPage = await document.getPage(pageNumber);
  const operatorList = await pdfPage.getOperatorList();
  const textOperators = new Set([
    OPS.showText,
    OPS.showSpacedText,
    OPS.nextLineShowText,
    OPS.nextLineSetSpacingShowText,
  ]);
  let renderingMode = 0;
  let nativeTextRuns = 0;

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const operator = operatorList.fnArray[index];
    if (operator === OPS.setTextRenderingMode) {
      renderingMode = Number(operatorList.argsArray[index]?.[0] ?? 0);
      continue;
    }
    if (!textOperators.has(operator)) continue;
    nativeTextRuns += 1;
    expect(
      renderingMode,
      `page ${pageNumber}: every native PDF text run must be invisible`,
    ).toBe(3);
  }

  expect(nativeTextRuns, `page ${pageNumber}: searchable native text must exist`).toBeGreaterThan(0);
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
      titel: "LEBENSLAUF",
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
      template: "freundlich",
      colors: {
        primary: "#0f766e",
        secondary: "#f59e0b",
        ink: "#0b1f24",
        bg: "#fff9ef",
      },
      font: "freundlich",
      bgOpacity: 0.25,
      useElements: false,
      docTitleColor: "#ff0000",
      docTitleFontSizePx: 39,
      docTitleItalic: true,
      docTitleUnderline: true,
    },
    elements: [],
    elementStyles: {},
  };
}

function coverPayload() {
  return {
    version: 7,
    template: "freundlich",
    colors: {
      freundlich: {
        primary: "#0f766e",
        secondary: "#f59e0b",
        ink: "#0b1f24",
        bg: "#fff9ef",
      },
    },
    layout: { freundlich: {} },
    customs: [],
    fontScale: 1.2,
    font: "freundlich",
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
      template: "freundlich",
      colors: {
        primary: "#0f766e",
        secondary: "#f59e0b",
        ink: "#0b1f24",
        bg: "#fff9ef",
      },
      font: "freundlich",
      fontOverride: "freundlich",
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

  test("standalone CV keeps browser typography visible and native text invisible/searchable", async ({
    page,
  }) => {
    await seedCv(page);

    const preview = page.locator(
      '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page]',
    );
    await preview.first().waitFor({ state: "visible" });
    await expect(preview.first()).toContainText("Lea");
    await expect(preview.first()).toContainText("Beispielbetrieb Solothurn");

    const previewTitles = preview.first().locator("[data-cv-doc-title]");
    const exportTitles = page
      .locator('[data-dossier-document="cv"][data-export-mode="true"] [data-cv-page]')
      .first()
      .locator("[data-cv-doc-title]");
    await expect(previewTitles).toHaveCount(1);
    await expect(exportTitles).toHaveCount(1);
    const previewTitle = previewTitles.first();
    const exportTitle = exportTitles.first();

    const readTitleStyle = (element: Element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontStyle: style.fontStyle,
        textDecorationLine: style.textDecorationLine,
      };
    };
    const previewTitleStyle = await previewTitle.evaluate(readTitleStyle);
    const exportTitleStyle = await exportTitle.evaluate(readTitleStyle);
    expect(exportTitleStyle).toEqual(previewTitleStyle);
    expect(exportTitleStyle.color).toBe("rgb(255, 0, 0)");
    expect(exportTitleStyle.fontFamily).toMatch(/Cabin/i);
    expect(exportTitleStyle.fontSize).toBe("39px");
    expect(exportTitleStyle.fontStyle).toBe("italic");
    expect(exportTitleStyle.textDecorationLine).toContain("underline");

    const download = await downloadStandaloneCv(page);
    const path = await download.path();

    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(8_000);

    const pdfSource = (await readFile(path ?? "")).toString("latin1");
    const pdfPages = await extractPdfPages(path ?? "");
    const pdfText = pdfPages.join(" ");
    await expectOnlyInvisibleNativeText(path ?? "", 1);
    expect(pdfText.match(/\bLEBENSLAUF\b/g) ?? []).toHaveLength(1);
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
    await expectOnlyInvisibleNativeText(path ?? "", 2);
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
    await expectOnlyInvisibleNativeText(path ?? "", 2);
    await expectOnlyInvisibleNativeText(path ?? "", 3);
    expectCabinEmbedded(pdfSource);
  });
});
