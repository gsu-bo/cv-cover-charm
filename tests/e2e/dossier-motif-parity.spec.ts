import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:5173";

async function resetStorage(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => window.localStorage.clear());
}

async function openSection(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}

async function openLetterMotifControl(page: Page) {
  await page.goto(`${BASE_URL}/anschreiben`);
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
  await openSection(page, "Vorlage");
  const slider = page.getByRole("slider", { name: "Hintergrund-Motiv" });
  await expect(slider).toBeVisible();
  return slider;
}

test.describe("CV / letter background motif parity", () => {
  test("CV and letter both expose a 0-100 motif control", async ({ page }) => {
    await resetStorage(page);
    await page.goto(`${BASE_URL}/lebenslauf`);
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    await openSection(page, "Vorlage");
    const cvControl = page.locator("input[type=range]").filter({
      has: page.locator("xpath=..", { hasText: "Hintergrund-Motiv" }),
    });
    await expect(page.getByText(/Hintergrund-Motiv 25 % sichtbar/).first()).toBeVisible();
    expect(await page.locator('input[type="range"]').evaluateAll((nodes) =>
      nodes.some((node) => node.getAttribute("min") === "0" && node.getAttribute("max") === "100"),
    )).toBe(true);
    void cvControl;

    await resetStorage(page);
    const letterSlider = await openLetterMotifControl(page);
    await expect(letterSlider).toHaveAttribute("min", "0");
    await expect(letterSlider).toHaveAttribute("max", "100");
    await expect(letterSlider).toHaveValue("25");
  });

  test("Warm applies 0/25/50/100 only to decorative motifs and preserves baseline opacity", async ({ page }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    await page.getByRole("button", { name: "Warm", exact: true }).click();
    const visiblePage = page.locator('[data-letter-document-root]:not([data-letter-pagination-measurements]) [data-letter-page]').first();
    await expect(visiblePage).toHaveAttribute("data-letter-template", "freundlich");

    const motifLayer = visiblePage.locator('[data-letter-decorative-motif-layer="warm-orb"]');
    const motif = visiblePage.locator('[data-letter-decorative-motif="warm-orb"]');
    const structuralBand = visiblePage.locator('[data-letter-structural-surface="warm-band"]');
    await expect(motifLayer).toBeVisible();
    await expect(structuralBand).toBeVisible();

    for (const value of [0, 25, 50, 100]) {
      await slider.fill(String(value));
      await expect(visiblePage).toHaveAttribute("data-letter-motif-opacity", String(value / 100));
      expect(await motifLayer.evaluate((node) => getComputedStyle(node).opacity)).toBe(String(value / 100));
    }

    await slider.fill("0");
    expect(await structuralBand.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");

    await slider.fill("25");
    const layerOpacity = Number(await motifLayer.evaluate((node) => getComputedStyle(node).opacity));
    const baselineOpacity = Number(await motif.evaluate((node) => getComputedStyle(node).opacity));
    expect(baselineOpacity).toBeCloseTo(0.72, 4);
    expect(layerOpacity * baselineOpacity).toBeCloseTo(0.18, 4);
  });

  test("motif visibility reaches pagination measurement, standalone PDF DOM and reload", async ({ page }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    await slider.fill("50");

    const visible = page.locator('[data-letter-page]').first();
    await expect(visible).toHaveAttribute("data-letter-motif-opacity", "0.5");
    await expect(page.locator('[data-letter-measurement-page]').first()).toHaveAttribute(
      "data-letter-motif-opacity",
      "0.5",
    );
    await expect(page.locator('[data-letter-standalone-export] [data-letter-page]').first()).toHaveAttribute(
      "data-letter-motif-opacity",
      "0.5",
    );

    await page.waitForTimeout(350);
    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    await openSection(page, "Vorlage");
    await expect(page.getByRole("slider", { name: "Hintergrund-Motiv" })).toHaveValue("50");
  });

  test("Fresh rail stays structural while decorative Fresh motifs follow 0 percent", async ({ page }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    const freshButton = page.getByRole("button", { name: "Forest Flow", exact: true });
    test.skip((await freshButton.count()) === 0, "Forest Flow is not selectable in this build");
    await freshButton.click();
    await slider.fill("0");

    const visiblePage = page.locator('[data-letter-page]').first();
    const rail = visiblePage.locator('[data-letter-structural-surface="rail"]');
    const decorative = visiblePage.locator('[data-letter-decorative-motif-layer="soft-orb"]');
    await expect(rail).toBeVisible();
    expect(await rail.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
    expect(await decorative.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");
  });

  test("CV design transfer carries motif visibility into the letter", async ({ page }) => {
    await resetStorage(page);
    await page.evaluate(() => {
      window.localStorage.setItem(
        "lebenslauf:v1",
        JSON.stringify({
          version: 1,
          data: { person: {} },
          design: {
            template: "freundlich",
            colors: {
              bg: "#fff9ef",
              primary: "#0f766e",
              secondary: "#f59e0b",
              ink: "#0b1f24",
            },
            font: "freundlich",
            bgOpacity: 0.25,
          },
        }),
      );
    });

    const slider = await openLetterMotifControl(page);
    await expect(slider).toHaveValue("25");
    await expect(page.locator('[data-letter-page]').first()).toHaveAttribute(
      "data-letter-motif-opacity",
      "0.25",
    );
  });
});
