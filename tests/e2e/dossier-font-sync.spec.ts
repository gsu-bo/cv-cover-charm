import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

async function openLetterTypography(page: Page) {
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const toggle = page.getByRole("button", { name: "Schrift", exact: true });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  // Scope to the stable section shell instead of React's useId-generated panel id.
  // This section has exactly one select, so we do not depend on wrapping-label
  // accessible-name timing while hydration settles.
  const section = toggle.locator("xpath=ancestor::section[1]");
  const select = section.locator("select").first();
  await expect(select).toBeVisible();
  return select;
}

test.describe("shared CV and motivation-letter font", () => {
  test("propagates font changes both ways between CV and motivation letter", async ({ page }) => {
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
            // This test exercises contact typography, so select it explicitly.
            // An absent choice now correctly inherits neutral Brief.
            headerMode: "contact",
            colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
          },
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anschreiben:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("times");

    const fontSelect = await openLetterTypography(page);
    await expect(fontSelect).toHaveValue("times");

    // Motivation letter -> CV.
    await fontSelect.selectOption("maschine");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("lebenslauf:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("maschine");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anschreiben:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("maschine");

    // CV -> motivation letter. This direction is implemented through the shared
    // autosave font propagation and is now protected by a real editor interaction.
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });

    const cvTypographySection = page.getByRole("button", { name: /Schrift und Layout/ });
    if ((await cvTypographySection.getAttribute("aria-expanded")) !== "true") {
      await cvTypographySection.click();
    }
    await expect(cvTypographySection).toHaveAttribute("aria-expanded", "true");

    const cvTypographyPanel = cvTypographySection.locator("xpath=ancestor::section[1]");
    const cvFontSelect = cvTypographyPanel.locator("select").first();
    await expect(cvFontSelect).toHaveValue("maschine");

    await cvFontSelect.selectOption("sans");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("anschreiben:v1");
          return raw ? JSON.parse(raw).design?.font : null;
        }),
      )
      .toBe("sans");

    // In Contact-header mode the visible name lives in the integrated chrome;
    // the body keeps a zero-width placeholder to avoid rendering the name twice.
    // Assert the actual visible native CV text that the PDF text layer reads.
    const cvContact = page
      .locator('[data-dossier-document="cv"] [data-dossier-integrated-contact]')
      .first();
    await expect(cvContact).toBeVisible();
    await expect(cvContact).toContainText("Lea Müller");
    await expect
      .poll(() => cvContact.evaluate((element) => getComputedStyle(element).fontFamily))
      .toMatch(/Helvetica|Arial|sans-serif/i);

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const syncedLetterSelect = await openLetterTypography(page);
    await expect(syncedLetterSelect).toHaveValue("sans");
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

    // Protect the real PDF text source, not just the custom property on the page.
    // addCvTextLayer() reads these computed node styles when choosing PDF fonts.
    const cvName = cvPage.locator("[data-cv-name]").first();
    await expect(cvName).toBeVisible();
    await expect
      .poll(() => cvName.evaluate((element) => getComputedStyle(element).fontFamily))
      .toContain("Cabin");
  });
});
