import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";

function compactChromeState() {
  const options = {
    headerMode: "compact",
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  };
  return {
    version: 1,
    sync: true,
    shared: options,
    cv: options,
    letter: options,
  };
}

async function openChromeControls(page: Page) {
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const section = page
    .locator("[data-editor-section-toggle]")
    .filter({ hasText: "Header & Footer" })
    .first();
  await expect(section).toBeVisible();
  if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
  await expect(section).toHaveAttribute("aria-expanded", "true");

  const controls = page.locator('[data-dossier-chrome-controls="cv"]');
  await expect(controls).toHaveCount(1);
  await expect(controls).toBeVisible();
  return { section, controls };
}

async function activateDevTools(page: Page) {
  const menuButton = page.locator('button[data-editor-ready="true"]').first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const devTools = page.locator('[data-template-qa-switch="true"]');
  await expect(devTools).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept("555"));
  await devTools.click();
  await expect(page.locator("html")).toHaveAttribute("data-template-qa-active", "true");
}

test.describe("Dev Tools keyboard shortcuts", () => {
  test.setTimeout(90_000);

  test("Ctrl+Down advances the visible compact Header dropdown and Ctrl+Up reverses it", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/lebenslauf?qa=1`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, state }) => {
        localStorage.setItem(key, JSON.stringify(state));
        window.location.reload();
      },
      { key: CHROME_KEY, state: compactChromeState() },
    );
    await page.waitForLoadState("domcontentloaded");

    const { section, controls } = await openChromeControls(page);
    const select = controls.locator("[data-cv-header-mode-control]");
    await expect(select).toHaveValue("compact");

    await activateDevTools(page);

    // No select focus required: Dev Tools targets the visible primary Header select.
    await section.focus();
    await page.keyboard.press("Control+ArrowDown");
    await expect(select).toHaveValue("contact-stacked");

    // The helper focuses the stepped select, so subsequent shortcuts continue there.
    await page.keyboard.press("Control+ArrowDown");
    await expect(select).toHaveValue("contact-inline");

    await page.keyboard.press("Control+ArrowUp");
    await expect(select).toHaveValue("contact-stacked");

    const chrome = page.locator('[data-dossier-chrome="cv"]').first();
    await expect(chrome).toHaveAttribute("data-dossier-effective-header-mode", "contact");
  });
});
