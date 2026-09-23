import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test.describe("shared CV and motivation-letter font", () => {
  test("propagates the dossier font from CV into the motivation letter", async ({ page }) => {
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem(
        "lebenslauf:v1",
        JSON.stringify({
          version: 6,
          data: {
            person: {
              vorname: "Lea",
              nachname: "Müller",
            },
          },
          design: {
            template: "modern",
            font: "times",
            colors: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" },
          },
        }),
      );
      localStorage.setItem(
        "anschreiben:v1",
        JSON.stringify({
          version: 1,
          data: {
            absenderName: "Lea Müller",
            betreff: "Bewerbung Informatik",
            text: "Ich interessiere mich für die Lehrstelle.",
          },
          design: {
            template: "brief",
            headerMode: "contact",
            colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
          },
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anschreiben:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("times");

    const initialLetterPage = page.locator("[data-letter-page]").first();
    await expect(initialLetterPage).toHaveAttribute("data-letter-font", "times");

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });

    const cvTypographySection = page.locator(
      '[data-editor-section-title="Schrift"] [data-editor-section-toggle]',
    );
    if ((await cvTypographySection.getAttribute("aria-expanded")) !== "true") {
      await cvTypographySection.click();
    }
    await expect(cvTypographySection).toHaveAttribute("aria-expanded", "true");

    const cvTypographyPanel = cvTypographySection.locator("xpath=ancestor::section[1]");
    const cvFontSelect = cvTypographyPanel.locator("select").first();
    await expect(cvFontSelect).toHaveValue("times");

    await cvFontSelect.selectOption("sans");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anschreiben:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("sans");

    const cvContact = page
      .locator('[data-dossier-document="cv"] [data-dossier-integrated-contact]')
      .first();
    await expect(cvContact).toBeVisible();
    await expect(cvContact).toContainText("Lea Müller");
    await expect
      .poll(() => cvContact.evaluate((element) => getComputedStyle(element).fontFamily))
      .toMatch(/Helvetica|Arial|sans-serif/i);

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
    const syncedLetterPage = page.locator("[data-letter-page]").first();
    await expect(syncedLetterPage).toHaveAttribute("data-letter-font", "sans");
    await expect
      .poll(() => syncedLetterPage.evaluate((element) => getComputedStyle(element).fontFamily))
      .toMatch(/Helvetica|Arial|sans-serif/i);
  });

  test("new cover, CV and letter native text all render in Cabin", async ({ page }) => {
    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });

    const coverBlock = page.locator('[data-dossier-document="cover"] [data-block-id]').first();
    await expect(coverBlock).toBeVisible();
    await expect
      .poll(() =>
        coverBlock.evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--dossier-font"),
        ),
      )
      .toContain("Cabin");

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });

    const letterPage = page.locator("[data-letter-page]").first();
    await expect(letterPage).toHaveAttribute("data-letter-font", "freundlich");
    await expect
      .poll(() => letterPage.evaluate((element) => getComputedStyle(element).fontFamily))
      .toContain("Cabin");

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    const cvPage = page.locator('[data-dossier-document="cv"] [data-cv-page]').first();
    await expect(cvPage).toBeVisible();
    await expect
      .poll(() =>
        cvPage.evaluate((element) => getComputedStyle(element).getPropertyValue("--dossier-font")),
      )
      .toContain("Cabin");

    const cvName = cvPage.locator("[data-cv-name]").first();
    await expect(cvName).toBeVisible();
    await expect
      .poll(() => cvName.evaluate((element) => getComputedStyle(element).fontFamily))
      .toContain("Cabin");
  });
});
