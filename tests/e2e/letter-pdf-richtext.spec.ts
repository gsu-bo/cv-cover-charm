import { expect, test, type Page } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "anschreiben:v1";
const TARGET_WORDS = ["Bauernhofspielgruppe", "Allgemeinbildung", "kennenzulernen"] as const;
const RICH_TEXT_HTML =
  "<p>ich <strong>Bauernhofspielgruppe</strong> mit <em>Allgemeinbildung</em>.</p><p>Gerne kennenzulernen.</p>";

function letterPayload() {
  return {
    version: 1,
    data: {
      absenderName: "Sandro Müller",
      absenderAdresse: "Dorfstrasse 12",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "+41 79 123 45 67",
      absenderEmail: "sandro.mueller@example.ch",
      empfaengerFirma: "Schmid Holzbau AG",
      empfaengerName: "Herr Thomas Schmid",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4500 Solothurn",
      ort: "Hubersdorf",
      datum: "17.09.2026",
      betreff: "Bewerbung um eine Lehrstelle als Zimmermann EFZ",
      anrede: "Guten Tag Herr Schmid",
      text: "ich Bauernhofspielgruppe mit Allgemeinbildung. Gerne kennenzulernen.",
      richTextHtml: RICH_TEXT_HTML,
      gruss: "Freundliche Grüsse",
      unterschrift: "Sandro Müller",
      images: [],
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: {
      template: "modern",
      colors: {
        bg: "#ffffff",
        ink: "#172033",
        primary: "#24364b",
        secondary: "#dbeafe",
        accent: "#2563eb",
        cvInk: "#172033",
        cvMuted: "#526072",
        cvHeading: "#172033",
      },
      font: "freundlich",
      fontOverride: null,
      senderAlign: "left",
      recipientAlign: "left",
      dateAlign: "left",
      ruleAfterSender: false,
      ruleAfterRecipient: false,
      ruleAfterSubject: false,
      headerMode: "compact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
      footerMode: "compact",
    },
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
      beruf: "Zimmermann EFZ",
      lehrbeginn: "Lehrbeginn August 2027",
      vorname: "Sandro",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "sandro.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "Schmid Holzbau AG",
      ansprechperson: "Herr Thomas Schmid",
      betriebAdresse: "Industriestrasse 8, 4500 Solothurn",
      ort: "Hubersdorf",
      datum: "17.09.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
  };
}

function cvPayload() {
  return {
    version: 6,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Sandro",
        nachname: "Müller",
        adresse: "Dorfstrasse 12",
        plzOrt: "4535 Hubersdorf",
        telefon: "+41 79 123 45 67",
        email: "sandro.mueller@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schüler, 3. Sekundarklasse",
        foto: null,
      },
      schule: [
        {
          id: "school-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Schulhaus Beispiel, Hubersdorf",
          beschreibung: "Allgemeinbildung und Berufsvorbereitung.",
        },
      ],
      erfahrung: [
        {
          id: "work-1",
          zeit: "2026",
          titel: "Schnupperlehre Holzbau",
          ort: "Schmid Holzbau AG, Solothurn",
          beschreibung: "Einblick in Werkstatt und Montage.",
        },
      ],
      sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Fussball"],
      staerken: ["Zuverlässig"],
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

async function seedLetter(page: Page, fullDossier = false) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ letter, cover, cv, includeDossier }) => {
      localStorage.clear();
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      if (includeDossier) {
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
        localStorage.setItem("lebenslauf:layout:v1", "classic");
      }
    },
    {
      letter: letterPayload(),
      cover: coverPayload(),
      cv: cvPayload(),
      includeDossier: fullDossier,
    },
  );
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  const download = page.getByRole("button", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
  await expect(page.locator(`[data-letter-pdf-richtext] strong`).first()).toContainText(
    TARGET_WORDS[0],
  );
}

async function forceDeterministicWrappedWords(page: Page) {
  const roots = page.locator("[data-letter-pdf-richtext]");
  await expect.poll(() => roots.count()).toBeGreaterThan(0);
  const fragmentCounts = await roots.evaluateAll(
    (elements, targetWords) => {
      const counts: number[] = [];
      for (const element of elements as HTMLElement[]) {
        element.style.width = "56px";
        element.style.maxWidth = "56px";
        element.style.overflowWrap = "anywhere";
        element.style.wordBreak = "normal";
        element.style.hyphens = "none";

        for (const target of targetWords as string[]) {
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          let count = 0;
          while (node) {
            const raw = node.nodeValue ?? "";
            const start = raw.indexOf(target);
            if (start >= 0) {
              const range = document.createRange();
              range.setStart(node, start);
              range.setEnd(node, start + target.length);
              count = Array.from(range.getClientRects()).filter(
                (rect) => rect.width > 0 && rect.height > 0,
              ).length;
              break;
            }
            node = walker.nextNode();
          }
          counts.push(count);
        }
      }
      return counts;
    },
    [...TARGET_WORDS],
  );

  expect(
    Math.max(...fragmentCounts),
    "fixture must force at least one rich-text word across visual line fragments",
  ).toBeGreaterThan(1);
}

type PositionedPdfText = { str: string; y: number };

async function extractPdfPageItems(path: string, pageNumber: number): Promise<PositionedPdfText[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableFontFace: true }).promise;
  const pdfPage = await document.getPage(pageNumber);
  const content = await pdfPage.getTextContent();
  return content.items.flatMap((item) =>
    "str" in item ? [{ str: item.str, y: item.transform[5] }] : [],
  );
}

function normalizedPdfText(value: string): string {
  return value.replace(/[\s\u00ad-]+/g, "");
}

function expectWordUsesMultiplePdfBaselines(items: PositionedPdfText[], target: string) {
  let stream = "";
  const spans: Array<{ start: number; end: number; y: number }> = [];

  for (const item of items) {
    const clean = normalizedPdfText(item.str);
    if (!clean) continue;
    const start = stream.length;
    stream += clean;
    spans.push({ start, end: stream.length, y: item.y });
  }

  const targetStart = stream.indexOf(target);
  expect(
    targetStart,
    `${target} must remain extractable from the PDF text layer`,
  ).toBeGreaterThanOrEqual(0);
  const targetEnd = targetStart + target.length;
  const baselines = spans
    .filter((span) => span.end > targetStart && span.start < targetEnd)
    .map((span) => Math.round(span.y * 10) / 10);

  expect(
    items.some((item) => normalizedPdfText(item.str).includes(target)),
    `${target} must not be painted once from a union bounding box`,
  ).toBe(false);
  expect(
    new Set(baselines).size,
    `${target} must follow the browser's multiple visual line fragments`,
  ).toBeGreaterThan(1);
}

async function expectWrappedWordsInPdf(path: string, pageNumber: number) {
  expect((await stat(path)).size).toBeGreaterThan(8_000);
  const items = await extractPdfPageItems(path, pageNumber);
  for (const target of TARGET_WORDS) expectWordUsesMultiplePdfBaselines(items, target);
}

test.describe("Motivation-letter PDF rich-text wrap regression", () => {
  test.setTimeout(180_000);

  test("standalone PDF paints wrapped rich-text words per visual fragment", async ({ page }) => {
    await seedLetter(page);
    const download = page.getByRole("button", { name: "Download", exact: true });
    await download.click();
    const pdfButton = page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/i });
    await expect(pdfButton).toBeVisible();
    await forceDeterministicWrappedWords(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await pdfButton.click();
    const file = await downloadPromise;
    const path = await file.path();
    expect(path).not.toBeNull();
    await expectWrappedWordsInPdf(path ?? "", 1);
  });

  test("combined dossier uses the same fragment-safe letter text layer", async ({ page }) => {
    await seedLetter(page, true);
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });

    const downloadToggle = page.locator("button[data-editor-ready]");
    await expect(downloadToggle).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
    await downloadToggle.click();

    const menu = page.locator("[data-editor-action-menu]");
    await expect(menu).toBeVisible();
    const fullPdfButton = menu.getByRole("button", { name: /Ganzes Dossier als PDF/i });
    await expect(fullPdfButton).toBeEnabled({ timeout: 15_000 });
    await fullPdfButton.click();

    const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
    await expect(dialog).toBeVisible();
    await forceDeterministicWrappedWords(page);
    const confirm = dialog.getByRole("button", { name: "Dossier herunterladen" });
    await expect(confirm).toBeEnabled({ timeout: 15_000 });

    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await confirm.click();
    const file = await downloadPromise;
    const path = await file.path();
    expect(path).not.toBeNull();
    await expectWrappedWordsInPdf(path ?? "", 2);
  });
});
