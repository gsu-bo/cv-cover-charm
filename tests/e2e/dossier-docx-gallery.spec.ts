import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "../../src/lib/dossier-docx-family";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
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

    const download = await downloadDocxThroughFormatDialog(page);
    const fileName = `${galleryBaseName(globalIndex, item.label)}.docx`;
    const target = join(GALLERY_DIR, fileName);
    await download.saveAs(target);
    await assertCompleteDocx(target);
    manifestEntries.push(`${fileName} | ${item.id} | ${item.label}`);
  }

  const part = String(batchIndex ?? 0).padStart(2, "0");
  await writeFile(join(GALLERY_DIR, `MANIFEST.part-${part}.txt`), `${manifestEntries.join("\n")}\n`);
});
