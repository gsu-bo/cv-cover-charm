import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:5173";

async function resetStorage(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => window.localStorage.clear());
}

async function ready(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`);
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
}

async function section(page: Page, title: string): Promise<Locator> {
  const target = page.locator(`[data-editor-section-title="${title}"]`);
  await expect(target).toHaveCount(1);
  return target;
}

async function openSection(page: Page, title: string): Promise<Locator> {
  const target = await section(page, title);
  const toggle = target.locator("[data-editor-section-toggle]");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  return target;
}

async function setRange(control: Locator, value: number) {
  await control.evaluate((node, next) => {
    const input = node as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function openMargins(container: Locator, scope: "cv" | "letter") {
  const details = container.locator(`[data-dossier-page-margins-control="${scope}"]`);
  await expect(details).toHaveCount(1);
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
  return details;
}

test.describe("shared editor controls consistency", () => {
  test("CV owns one of each shared section and persists chrome + margins", async ({ page }) => {
    await resetStorage(page);
    await ready(page, "/lebenslauf");

    for (const title of ["Vorlage", "Header & Footer", "Layout", "Schrift"]) {
      await expect(page.locator(`[data-editor-section-title="${title}"]`)).toHaveCount(1);
    }

    const template = await openSection(page, "Vorlage");
    await expect(template.getByText(/Hintergrund-Motiv/).first()).toBeVisible();

    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator('[data-dossier-chrome-controls="cv"]')).toHaveCount(1);
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");
    const gap = chrome.locator("[data-dossier-header-gap-control]");
    await expect(gap).toBeVisible();
    await setRange(gap, 17);
    await expect(gap).toHaveValue("17");

    let layout = await openSection(page, "Layout");
    await expect(layout.getByText(/Seitenspalte/).first()).toBeVisible();
    let margins = await openMargins(layout, "cv");
    const right = margins.getByLabel("Seitenrand Rechts in Millimetern");
    await right.fill("30");
    await right.press("Tab");
    await expect(right).toHaveValue("30");

    const typography = await openSection(page, "Schrift");
    await expect(typography.locator("[data-cv-doc-title-margin-top-control]")).toHaveCount(1);

    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await expect(chrome.locator("[data-dossier-header-gap-control]")).toHaveValue("17");
    layout = await openSection(page, "Layout");
    margins = await openMargins(layout, "cv");
    await expect(margins.getByLabel("Seitenrand Rechts in Millimetern")).toHaveValue("30");
  });

  test("Letter owns one of each shared section and keeps letter-specific Layout controls", async ({
    page,
  }) => {
    await resetStorage(page);
    await ready(page, "/anschreiben");

    for (const title of ["Vorlage", "Header & Footer", "Layout", "Schrift"]) {
      await expect(page.locator(`[data-editor-section-title="${title}"]`)).toHaveCount(1);
    }

    const template = await openSection(page, "Vorlage");
    await expect(template.getByRole("slider", { name: "Hintergrund-Motiv" })).toHaveValue("25");

    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator('[data-dossier-chrome-controls="letter"]')).toHaveCount(1);
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");
    const gap = chrome.locator("[data-dossier-header-gap-control]");
    await setRange(gap, 16);
    await expect(gap).toHaveValue("16");

    let layout = await openSection(page, "Layout");
    await expect(
      layout.getByRole("slider", { name: "Firma / Lehrbetrieb – vertikale Position" }),
    ).toBeVisible();
    let margins = await openMargins(layout, "letter");
    const left = margins.getByLabel("Seitenrand Links in Millimetern");
    await left.fill("31");
    await left.press("Tab");
    await expect(left).toHaveValue("31");

    const typography = await openSection(page, "Schrift");
    await expect(typography.locator("[data-cv-doc-title-margin-top-control]")).toHaveCount(0);
    await expect(typography.getByRole("combobox", { name: "Schriftart" })).toBeVisible();

    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await expect(chrome.locator("[data-dossier-header-gap-control]")).toHaveValue("16");
    layout = await openSection(page, "Layout");
    margins = await openMargins(layout, "letter");
    await expect(margins.getByLabel("Seitenrand Links in Millimetern")).toHaveValue("31");
  });

  test("Header & Footer sync still shares changes and can be disabled", async ({ page }) => {
    await resetStorage(page);
    await ready(page, "/lebenslauf");
    let chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-chrome-sync]")).toBeChecked();
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("compact");

    await ready(page, "/anschreiben");
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
    await chrome.locator("[data-dossier-chrome-sync]").uncheck();
    await chrome.locator("[data-dossier-header-mode-control]").selectOption("none");

    await ready(page, "/lebenslauf");
    chrome = await openSection(page, "Header & Footer");
    await expect(chrome.locator("[data-dossier-chrome-sync]")).not.toBeChecked();
    await expect(chrome.locator("[data-dossier-header-mode-control]")).toHaveValue("compact");
  });
});
