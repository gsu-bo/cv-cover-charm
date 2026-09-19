import { defaultCvLayoutForTemplate } from "../../../src/components/cv/layout";
import { expect, type Page } from "@playwright/test";
import { FRESH_TEMPLATE_REGISTRY } from "../../../src/components/cover/fresh-template-registry";
import { TEMPLATES, type TemplateId } from "../../../src/components/cover/types";
import { DEFAULT_DOSSIER_CHROME_STATE } from "../../../src/lib/dossier-chrome";
import { DOSSIER_PAGE_MARGINS_STORAGE_KEY } from "../../../src/lib/dossier-page-margins";
import { CV_TEXT_ALIGNMENT_STORAGE_KEY } from "../../../src/components/cv/text-alignment";
import {
  defaultHeaderGapMmForTemplate,
  defaultHeaderModeForTemplate,
  defaultFooterModeForTemplate,
} from "../../../src/lib/template-chrome";

export const BASE_URL = "http://127.0.0.1:4173";
export const GALLERY_BATCH_SIZE = 4;
export const GALLERY_BATCH_COUNT = 10;
export const CHROME_STORAGE_KEY = "bewerbungsdossier:chrome:v1";
export const SAMPLE_LOCATION = "Hubersdorf";
export const SAMPLE_POSTAL_LOCATION = "4535 Hubersdorf";
export const SAMPLE_DATE = "15.11.2026";

export const RETIRED_TEMPLATE_IDS = new Set(["edelBlockig", "sonnig", "warm4", "warm5"]);

export const PRODUCT_TEMPLATES = [
  ...TEMPLATES.filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string)).map(
    (template) => ({ id: template.id, name: template.name }),
  ),
  ...FRESH_TEMPLATE_REGISTRY.filter(
    (template) => !RETIRED_TEMPLATE_IDS.has(template.id as string),
  ).map((template) => ({ id: template.id, name: template.name })),
  { id: "edelDark", name: "Edel Dark" },
];

export type GalleryCase = {
  id: string;
  label: string;
  letterTemplate: "brief" | TemplateId;
  coverTemplate: TemplateId;
  cvTemplate: TemplateId;
};

export const GALLERY_CASES: GalleryCase[] = PRODUCT_TEMPLATES.map((template) => ({
  id: template.id as string,
  label: template.name,
  letterTemplate: template.id as "brief" | TemplateId,
  coverTemplate: template.id as TemplateId,
  cvTemplate: template.id as TemplateId,
}));

export function galleryBatchIndex(envName: string): number | null {
  const raw = process.env[envName];
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= GALLERY_BATCH_COUNT) {
    throw new Error(`Invalid ${envName}=${raw}; expected 0-${GALLERY_BATCH_COUNT - 1}`);
  }
  return value;
}

export function selectedGalleryCases(batchIndex: number | null) {
  const batchStart = batchIndex === null ? 0 : batchIndex * GALLERY_BATCH_SIZE;
  const batchEnd =
    batchIndex === null
      ? GALLERY_CASES.length
      : Math.min(batchStart + GALLERY_BATCH_SIZE, GALLERY_CASES.length);
  return GALLERY_CASES.slice(batchStart, batchEnd).map((item, offset) => ({
    item,
    globalIndex: batchStart + offset,
  }));
}

export function expectedBatchTemplateCount(batchIndex: number): number {
  return batchIndex === GALLERY_BATCH_COUNT - 1 ? 3 : 4;
}

export function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function waitEditorReady(page: Page) {
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

export async function seedCanonicalDossier(page: Page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ pageMarginsKey, cvAlignmentKey }) => {
      localStorage.clear();
      // Keep newly introduced visual editor state explicit. This prevents a
      // future gallery run from inheriting memory/storage defaults that are not
      // part of the canonical fixture itself.
      localStorage.setItem(pageMarginsKey, "{}");
      localStorage.setItem(cvAlignmentKey, "left");
    },
    {
      pageMarginsKey: DOSSIER_PAGE_MARGINS_STORAGE_KEY,
      cvAlignmentKey: CV_TEXT_ALIGNMENT_STORAGE_KEY,
    },
  );

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

export type CanonicalDossier = Awaited<ReturnType<typeof seedCanonicalDossier>>;

export function assertCanonicalDossier(stored: CanonicalDossier) {
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
}

export function assertGalleryCatalog() {
  const galleryIds = PRODUCT_TEMPLATES.map(({ id }) => id as string);
  expect(FRESH_TEMPLATE_REGISTRY).toHaveLength(21);
  expect(PRODUCT_TEMPLATES).toHaveLength(39);
  expect(GALLERY_CASES).toHaveLength(39);
  expect(GALLERY_CASES.at(-1)?.label).toBe("Edel Dark");
  for (const retiredId of RETIRED_TEMPLATE_IDS) expect(galleryIds).not.toContain(retiredId);
  for (const requiredId of ["edel", "edelDark", "warm2", "warm3", "verlauf2", "verlauf3"]) {
    expect(galleryIds).toContain(requiredId);
  }
  expect(new Set(galleryIds).size).toBe(39);
  expect(Math.ceil(GALLERY_CASES.length / GALLERY_BATCH_SIZE)).toBe(GALLERY_BATCH_COUNT);
}

export async function applyGalleryCase(page: Page, stored: CanonicalDossier, item: GalleryCase) {
  const headerMode = defaultHeaderModeForTemplate(item.coverTemplate);
  const headerGapMm = defaultHeaderGapMmForTemplate(item.coverTemplate);
  const footerMode = defaultFooterModeForTemplate(item.coverTemplate);
  const cvLayout = defaultCvLayoutForTemplate(item.cvTemplate);
  const galleryBaseChrome = stored.chrome ?? DEFAULT_DOSSIER_CHROME_STATE;

  // Never write the next fixture while an editor from the previous case is
  // mounted. Delayed autosave can otherwise overwrite the just-seeded storage.
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    ({
      base,
      baseChrome,
      letterTemplate,
      coverTemplate,
      cvTemplate,
      headerMode,
      headerGapMm,
      footerMode,
      cvLayout,
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
      letter.design.footerMode = footerMode;
      chrome.shared.footerMode = footerMode;
      chrome.cv.footerMode = footerMode;
      chrome.letter.footerMode = footerMode;
      localStorage.setItem("lebenslauf:layout:v1", cvLayout);

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
      footerMode,
      cvLayout,
      chromeStorageKey: CHROME_STORAGE_KEY,
    },
  );

  const persistedTemplates = await page.evaluate(() => ({
    cover: JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null")?.template ?? null,
    letter: JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null")?.design?.template ?? null,
    cv: JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null")?.design?.template ?? null,
  }));
  expect(persistedTemplates.cover).toBe(item.coverTemplate);
  expect(persistedTemplates.letter).toBe(item.letterTemplate);
  expect(persistedTemplates.cv).toBe(item.cvTemplate);
}

export function galleryBaseName(globalIndex: number, label: string) {
  return `${String(globalIndex + 1).padStart(2, "0")}-${safeName(label)}`;
}
