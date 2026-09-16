import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

async function openFresh(page: Page, path: string) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  const download = page.getByRole("button", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
}

test.describe("Canonical Brief dossier fallback", () => {
  test("fresh title page resolves to Brief", async ({ page }) => {
    await openFresh(page, "/titelblatt");

    const cover = page.locator('[data-dossier-document="cover"]').first();
    await expect(cover).toHaveAttribute("data-cover-template", "brief");
  });

  test("fresh motivation letter is plain Brief with sender in normal content", async ({ page }) => {
    await openFresh(page, "/anschreiben");

    const letter = page.getByLabel("Vorschau Motivationsschreiben");
    await expect(letter).toHaveAttribute("data-letter-template", "brief");
    await expect(letter).toHaveAttribute("data-letter-requested-header-mode", "none");
    await expect(letter).toHaveAttribute("data-letter-requested-footer-mode", "none");
    await expect(letter).toHaveAttribute("data-letter-header-mode", "none");
    await expect(letter).toHaveAttribute("data-letter-footer-mode", "none");

    const chrome = letter.locator('[data-dossier-chrome="letter"]');
    await expect(chrome).toHaveAttribute("data-dossier-header-mode", "none");
    await expect(chrome).toHaveAttribute("data-dossier-footer-mode", "none");
    await expect(letter.locator('[data-letter-section="sender"]')).toHaveCount(1);
    await expect(letter.locator("[data-letter-integrated-contact]")).toHaveCount(0);
    await expect(letter.locator("[data-dossier-compact-header]")).toHaveCount(0);
    await expect(letter.locator("[data-letter-footer]")).toHaveCount(0);
  });

  test("fresh CV is Brief + Standard/full-width with no shared chrome or sidebar", async ({ page }) => {
    await openFresh(page, "/lebenslauf");

    const cv = page.locator("main [data-dossier-document='cv']").first();
    await expect(cv).toHaveAttribute("data-cv-template", "brief");
    await expect(cv).toHaveAttribute("data-cv-layout", "classic");

    const firstPage = cv.locator('[data-cv-page="0"]');
    await expect(firstPage).toBeVisible();
    await expect(firstPage.locator('[data-dossier-chrome="cv"]')).toHaveAttribute(
      "data-dossier-header-mode",
      "none",
    );
    await expect(firstPage.locator('[data-dossier-chrome="cv"]')).toHaveAttribute(
      "data-dossier-footer-mode",
      "none",
    );
    await expect(firstPage.locator("[data-cv-sidebar]")).toHaveCount(0);
    await expect(firstPage.locator("[data-dossier-compact-header]")).toHaveCount(0);
    await expect(firstPage.locator("[data-dossier-footer]")).toHaveCount(0);
  });
});
