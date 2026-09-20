import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? process.env.BASE_URL ?? "http://127.0.0.1:5173";

async function resetStorage(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => window.localStorage.clear());
}

async function openSection(page: Page, name: string) {
  const section = page.locator(`[data-editor-section-title="${name}"]`);
  await expect(section).toHaveCount(1);
  const button = section.locator("[data-editor-section-toggle]");
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  return section;
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
    const cvTemplate = await openSection(page, "Vorlage");
    await expect(cvTemplate.getByText(/Hintergrund-Motiv/).first()).toBeVisible();
    const cvControl = cvTemplate.locator('input[type="range"]');
    await expect(cvControl).toHaveCount(1);
    await expect(cvControl).toHaveValue("25");
    expect(
      await cvControl.evaluate((node) => {
        const input = node as HTMLInputElement;
        return { min: input.min, max: input.max };
      }),
    ).toEqual({ min: "0", max: "100" });

    await resetStorage(page);
    const letterSlider = await openLetterMotifControl(page);
    await expect(letterSlider).toHaveAttribute("min", "0");
    await expect(letterSlider).toHaveAttribute("max", "100");
    await expect(letterSlider).toHaveValue("25");
  });

  test("Warm applies 0/25/50/100 only to decorative motifs and preserves baseline opacity", async ({
    page,
  }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    await page.getByRole("button", { name: "Warm", exact: true }).click();
    await openSection(page, "Header & Footer");
    await page
      .locator('[data-dossier-chrome-controls="letter"] [data-dossier-header-mode-control]')
      .selectOption("compact");
    const visiblePage = page
      .locator(
        "[data-letter-document-root]:not([data-letter-pagination-measurements]) [data-letter-page]",
      )
      .first();
    await expect(visiblePage).toHaveAttribute("data-letter-template", "freundlich");

    const motifLayer = visiblePage.locator('[data-letter-decorative-motif-layer="warm-orb"]');
    const motif = visiblePage.locator('[data-letter-decorative-motif="warm-orb"]');
    const structuralBand = visiblePage.locator('[data-letter-structural-surface="warm-band"]');
    await expect(motifLayer).toBeVisible();
    await expect(structuralBand).toBeVisible();

    for (const value of [0, 25, 50, 100]) {
      await slider.fill(String(value));
      await expect(visiblePage).toHaveAttribute("data-letter-motif-opacity", String(value / 100));
      expect(await motifLayer.evaluate((node) => getComputedStyle(node).opacity)).toBe(
        String(value / 100),
      );
    }

    await slider.fill("0");
    expect(await structuralBand.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");

    await slider.fill("25");
    const layerOpacity = Number(
      await motifLayer.evaluate((node) => getComputedStyle(node).opacity),
    );
    const baselineOpacity = Number(await motif.evaluate((node) => getComputedStyle(node).opacity));
    expect(baselineOpacity).toBeCloseTo(0.72, 4);
    expect(layerOpacity * baselineOpacity).toBeCloseTo(0.18, 4);
  });

  test("motif visibility reaches pagination measurement, standalone PDF DOM and reload", async ({
    page,
  }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    await slider.fill("50");

    const visible = page.locator("[data-letter-page]").first();
    await expect(visible).toHaveAttribute("data-letter-motif-opacity", "0.5");
    await expect(page.locator("[data-letter-measurement-page]").first()).toHaveAttribute(
      "data-letter-motif-opacity",
      "0.5",
    );
    await expect(
      page.locator("[data-letter-standalone-export] [data-letter-page]").first(),
    ).toHaveAttribute("data-letter-motif-opacity", "0.5");

    await page.waitForTimeout(350);
    await page.reload();
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    await openSection(page, "Vorlage");
    await expect(page.getByRole("slider", { name: "Hintergrund-Motiv" })).toHaveValue("50");
  });

  test("Fresh rail stays structural while decorative Fresh motifs follow 0 percent", async ({
    page,
  }) => {
    await resetStorage(page);
    const slider = await openLetterMotifControl(page);
    const freshButton = page.getByRole("button", { name: "Forest Flow", exact: true });
    test.skip((await freshButton.count()) === 0, "Forest Flow is not selectable in this build");
    await freshButton.click();
    await slider.fill("0");

    const visiblePage = page.locator("[data-letter-page]").first();
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
    await expect(page.locator("[data-letter-page]").first()).toHaveAttribute(
      "data-letter-motif-opacity",
      "0.25",
    );
  });
});
