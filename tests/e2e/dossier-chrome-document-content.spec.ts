import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

async function openFresh(page: Page, path: string) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
}

async function openChrome(page: Page) {
  const toggle = page
    .locator("[data-editor-section-toggle]")
    .filter({ hasText: "Header & Footer" })
    .first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return page.locator("[data-dossier-document-content-controls]");
}

test.describe("document-specific header/footer content", () => {
  test("CV header title is independent from the CV body title and survives export canvas", async ({
    page,
  }) => {
    await openFresh(page, "/lebenslauf");
    const controls = await openChrome(page);

    const headerTitle = controls.getByLabel("Titel anzeigen").first();
    await headerTitle.check();
    const titleInput = controls.locator('input[type="text"]').first();
    await titleInput.fill("LEBENSLAUF HEADER");

    const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    await expect(preview.locator("[data-dossier-header-title]").first()).toHaveText(
      "LEBENSLAUF HEADER",
    );

    const bodyToggle = page.getByLabel("Dokumenttitel im Lebenslauf anzeigen");
    await bodyToggle.uncheck();
    await expect(preview.locator("[data-cv-doc-title]")).toHaveCount(0);

    const exportCv = page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();
    await expect(exportCv.locator("[data-dossier-header-title]").first()).toHaveText(
      "LEBENSLAUF HEADER",
    );
    await expect(exportCv.locator("[data-cv-doc-title]")).toHaveCount(0);
  });

  test("synced geometry keeps CV and letter custom text document-specific", async ({ page }) => {
    await openFresh(page, "/lebenslauf");
    let controls = await openChrome(page);
    await controls.getByLabel("Eigener Text").first().check();
    await controls.locator("textarea").first().fill("CV ONLY");

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
    controls = await openChrome(page);
    await controls.getByLabel("Eigener Text").first().check();
    await controls.locator("textarea").first().fill("LETTER ONLY");

    const letter = page.getByLabel("Vorschau Motivationsschreiben");
    await expect(letter.locator("[data-dossier-header-custom-text]").first()).toHaveText(
      "LETTER ONLY",
    );
    await expect(letter).not.toContainText("CV ONLY");

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    const cv = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    await expect(cv.locator("[data-dossier-header-custom-text]").first()).toHaveText("CV ONLY");
    await expect(cv).not.toContainText("LETTER ONLY");
  });
});
