import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { DEFAULT_DOSSIER_CHROME_STATE } from "../../src/lib/dossier-chrome";
import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
} from "../../src/lib/template-chrome";

const BASE_URL = "http://127.0.0.1:4173";
const GALLERY_DIR = process.env.WEB_GALLERY_DIR ?? "artifacts/dossier-web-gallery";
const GALLERY_BATCH_SIZE = 4;
const GALLERY_BATCH_COUNT = 10;
const CHROME_STORAGE_KEY = "bewerbungsdossier:chrome:v1";
const SAMPLE_LOCATION = "Hubersdorf";
const SAMPLE_POSTAL_LOCATION = "4535 Hubersdorf";
const SAMPLE_DATE = "15.11.2026";

function galleryBatchIndex(): number | null {
  const raw = process.env.WEB_GALLERY_BATCH_INDEX;
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= GALLERY_BATCH_COUNT) {
    throw new Error(
      `Invalid WEB_GALLERY_BATCH_INDEX=${raw}; expected 0-${GALLERY_BATCH_COUNT - 1}`,
    );
  }
  return value;
}

// Keep this catalogue exactly aligned with dossier-gallery.spec.ts. The Web
// gallery and PDF gallery must review the same 39 live product templates.
const RETIRED_TEMPLATE_IDS = new Set(["edelBlockig", "sonnig", "warm4", "warm5"]);
const ALL_GALLERY_TEMPLATES = [
  ...TEMPLATES.filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string)).map(
    (template) => ({ id: template.id, name: template.name }),
  ),
  ...FRESH_TEMPLATE_REGISTRY.filter(
    (template) => !RETIRED_TEMPLATE_IDS.has(template.id as string),
  ),
  { id: "edelDark", name: "Edel Dark" },
];

async function waitEditorReady(page: Page) {
  const toggle = page.getByRole("button", { name: "Download", exact: true });
  await expect(toggle).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
  return toggle;
}

async function loadDemoThroughUi(page: Page, route: string) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  const toggle = await waitEditorReady(page);
  await toggle.click();
  const demo = page.getByRole("button", { name: "Beispieldaten übernehmen", exact: true });
  await expect(demo).toBeVisible();
  await demo.click();
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.waitForTimeout(550);
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function settleVisiblePreview(page: Page, preview: Locator) {
  await expect(preview).toBeVisible({ timeout: 15_000 });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
  await page.waitForTimeout(120);
}

async function captureVisiblePreview(
  page: Page,
  route: string,
  selector: string,
  fileName: string,
) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
  const preview = page.locator(selector).first();
  await settleVisiblePreview(page, preview);
  await preview.screenshot({
    path: join(GALLERY_DIR, fileName),
    animations: "disabled",
    caret: "hide",
  });
}

test("all 39 live dossier templates produce visible Web preview screenshots", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const batchIndex = galleryBatchIndex();
  await page.setViewportSize({ width: 1800, height: 1600 });
  await mkdir(GALLERY_DIR, { recursive: true });

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());

  // Follow the same real student data path as the PDF gallery.
  await loadDemoThroughUi(page, "/titelblatt");
  await loadDemoThroughUi(page, "/anschreiben");
  await loadDemoThroughUi(page, "/lebenslauf");

  // Keep the same canonical place/date fixture as dossier-gallery.spec.ts so a
  // later Web <-> PDF comparison is a true renderer comparison, not a data diff.
  const stored = await page.evaluate(
    ({ chromeStorageKey, sampleLocation, samplePostalLocation, sampleDate }) => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      const letter = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null");
      const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      const chrome = JSON.parse(localStorage.getItem(chromeStorageKey) ?? "null");

      if (cover?.data) {
        cover.data.ort = sampleLocation;
        cover.data.datum = sampleDate;
        cover.data.plzOrt = samplePostalLocation;
        cover.data.betriebAdresse = `Industriestrasse 8, ${samplePostalLocation}`;
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      }
      if (letter?.data) {
        letter.data.absenderPlzOrt = samplePostalLocation;
        letter.data.empfaengerPlzOrt = samplePostalLocation;
        letter.data.ort = sampleLocation;
        letter.data.datum = sampleDate;
        localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      }
      if (cv?.data) {
        cv.data.person.plzOrt = samplePostalLocation;
        for (const entry of cv.data.schule ?? []) {
          if (entry.id === "demo-s1") entry.ort = "Schulhaus Zentrum, Hubersdorf";
          if (entry.id === "demo-s2") entry.ort = "Primarschule Hubersdorf";
        }
        for (const entry of cv.data.erfahrung ?? []) {
          if (entry.id === "demo-p1") entry.ort = "Beispiel AG, Hubersdorf";
          if (entry.id === "demo-p2") entry.ort = "Muster GmbH, Hubersdorf";
        }
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      }

      return { cover, letter, cv, chrome };
    },
    {
      chromeStorageKey: CHROME_STORAGE_KEY,
      sampleLocation: SAMPLE_LOCATION,
      samplePostalLocation: SAMPLE_POSTAL_LOCATION,
      sampleDate: SAMPLE_DATE,
    },
  );

  expect(stored.cover?.data?.vorname).toBe("Lea");
  expect(stored.letter?.data?.unterschrift).toBe("Lea Müller");
  expect(stored.cv?.data?.person?.vorname).toBe("Lea");
  expect(stored.cover?.data?.datum).toBe(SAMPLE_DATE);
  expect(stored.letter?.data?.datum).toBe(SAMPLE_DATE);
  expect(stored.cover?.data?.ort).toBe(SAMPLE_LOCATION);
  expect(stored.letter?.data?.ort).toBe(SAMPLE_LOCATION);
  expect(stored.cover?.data?.plzOrt).toBe(SAMPLE_POSTAL_LOCATION);
  expect(stored.letter?.data?.absenderPlzOrt).toBe(SAMPLE_POSTAL_LOCATION);
  expect(stored.letter?.data?.empfaengerPlzOrt).toBe(SAMPLE_POSTAL_LOCATION);
  expect(stored.cv?.data?.person?.plzOrt).toBe(SAMPLE_POSTAL_LOCATION);
  expect(JSON.stringify(stored)).not.toMatch(/Solothurn|Zuchwil/);

  const galleryBaseChrome = stored.chrome ?? DEFAULT_DOSSIER_CHROME_STATE;
  const cases: Array<{
    label: string;
    letterTemplate: "brief" | TemplateId;
    coverTemplate: TemplateId;
    cvTemplate: TemplateId;
  }> = ALL_GALLERY_TEMPLATES.map((template) => ({
    label: template.name,
    letterTemplate: template.id as "brief" | TemplateId,
    coverTemplate: template.id as TemplateId,
    cvTemplate: template.id as TemplateId,
  }));

  const galleryIds = ALL_GALLERY_TEMPLATES.map(({ id }) => id as string);
  expect(FRESH_TEMPLATE_REGISTRY).toHaveLength(22);
  expect(ALL_GALLERY_TEMPLATES).toHaveLength(39);
  expect(cases).toHaveLength(39);
  expect(cases.at(-1)?.label).toBe("Edel Dark");
  for (const retiredId of ["edelBlockig", "sonnig", "warm4", "warm5"]) {
    expect(galleryIds).not.toContain(retiredId);
  }
  for (const requiredId of ["edel", "edelDark", "warm2", "warm3", "verlauf2", "verlauf3"]) {
    expect(galleryIds).toContain(requiredId);
  }
  expect(new Set(galleryIds).size).toBe(39);
  expect(Math.ceil(cases.length / GALLERY_BATCH_SIZE)).toBe(GALLERY_BATCH_COUNT);

  const batchStart = batchIndex === null ? 0 : batchIndex * GALLERY_BATCH_SIZE;
  const batchEnd =
    batchIndex === null ? cases.length : Math.min(batchStart + GALLERY_BATCH_SIZE, cases.length);
  const selectedCases = cases.slice(batchStart, batchEnd).map((item, offset) => ({
    item,
    globalIndex: batchStart + offset,
  }));

  const manifestEntries: string[] = [];

  for (const { item, globalIndex } of selectedCases) {
    const headerMode = defaultHeaderModeForTemplate(item.coverTemplate);
    const headerGapMm = defaultHeaderGapMmForTemplate(item.coverTemplate);

    await page.evaluate(
      ({
        base,
        baseChrome,
        letterTemplate,
        coverTemplate,
        cvTemplate,
        headerMode,
        headerGapMm,
        chromeStorageKey,
      }) => {
        const cover = structuredClone(base.cover);
        const letter = structuredClone(base.letter);
        const cv = structuredClone(base.cv);
        const chrome = structuredClone(baseChrome);

        cover.template = coverTemplate;
        letter.design.template = letterTemplate;
        letter.design.colors =
          letterTemplate === "brief"
            ? {
                bg: "#ffffff",
                ink: "#111111",
                primary: "#111111",
                secondary: "#111111",
                accent: "#111111",
                cvInk: "#111111",
                cvMuted: "#4b5563",
                cvHeading: "#111111",
              }
            : { ...(cover.colors?.[letterTemplate] ?? letter.design.colors) };
        cv.design.template = cvTemplate;
        cv.design.colors = { ...(cover.colors?.[cvTemplate] ?? cv.design.colors) };

        chrome.shared.headerMode = headerMode;
        chrome.shared.headerGapMm = headerGapMm;
        chrome.cv.headerMode = headerMode;
        chrome.cv.headerGapMm = headerGapMm;
        chrome.letter.headerMode = headerMode;
        chrome.letter.headerGapMm = headerGapMm;
        letter.design.headerMode = headerMode;

        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
        localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
        localStorage.setItem(chromeStorageKey, JSON.stringify(chrome));
      },
      {
        base: stored,
        baseChrome: galleryBaseChrome,
        letterTemplate: item.letterTemplate,
        coverTemplate: item.coverTemplate,
        cvTemplate: item.cvTemplate,
        headerMode,
        headerGapMm,
        chromeStorageKey: CHROME_STORAGE_KEY,
      },
    );

    const fileNumber = String(globalIndex + 1).padStart(2, "0");
    const baseName = `${fileNumber}-${safeName(item.label)}`;
    const coverName = `${baseName}--cover.png`;
    const letterName = `${baseName}--letter.png`;
    const cvName = `${baseName}--cv.png`;

    await captureVisiblePreview(
      page,
      "/titelblatt",
      'main [data-dossier-document="cover"]',
      coverName,
    );
    await captureVisiblePreview(page, "/anschreiben", "main [data-letter-page]", letterName);
    await captureVisiblePreview(
      page,
      "/lebenslauf",
      '[data-dossier-document="cv"][data-export-mode="false"]',
      cvName,
    );

    manifestEntries.push(`${baseName} | ${item.label} | ${coverName} | ${letterName} | ${cvName}`);
  }

  await writeFile(
    join(
      GALLERY_DIR,
      batchIndex === null
        ? "MANIFEST.txt"
        : `MANIFEST.part-${String(batchIndex).padStart(2, "0")}.txt`,
    ),
    `${manifestEntries.join("\n")}\n`,
    "utf8",
  );
});