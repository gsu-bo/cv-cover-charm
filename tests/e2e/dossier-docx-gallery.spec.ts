import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { DEFAULT_DOSSIER_CHROME_STATE } from "../../src/lib/dossier-chrome";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "../../src/lib/dossier-docx-family";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
} from "../../src/lib/template-chrome";

const BASE_URL = "http://127.0.0.1:4173";
const GALLERY_DIR = process.env.DOCX_GALLERY_DIR ?? "artifacts/dossier-docx-gallery";
const GALLERY_BATCH_SIZE = 4;
const GALLERY_BATCH_COUNT = 10;
const CHROME_STORAGE_KEY = "bewerbungsdossier:chrome:v1";
const SAMPLE_LOCATION = "Hubersdorf";
const SAMPLE_POSTAL_LOCATION = "4535 Hubersdorf";
const SAMPLE_DATE = "15.11.2026";
const RETIRED_TEMPLATE_IDS = new Set(["edelBlockig", "sonnig", "warm4", "warm5"]);

// Keep the DOCX gallery in the exact same product order as the PDF gallery.
// This is the canonical 39-template review order: Legacy, Fresh, then Edel Dark.
const PRODUCT_TEMPLATES = [
  ...TEMPLATES.filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string)).map(
    (template) => ({ id: template.id, name: template.name }),
  ),
  ...FRESH_TEMPLATE_REGISTRY.filter(
    (template) => !RETIRED_TEMPLATE_IDS.has(template.id as string),
  ).map((template) => ({ id: template.id, name: template.name })),
  { id: "edelDark", name: "Edel Dark" },
];

const CASES: Array<{
  id: string;
  label: string;
  buttonLabel: string;
  letterTemplate: "brief" | TemplateId;
  coverTemplate: TemplateId;
  cvTemplate: TemplateId;
}> = PRODUCT_TEMPLATES.map((template) => {
  const plan = DOSSIER_DOCX_TEMPLATE_PLANS[template.id as keyof typeof DOSSIER_DOCX_TEMPLATE_PLANS];
  if (!plan) throw new Error(`Active product template ${template.id} has no DOCX plan.`);
  return {
    id: template.id as string,
    label: template.name,
    buttonLabel: plan.label,
    letterTemplate: template.id as "brief" | TemplateId,
    coverTemplate: template.id as TemplateId,
    cvTemplate: template.id as TemplateId,
  };
});

function galleryBatchIndex(): number | null {
  const raw = process.env.DOCX_GALLERY_BATCH_INDEX;
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= GALLERY_BATCH_COUNT) {
    throw new Error(
      `Invalid DOCX_GALLERY_BATCH_INDEX=${raw}; expected 0-${GALLERY_BATCH_COUNT - 1}`,
    );
  }
  return value;
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

async function seedCanonicalDossier(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());

  // Use the very same real UI demo path as the PDF gallery. This prevents the
  // DOCX and PDF review packages from silently drifting to different fixtures.
  await loadDemoThroughUi(page, "/titelblatt");
  await loadDemoThroughUi(page, "/anschreiben");
  await loadDemoThroughUi(page, "/lebenslauf");

  return page.evaluate(
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
}

async function assertCompleteDocx(path: string) {
  const bytes = await readFile(path);
  expect(bytes.length).toBeGreaterThan(2_000);
  expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

  const entries = readStoredDocxEntries(bytes);
  expect(entries.some(({ name }) => name === "[Content_Types].xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/document.xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/styles.xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/_rels/document.xml.rels")).toBe(true);

  const documentEntry = entries.find(({ name }) => name === "word/document.xml");
  expect(documentEntry).toBeDefined();
  const documentXml = new TextDecoder().decode(documentEntry?.bytes);
  expect((documentXml.match(/<w:sectPr(?:\s|>)/g) ?? []).length).toBe(3);
}

test("real browser DOCX gallery exports all 39 active dossier templates", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const stored = await seedCanonicalDossier(page);
  await mkdir(GALLERY_DIR, { recursive: true });

  const productIds = PRODUCT_TEMPLATES.map(({ id }) => id as string);
  const planIds = Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS);
  expect(PRODUCT_TEMPLATES).toHaveLength(39);
  expect(new Set(productIds).size).toBe(39);
  expect(CASES).toHaveLength(39);
  expect(CASES.at(-1)?.label).toBe("Edel Dark");
  expect(new Set(planIds).size).toBe(39);
  expect([...productIds].sort()).toEqual([...planIds].sort());
  for (const retiredId of RETIRED_TEMPLATE_IDS) expect(productIds).not.toContain(retiredId);

  // These are the same canonical fixture invariants asserted by the PDF gallery.
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
  const batchIndex = galleryBatchIndex();
  const batchStart = batchIndex === null ? 0 : batchIndex * GALLERY_BATCH_SIZE;
  const batchEnd =
    batchIndex === null ? CASES.length : Math.min(batchStart + GALLERY_BATCH_SIZE, CASES.length);
  const selectedCases = CASES.slice(batchStart, batchEnd).map((item, offset) => ({
    item,
    globalIndex: batchStart + offset,
  }));

  if (batchIndex !== null) {
    const expectedBatchSize = batchIndex === GALLERY_BATCH_COUNT - 1 ? 3 : 4;
    expect(selectedCases).toHaveLength(expectedBatchSize);
  }

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
    await page.reload({ waitUntil: "domcontentloaded" });

    const button = page.getByRole("button", { name: `Dossier als DOCX · ${item.buttonLabel}` });
    await expect(button).toBeEnabled({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await button.click();
    const download = await downloadPromise;

    const fileNumber = String(globalIndex + 1).padStart(2, "0");
    const fileName = `${fileNumber}-${safeName(item.label)}.docx`;
    const target = join(GALLERY_DIR, fileName);
    await download.saveAs(target);
    await assertCompleteDocx(target);
    manifestEntries.push(`${fileName} | ${item.id} | ${item.label}`);
  }

  const part = String(batchIndex ?? 0).padStart(2, "0");
  await writeFile(join(GALLERY_DIR, `MANIFEST.part-${part}.txt`), `${manifestEntries.join("\n")}\n`);
});