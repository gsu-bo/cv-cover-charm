import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "lebenslauf:v1";

const SCHOOL_MARKERS = Array.from({ length: 14 }, (_, index) => `SchoolMarker${index + 1}`);
const WORK_MARKERS = Array.from({ length: 12 }, (_, index) => `WorkMarker${index + 1}`);
const REQUIRED_MARKERS = [...SCHOOL_MARKERS, ...WORK_MARKERS, "FamilyFinalMarker", "ReferenceFinalMarker"];

function longCvPayload() {
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
      schule: SCHOOL_MARKERS.map((marker, index) => ({
        id: `school-${index}`,
        zeit: `${2026 - index} – ${2027 - index}`,
        titel: marker,
        ort: `Schulhaus ${index + 1}, Solothurn`,
        beschreibung:
          "Realistischer längerer Eintrag mit Informatik, Projektarbeit, selbstständigem Lernen und Dokumentation.",
      })),
      erfahrung: WORK_MARKERS.map((marker, index) => ({
        id: `work-${index}`,
        zeit: `202${index % 7}`,
        titel: marker,
        ort: `Beispielbetrieb ${index + 1}`, 
        beschreibung:
          "Schnupper- und Praxiserfahrung mit mehreren Aufgaben, Rückmeldungen aus dem Team und eigener Dokumentation.",
      })),
      sprachen: [
        { id: "de", name: "Deutsch", niveau: "Muttersprache" },
        { id: "en", name: "Englisch", niveau: "B1" },
      ],
      hobbys: ["Volleyball", "Programmieren", "Fotografie"],
      staerken: ["Zuverlässig", "Teamfähig", "Ausdauernd"],
      referenzen: [
        {
          id: "ref-final",
          name: "ReferenceFinalMarker",
          funktion: "Klassenlehrperson",
          kontakt: "032 000 00 00",
          email: "referenz@example.ch",
        },
      ],
      customSections: [
        {
          id: "familie",
          title: "Familie",
          entries: [
            {
              id: "family-final",
              zeit: "",
              titel: "FamilyFinalMarker",
              ort: "",
              beschreibung: "Sohn von Monika Müller und Peter Müller; Geschwister Aline und Jaro.",
            },
          ],
        },
      ],
      labels: {},
      hidden: {},
    },
    design: {
      template: "modern",
      colors: {
        bg: "#ffffff",
        ink: "#172033",
        primary: "#24364b",
        secondary: "#dbeafe",
        accent: "#2563eb",
      },
      font: "freundlich",
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
    elementStyles: {},
  };
}

async function seed(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
    },
    { key: STORAGE_KEY, payload: longCvPayload() },
  );
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
    "data-editor-ready",
    "true",
    { timeout: 15_000 },
  );
}

async function pageMarkerDistribution(page: Page, exportMode: boolean) {
  const pages = page.locator(
    `[data-dossier-document="cv"][data-export-mode="${exportMode ? "true" : "false"}"] [data-cv-page]`,
  );
  return pages.evaluateAll((nodes, markers) =>
    nodes.map((node) => {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      return (markers as string[]).filter((marker) => text.includes(marker));
    }),
    REQUIRED_MARKERS,
  );
}

async function expectNoMainClipping(page: Page, exportMode: boolean) {
  const mains = page.locator(
    `[data-dossier-document="cv"][data-export-mode="${exportMode ? "true" : "false"}"] [data-cv-page] [data-cv-main]`,
  );
  const geometry = await mains.evaluateAll((nodes) =>
    nodes.map((node) => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight })),
  );
  expect(geometry.length).toBeGreaterThan(1);
  for (const item of geometry) {
    expect(item.scrollHeight).toBeLessThanOrEqual(item.clientHeight + 3);
  }
}

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
  return pages;
}

test.describe("CV long-content pagination hardening", () => {
  test.setTimeout(180_000);

  test("realistic long CV paginates to 2+ deterministic unclipped pages and PDF agrees", async ({
    page,
  }) => {
    await seed(page);
    const previewPages = page.locator(
      '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page]',
    );
    const exportPages = page.locator(
      '[data-dossier-document="cv"][data-export-mode="true"] [data-cv-page]',
    );

    await expect.poll(() => previewPages.count(), { timeout: 30_000 }).toBeGreaterThan(1);
    await expect.poll(() => exportPages.count(), { timeout: 30_000 }).toBeGreaterThan(1);
    const previewCount = await previewPages.count();
    expect(await exportPages.count()).toBe(previewCount);

    await expectNoMainClipping(page, false);
    await expectNoMainClipping(page, true);

    const previewText = (await previewPages.allInnerTexts()).join(" ");
    const exportText = (await exportPages.allInnerTexts()).join(" ");
    for (const marker of REQUIRED_MARKERS) {
      expect(previewText, `preview lost ${marker}`).toContain(marker);
      expect(exportText, `export DOM lost ${marker}`).toContain(marker);
    }

    const firstDistribution = await pageMarkerDistribution(page, false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );
    const restoredPages = page.locator(
      '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page]',
    );
    await expect.poll(() => restoredPages.count(), { timeout: 30_000 }).toBe(previewCount);
    expect(await pageMarkerDistribution(page, false)).toEqual(firstDistribution);
    await expectNoMainClipping(page, false);

    await page.getByRole("button", { name: "Download", exact: true }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: /Nur Lebenslauf als PDF/i }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    const pdfPages = await extractPdfText(path ?? "");
    expect(pdfPages.length).toBe(previewCount);
    const pdfText = pdfPages.join(" ");
    for (const marker of REQUIRED_MARKERS) {
      expect(pdfText, `PDF lost ${marker}`).toContain(marker);
    }
  });
});
