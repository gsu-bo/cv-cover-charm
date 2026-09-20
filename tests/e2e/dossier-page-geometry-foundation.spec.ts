import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const PAGE_MARGINS_KEY = "bewerbungsdossier:page-margins:v1";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";

const sharedChrome = {
  headerMode: "contact",
  headerHeightMm: 20,
  headerGapMm: 7,
  headerTextLayout: "stacked",
  footerMode: "none",
};

async function seedGeometry(page: Page, scope: "cv" | "letter") {
  const route = scope === "cv" ? "/lebenslauf" : "/anschreiben";
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ marginsKey, chromeKey, documentScope, chrome }) => {
      localStorage.clear();
      localStorage.setItem(
        marginsKey,
        JSON.stringify({
          [documentScope]: { top: 10, right: 22, bottom: 12, left: 24 },
        }),
      );
      localStorage.setItem(
        chromeKey,
        JSON.stringify({
          version: 1,
          sync: true,
          shared: chrome,
          cv: chrome,
          letter: chrome,
        }),
      );
    },
    {
      marginsKey: PAGE_MARGINS_KEY,
      chromeKey: CHROME_KEY,
      documentScope: scope,
      chrome: sharedChrome,
    },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

function parseContentBox(raw: string | null) {
  expect(raw).not.toBeNull();
  const [left, top, right, bottom] = (raw ?? "").split(",").map(Number);
  return { left, top, right, bottom };
}

test.describe("shared dossier page geometry foundation", () => {
  test("Letter preview and measurement use the same composed content box", async ({ page }) => {
    await seedGeometry(page, "letter");

    const visible = page.locator('[data-letter-page]:visible [data-letter-text-layer]').first();
    await expect(visible).toBeVisible();
    const visibleBox = parseContentBox(await visible.getAttribute("data-letter-content-box"));
    expect(visibleBox).toEqual({ left: 24, top: 37, right: 22, bottom: 12 });

    const chrome = page.locator('[data-letter-page]:visible [data-dossier-chrome="letter"]').first();
    await expect(chrome).toHaveAttribute("data-dossier-content-left-mm", "24");
    await expect(chrome).toHaveAttribute("data-dossier-content-right-mm", "22");

    await expect
      .poll(async () => {
        const measurement = page
          .locator('[data-letter-measurement-page] [data-letter-text-layer]')
          .first();
        if (!(await measurement.count())) return null;
        return parseContentBox(await measurement.getAttribute("data-letter-content-box"));
      })
      .toEqual(visibleBox);
  });

  test("CV visible and measurement pages use the same composed content box", async ({ page }) => {
    await seedGeometry(page, "cv");

    const preview = page
      .locator('[data-dossier-document="cv"][data-export-mode="false"]')
      .first();
    await expect(preview).toBeVisible();

    const visibleMain = preview.locator('[data-cv-page]:visible [data-cv-main]').first();
    const measurementMain = preview.locator('[data-cv-measure-page] [data-cv-main]').first();
    await expect(visibleMain).toHaveCSS("top", /px$/);
    expect(await visibleMain.evaluate((node) => (node as HTMLElement).style.top)).toBe("37mm");
    expect(await visibleMain.evaluate((node) => (node as HTMLElement).style.bottom)).toBe("12mm");
    expect(await visibleMain.evaluate((node) => (node as HTMLElement).style.left)).toBe("24mm");
    expect(await visibleMain.evaluate((node) => (node as HTMLElement).style.right)).toBe("22mm");
    expect(await measurementMain.evaluate((node) => (node as HTMLElement).style.top)).toBe("37mm");
    expect(await measurementMain.evaluate((node) => (node as HTMLElement).style.bottom)).toBe("12mm");

    const chrome = preview.locator('[data-cv-page]:visible [data-dossier-chrome="cv"]').first();
    await expect(chrome).toHaveAttribute("data-dossier-content-left-mm", "24");
    await expect(chrome).toHaveAttribute("data-dossier-content-right-mm", "22");
  });
});