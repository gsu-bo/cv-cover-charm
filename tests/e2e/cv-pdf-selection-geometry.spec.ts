import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const TARGETS = [
  "Sekundarschule",
  "Schnupperlehre Informatik",
  "Schwerpunkt Mathematik und Informatik",
] as const;
type Target = (typeof TARGETS)[number];

type NormalizedBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PdfBox = NormalizedBox & {
  pageWidth: number;
  pageHeight: number;
};

function cvPayload() {
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
      schule: [
        {
          id: "school-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Schulhaus Beispiel, Hubersdorf",
          beschreibung: "Schwerpunkt Mathematik und Informatik",
        },
      ],
      erfahrung: [
        {
          id: "work-1",
          zeit: "Sept. 2026",
          titel: "Schnupperlehre Informatik",
          ort: "Beispiel AG, Hubersdorf",
          beschreibung: "Support, kleine Automatisierungen mit Python",
        },
      ],
      sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Volleyball", "Programmieren"],
      staerken: ["Zuverlässig", "Teamfähig"],
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
    },
    elements: [],
    elementStyles: {},
  };
}

async function seedCv(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
    localStorage.setItem("lebenslauf:layout:v1", "classic");
  }, cvPayload());
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function downloadStandaloneCv(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Download" }).click();
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await page.getByRole("button", { name: /Nur Lebenslauf als PDF/i }).click();
  return downloadPromise;
}

async function pdfSelectionBoxes(path: string): Promise<Partial<Record<Target, PdfBox>>> {
  const { getDocument, Util } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableFontFace: true }).promise;
  const pdfPage = await document.getPage(1);
  const viewport = pdfPage.getViewport({ scale: 1 });
  const content = await pdfPage.getTextContent();

  const items = content.items.flatMap((item) => {
    if (!("str" in item)) return [];
    const text = item.str.trim().replace(/\s+/gu, " ");
    if (!text) return [];

    const transform = Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(transform[2], transform[3]);
    const style = content.styles[item.fontName] as
      | { ascent?: number; descent?: number }
      | undefined;
    const ascent =
      typeof style?.ascent === "number"
        ? style.ascent
        : typeof style?.descent === "number"
          ? 1 + style.descent
          : 0.8;

    return [
      {
        text,
        box: {
          left: transform[4],
          top: transform[5] - fontHeight * ascent,
          width: item.width * viewport.scale,
          height: fontHeight,
          pageWidth: viewport.width,
          pageHeight: viewport.height,
        } satisfies PdfBox,
      },
    ];
  });

  const boxes: Partial<Record<Target, PdfBox>> = {};
  for (const target of TARGETS) {
    for (let start = 0; start < items.length; start += 1) {
      const fragments: typeof items = [];
      let combined = "";

      for (let index = start; index < items.length; index += 1) {
        fragments.push(items[index]);
        combined = fragments.map((fragment) => fragment.text).join(" ").replace(/\s+/gu, " ");

        if (combined === target) {
          const left = Math.min(...fragments.map((fragment) => fragment.box.left));
          const top = Math.min(...fragments.map((fragment) => fragment.box.top));
          const right = Math.max(
            ...fragments.map((fragment) => fragment.box.left + fragment.box.width),
          );
          const bottom = Math.max(
            ...fragments.map((fragment) => fragment.box.top + fragment.box.height),
          );
          boxes[target] = {
            left,
            top,
            width: right - left,
            height: bottom - top,
            pageWidth: viewport.width,
            pageHeight: viewport.height,
          };
          break;
        }

        if (!target.startsWith(`${combined} `)) break;
      }

      if (boxes[target]) break;
    }
  }

  return boxes;
}

test.describe("CV PDF selection geometry", () => {
  test.setTimeout(120_000);

  test("native PDF selection boxes track the browser text they represent", async ({ page }) => {
    await seedCv(page);

    const exportPage = page
      .locator('[data-dossier-document="cv"][data-export-mode="true"] [data-cv-page]')
      .first();
    await exportPage.waitFor({ state: "attached" });
    for (const target of TARGETS) await expect(exportPage).toContainText(target);

    const browserBoxes = await exportPage.evaluate((element, targets) => {
      const pageElement = element as HTMLElement;
      const pageRect = pageElement.getBoundingClientRect();
      const result: Record<string, NormalizedBox> = {};

      for (const target of targets) {
        const walker = document.createTreeWalker(pageElement, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let node = walker.nextNode();

        while (node) {
          if (node instanceof Text) {
            const raw = node.nodeValue ?? "";
            const start = raw.indexOf(target);
            if (start >= 0) {
              range.setStart(node, start);
              range.setEnd(node, start + target.length);
              const rect = range.getBoundingClientRect();
              result[target] = {
                left: (rect.left - pageRect.left) / pageRect.width,
                top: (rect.top - pageRect.top) / pageRect.height,
                width: rect.width / pageRect.width,
                height: rect.height / pageRect.height,
              };
              break;
            }
          }
          node = walker.nextNode();
        }
      }

      return result;
    }, TARGETS);

    for (const target of TARGETS) {
      expect(browserBoxes[target], `browser Range must contain ${target}`).toBeTruthy();
    }

    const download = await downloadStandaloneCv(page);
    const path = await download.path();
    expect(path).not.toBeNull();

    const pdfBoxes = await pdfSelectionBoxes(path ?? "");

    const horizontalPositionTolerance = 1.5 / 210;
    const verticalPositionTolerance = 1.5 / 297;
    const widthTolerance = 2 / 210;
    const heightTolerance = 2 / 297;

    for (const target of TARGETS) {
      const expected = browserBoxes[target];
      const actual = pdfBoxes[target];
      expect(actual, `PDF text layer must contain ${target}`).toBeTruthy();
      if (!expected || !actual) continue;

      const normalizedActual = {
        left: actual.left / actual.pageWidth,
        top: actual.top / actual.pageHeight,
        width: actual.width / actual.pageWidth,
        height: actual.height / actual.pageHeight,
      };

      expect(
        Math.abs(normalizedActual.left - expected.left),
        `${target}: selection left edge drifted from visible text`,
      ).toBeLessThanOrEqual(horizontalPositionTolerance);
      expect(
        Math.abs(normalizedActual.top - expected.top),
        `${target}: selection top edge drifted from visible text`,
      ).toBeLessThanOrEqual(verticalPositionTolerance);
      expect(
        Math.abs(normalizedActual.width - expected.width),
        `${target}: selection width drifted from visible text`,
      ).toBeLessThanOrEqual(widthTolerance);
      expect(
        Math.abs(normalizedActual.height - expected.height),
        `${target}: selection height drifted from visible text`,
      ).toBeLessThanOrEqual(heightTolerance);
    }
  });
});
