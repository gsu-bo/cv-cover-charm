import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "../../src/lib/dossier-docx-family";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import {
  DOSSIER_PAGE_MARGINS_STORAGE_KEY,
  type DossierPageMargins,
  type DossierPageMarginsState,
} from "../../src/lib/dossier-page-margins";
import {
  BASE_URL,
  GALLERY_CASES,
  PRODUCT_TEMPLATES,
  RETIRED_TEMPLATE_IDS,
  assertCanonicalDossier,
  assertGalleryCatalog,
  applyGalleryCase,
  galleryBaseName,
  galleryBatchIndex,
  seedCanonicalDossier,
  selectedGalleryCases,
} from "./support/dossier-gallery-shared";

const GALLERY_DIR = process.env.DOCX_GALLERY_DIR ?? "artifacts/dossier-docx-gallery";
const SECTION_PATTERN = /<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g;
const PAGE_MARGIN_TAG_PATTERN = /<w:pgMar\b[^>]*\/?>/;
const MM_TO_TWIPS = 1440 / 25.4;
const CUSTOM_MARGIN_STATE = {
  letter: { top: 41, right: 42, bottom: 43, left: 44 },
  cv: { top: 45, right: 46, bottom: 47, left: 48 },
} satisfies DossierPageMarginsState;

const twips = (mm: number) => Math.round(mm * MM_TO_TWIPS);

function sectionBlocks(documentXml: string) {
  return documentXml.match(SECTION_PATTERN) ?? [];
}

function pageMarginTag(section: string) {
  const match = section.match(PAGE_MARGIN_TAG_PATTERN);
  expect(match, "Word section should contain w:pgMar").not.toBeNull();
  return match?.[0] ?? "";
}

function readMarginTwips(tag: string, name: keyof DossierPageMargins) {
  const match = tag.match(new RegExp(`\\bw:${name}=(['"])(-?\\d+)\\1`));
  expect(match, `w:pgMar should contain ${name}`).not.toBeNull();
  return Number(match?.[2]);
}

function expectMarginsAtLeast(section: string, requested: DossierPageMargins) {
  const tag = pageMarginTag(section);
  for (const [name, value] of Object.entries(requested) as [keyof DossierPageMargins, number][]) {
    expect(readMarginTwips(tag, name), `${name} should preserve or safely enlarge user intent`).toBeGreaterThanOrEqual(
      twips(value),
    );
  }
}

function assertCustomMarginSections(
  baselineDocumentXml: string,
  customDocumentXml: string,
  state: DossierPageMarginsState,
) {
  const baselineSections = sectionBlocks(baselineDocumentXml);
  const customSections = sectionBlocks(customDocumentXml);
  expect(customSections).toHaveLength(baselineSections.length);
  expect(customSections.length).toBeGreaterThanOrEqual(3);

  const letterIndex = customSections.length - 2;
  const cvIndex = customSections.length - 1;
  for (let index = 0; index < letterIndex; index += 1) {
    expect(pageMarginTag(customSections[index]), `cover section ${index} margins must stay unchanged`).toBe(
      pageMarginTag(baselineSections[index]),
    );
  }

  if (state.letter) expectMarginsAtLeast(customSections[letterIndex], state.letter);
  if (state.cv) expectMarginsAtLeast(customSections[cvIndex], state.cv);
}

async function readCompleteDocx(path: string) {
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
  expect(sectionBlocks(documentXml)).toHaveLength(3);
  return documentXml;
}

async function setPageMargins(page: Page, state: DossierPageMarginsState) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: DOSSIER_PAGE_MARGINS_STORAGE_KEY, value: state },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function downloadDocxThroughFormatDialog(page: Page) {
  await page.waitForLoadState("networkidle");
  const dossierCard = page.getByRole("button").filter({ hasText: "Gesamtdossier herunterladen" });
  await expect(dossierCard).toBeVisible();
  await dossierCard.click();

  const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
  await expect(dialog).toBeVisible();
  const docxOption = dialog.getByRole("radio", { name: "Bearbeitbares Dossier (DOCX)" });
  await expect(docxOption).toBeEnabled({ timeout: 30_000 });
  await docxOption.click();
  await expect(docxOption).toHaveAttribute("aria-checked", "true");

  const downloadButton = dialog.getByRole("button", { name: "DOCX herunterladen", exact: true });
  await expect(downloadButton).toBeEnabled({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
  await downloadButton.click();
  return downloadPromise;
}

test("real browser DOCX gallery exports all 39 active dossier templates", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const batchIndex = galleryBatchIndex("DOCX_GALLERY_BATCH_INDEX");
  const stored = await seedCanonicalDossier(page);
  await mkdir(GALLERY_DIR, { recursive: true });

  assertCanonicalDossier(stored);
  assertGalleryCatalog();

  const productIds = PRODUCT_TEMPLATES.map(({ id }) => id as string);
  const planIds = Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS);
  expect(new Set(planIds).size).toBe(39);
  expect([...productIds].sort()).toEqual([...planIds].sort());
  for (const retiredId of RETIRED_TEMPLATE_IDS) expect(productIds).not.toContain(retiredId);
  expect(GALLERY_CASES).toHaveLength(39);

  const manifestEntries: string[] = [];
  for (const { item, globalIndex } of selectedGalleryCases(batchIndex)) {
    await applyGalleryCase(page, stored, item);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await setPageMargins(page, {});

    const download = await downloadDocxThroughFormatDialog(page);
    const fileName = `${galleryBaseName(globalIndex, item.label)}.docx`;
    const target = join(GALLERY_DIR, fileName);
    await download.saveAs(target);
    const baselineDocumentXml = await readCompleteDocx(target);

    await setPageMargins(page, CUSTOM_MARGIN_STATE);
    const customDownload = await downloadDocxThroughFormatDialog(page);
    const customPath = await customDownload.path();
    expect(customPath).not.toBeNull();
    const customDocumentXml = await readCompleteDocx(customPath ?? "");
    assertCustomMarginSections(baselineDocumentXml, customDocumentXml, CUSTOM_MARGIN_STATE);

    await setPageMargins(page, {});
    manifestEntries.push(`${fileName} | ${item.id} | ${item.label}`);
  }

  const part = String(batchIndex ?? 0).padStart(2, "0");
  await writeFile(join(GALLERY_DIR, `MANIFEST.part-${part}.txt`), `${manifestEntries.join("\n")}\n`);
});
