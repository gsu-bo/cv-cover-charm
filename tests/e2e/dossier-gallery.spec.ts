import { expect, test, type Page } from "@playwright/test";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE_URL,
  SAMPLE_DATE,
  SAMPLE_LOCATION,
  SAMPLE_POSTAL_LOCATION,
  assertCanonicalDossier,
  assertGalleryCatalog,
  applyGalleryCase,
  galleryBaseName,
  galleryBatchIndex,
  seedCanonicalDossier,
  selectedGalleryCases,
} from "./support/dossier-gallery-shared";

const GALLERY_DIR = process.env.GALLERY_DIR ?? "artifacts/dossier-gallery";

async function extractPdfText(path: string): Promise<string> {
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
  return pages.join("\n").replace(/\s+/g, " ").trim();
}

function withoutWhitespace(value: string): string {
  return value.replace(/\s+/g, "");
}

async function downloadWholeDossier(page: Page, fileName: string) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  const card = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
  await expect(card).toContainText("Format wählen", { timeout: 15_000 });
  await card.click();

  const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Fertiges Dossier (PDF)" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const button = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
  await expect(button).toBeEnabled({ timeout: 30_000 });

  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await button.click();
  const download = await downloadPromise;
  const tempPath = await download.path();
  expect(tempPath).not.toBeNull();

  await mkdir(GALLERY_DIR, { recursive: true });
  const target = join(GALLERY_DIR, fileName);
  await copyFile(tempPath ?? "", target);
  expect((await stat(target)).size).toBeGreaterThan(10_000);

  const pdfText = await extractPdfText(target);
  expect(pdfText).toContain("Bewerbung um eine Lehrstelle als Informatiker/in EFZ");
  expect(pdfText).toContain("Herr Thomas Weber");
  expect(pdfText).toContain("Guten Tag");
  expect(pdfText).toContain("Sekundarschule, Niveau A");
  expect(pdfText).toContain(SAMPLE_POSTAL_LOCATION);
  expect(pdfText).toContain(`${SAMPLE_LOCATION}, ${SAMPLE_DATE}`);
  expect(pdfText).not.toContain("Solothurn");
  expect(pdfText).not.toContain("Zuchwil");
  expect(withoutWhitespace(pdfText)).toContain(
    withoutWhitespace("Schwerpunkt Mathematik und Informatik"),
  );
  return target;
}

test("all 39 live dossier templates produce review PDFs", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const batchIndex = galleryBatchIndex("GALLERY_BATCH_INDEX");
  const stored = await seedCanonicalDossier(page);
  assertCanonicalDossier(stored);
  assertGalleryCatalog();

  const manifestEntries: string[] = [];
  for (const { item, globalIndex } of selectedGalleryCases(batchIndex)) {
    await applyGalleryCase(page, stored, item);
    const fileName = `${galleryBaseName(globalIndex, item.label)}.pdf`;
    await downloadWholeDossier(page, fileName);
    manifestEntries.push(`${fileName} | ${item.label}`);
  }

  await mkdir(GALLERY_DIR, { recursive: true });
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
