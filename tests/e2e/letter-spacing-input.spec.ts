import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test.describe("motivation letter spacing inputs", () => {
  test("defaults are compact and fields stay empty while the user replaces a value", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "networkidle" });

    const closingGap = page.getByLabel("Abstand vor Gruss");
    const signatureGap = page.getByLabel("Platz für Unterschrift");

    await expect(closingGap).toHaveValue("4");
    await expect(signatureGap).toHaveValue("1");

    await closingGap.focus();
    await closingGap.fill("");
    await expect(closingGap).toHaveValue("");
    await closingGap.pressSequentially("12");
    await expect(closingGap).toHaveValue("12");
    await closingGap.blur();
    await expect(closingGap).toHaveValue("12");

    await signatureGap.focus();
    await signatureGap.fill("");
    await expect(signatureGap).toHaveValue("");
    await signatureGap.pressSequentially("6");
    await expect(signatureGap).toHaveValue("6");
    await signatureGap.blur();
    await expect(signatureGap).toHaveValue("6");
  });

  test("out-of-range values are clamped only after editing finishes", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "networkidle" });

    const closingGap = page.getByLabel("Abstand vor Gruss");
    await closingGap.focus();
    await closingGap.fill("");
    await closingGap.pressSequentially("91");

    // Do not fight the user while they are still typing.
    await expect(closingGap).toHaveValue("91");

    await closingGap.blur();
    await expect(closingGap).toHaveValue("50");
  });
});
