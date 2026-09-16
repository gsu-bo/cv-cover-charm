import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE_URL,
  assertCanonicalDossier,
  assertGalleryCatalog,
  applyGalleryCase,
  galleryBaseName,
  galleryBatchIndex,
  seedCanonicalDossier,
  selectedGalleryCases,
  waitEditorReady,
} from "./support/dossier-gallery-shared";

const GALLERY_DIR = process.env.WEB_GALLERY_DIR ?? "artifacts/dossier-web-gallery";

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
  expectedAttribute?: { name: string; value: string },
) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
  const preview = page.locator(selector).first();
  if (expectedAttribute) {
    await expect(preview).toHaveAttribute(expectedAttribute.name, expectedAttribute.value, {
      timeout: 15_000,
    });
  }
  await settleVisiblePreview(page, preview);
  await preview.screenshot({
    path: join(GALLERY_DIR, fileName),
    animations: "disabled",
    caret: "hide",
  });
}

test("all 39 live dossier templates produce visible Web preview screenshots", async ({ page }) => {
  test.setTimeout(15 * 60_000);
  const batchIndex = galleryBatchIndex("WEB_GALLERY_BATCH_INDEX");
  await page.setViewportSize({ width: 1800, height: 1600 });
  await mkdir(GALLERY_DIR, { recursive: true });

  const stored = await seedCanonicalDossier(page);
  assertCanonicalDossier(stored);
  assertGalleryCatalog();

  const manifestEntries: string[] = [];
  for (const { item, globalIndex } of selectedGalleryCases(batchIndex)) {
    await applyGalleryCase(page, stored, item);

    const baseName = galleryBaseName(globalIndex, item.label);
    const coverName = `${baseName}--cover.png`;
    const letterName = `${baseName}--letter.png`;
    const cvName = `${baseName}--cv.png`;

    await captureVisiblePreview(
      page,
      "/titelblatt",
      'main [data-dossier-document="cover"]',
      coverName,
    );
    await captureVisiblePreview(
      page,
      "/anschreiben",
      "main [data-letter-page]",
      letterName,
      { name: "data-letter-template", value: item.letterTemplate as string },
    );
    await captureVisiblePreview(
      page,
      "/lebenslauf",
      '[data-dossier-document="cv"][data-export-mode="false"]',
      cvName,
      { name: "data-cv-template", value: item.cvTemplate as string },
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
