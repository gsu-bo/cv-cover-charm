import { expect, test, type Page } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const BODY_ALIGNMENTS = ["left", "justify"] as const;
type BodyAlignment = (typeof BODY_ALIGNMENTS)[number];

async function extractPdfText(path: string) {
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
  return pages.join(" ");
}

function letterPayload(align: BodyAlignment) {
  const marker = `LETTER-${align.toUpperCase()}-ALIGNMENT`;
  const text = `${marker} Dieser Absatz prüft die Ausrichtung im Motivationsschreiben.`;
  return {
    marker,
    saved: {
      version: 1,
      data: {
        absenderName: "Lea Müller",
        absenderAdresse: "Dorfstrasse 12",
        absenderPlzOrt: "4535 Hubersdorf",
        absenderTelefon: "079 123 45 67",
        absenderEmail: "lea@example.ch",
        empfaengerFirma: "Beispiel AG",
        empfaengerName: "Herr Thomas Weber",
        empfaengerAdresse: "Industriestrasse 8",
        empfaengerPlzOrt: "4500 Solothurn",
        ort: "Hubersdorf",
        datum: "16.09.2026",
        betreff: "Bewerbung Informatik",
        anrede: "Guten Tag Herr Weber",
        text,
        richTextHtml: `<div data-align="${align}">${text}</div>`,
        gruss: "Freundliche Grüsse",
        unterschrift: "Lea Müller",
        showBeilagen: false,
        beilagen: [],
      },
      design: {
        template: "brief",
        font: "freundlich",
        colors: {},
      },
    },
  };
}

function cvPayload() {
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
        email: "lea@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin, 3. Sek B",
        foto: null,
      },
      schule: [
        {
          id: "school-alignment",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Hubersdorf",
          beschreibung: "CV-ALIGNMENT-PROBE mit Informatik und selbstständigem Arbeiten.",
        },
      ],
      erfahrung: [],
      sprachen: [],
      hobbys: [],
      staerken: [],
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
    elements: [],
    elementStyles: {},
  };
}

async function seedLetter(page: Page, align: BodyAlignment) {
  const payload = letterPayload(align);
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  await page.evaluate((saved) => {
    localStorage.clear();
    localStorage.setItem("anschreiben:v1", JSON.stringify(saved));
  }, payload.saved);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  return payload.marker;
}

async function seedCv(page: Page, align: BodyAlignment) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload, bodyAlign }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:text-align:v1", bodyAlign);
    },
    { payload: cvPayload(), bodyAlign: align },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function downloadLetter(page: Page) {
  await page.getByRole("button", { name: "Download" }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/i }).click();
  return downloadPromise;
}

async function downloadCv(page: Page) {
  await page.getByRole("button", { name: "Download" }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: /Nur Lebenslauf als PDF/i }).click();
  return downloadPromise;
}

async function expectAlignmentControlIsBodyOnly(page: Page) {
  const control = page.locator("[data-text-alignment-control]").first();
  await expect(control).toBeVisible();
  await expect(control.locator('button[data-alignment="left"]')).toHaveCount(1);
  await expect(control.locator('button[data-alignment="justify"]')).toHaveCount(1);
  await expect(control.locator('button[data-alignment="center"]')).toHaveCount(0);
  await expect(control.locator('button[data-alignment="right"]')).toHaveCount(0);
}

async function openCvAlignmentControl(page: Page) {
  const section = page.locator('[data-editor-section-title="Schrift"]');
  await expect(section).toBeVisible();
  const toggle = section.locator("[data-editor-section-toggle]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(section.locator("[data-editor-section-body]")).toBeVisible();
  await expect(section.locator("[data-cv-text-alignment-control]")).toBeVisible();
  await expectAlignmentControlIsBodyOnly(page);
}

test.describe("body alignment Web/PDF parity", () => {
  test.setTimeout(180_000);

  test("motivation letter alignment buttons update the whole body without a prior text selection", async ({
    page,
  }) => {
    const marker = await seedLetter(page, "justify");
    const control = page.locator("[data-text-alignment-control]").first();
    const previewBlock = page
      .locator('[data-letter-pdf-richtext="body"] > :is(div, p)')
      .filter({ hasText: marker })
      .first();

    await control.locator('button[data-alignment="left"]').click();
    await expect(control.locator('button[data-alignment="left"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => previewBlock.evaluate((node) => getComputedStyle(node).textAlign))
      .toBe("left");

    await control.locator('button[data-alignment="justify"]').click();
    await expect(control.locator('button[data-alignment="justify"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect
      .poll(() => previewBlock.evaluate((node) => getComputedStyle(node).textAlign))
      .toBe("justify");
  });

  for (const align of BODY_ALIGNMENTS) {
    test(`motivation letter ${align}: preview and generated PDF use the same body state`, async ({
      page,
    }) => {
      const marker = await seedLetter(page, align);
      await expectAlignmentControlIsBodyOnly(page);

      const previewBlock = page
        .locator('[data-letter-pdf-richtext="body"] > :is(div, p)')
        .filter({ hasText: marker })
        .first();
      await expect(previewBlock).toBeVisible();
      await expect
        .poll(() => previewBlock.evaluate((node) => getComputedStyle(node).textAlign))
        .toBe(align);

      const download = await downloadLetter(page);
      const path = await download.path();
      expect(path).not.toBeNull();
      expect((await stat(path ?? "")).size).toBeGreaterThan(5_000);
      expect(await extractPdfText(path ?? "")).toContain(marker);
    });

    test(`CV ${align}: preview/export DOM and generated PDF use the same body state`, async ({
      page,
    }) => {
      await seedCv(page, align);
      await openCvAlignmentControl(page);

      const previewCanvas = page
        .locator('[data-dossier-document="cv"][data-export-mode="false"]')
        .first();
      await expect(previewCanvas).toBeVisible();
      await expect(previewCanvas.locator("..")).toHaveAttribute("data-cv-body-align", align);
      const previewText = previewCanvas
        .locator("[data-cv-page]:visible")
        .getByText("CV-ALIGNMENT-PROBE", { exact: false })
        .first();
      await expect(previewText).toBeVisible();
      await expect
        .poll(() => previewText.evaluate((node) => getComputedStyle(node).textAlign))
        .toBe(align);

      const exportCanvas = page
        .locator('[data-dossier-document="cv"][data-export-mode="true"]')
        .first();
      await expect(exportCanvas).toBeAttached();
      await expect(exportCanvas.locator("..")).toHaveAttribute("data-cv-body-align", align);
      const exportText = exportCanvas
        .locator("[data-cv-page]")
        .getByText("CV-ALIGNMENT-PROBE", { exact: false })
        .first();
      await expect
        .poll(() => exportText.evaluate((node) => getComputedStyle(node).textAlign))
        .toBe(align);

      const download = await downloadCv(page);
      const path = await download.path();
      expect(path).not.toBeNull();
      expect((await stat(path ?? "")).size).toBeGreaterThan(8_000);
      expect(await extractPdfText(path ?? "")).toContain("CV-ALIGNMENT-PROBE");
    });
  }
});
