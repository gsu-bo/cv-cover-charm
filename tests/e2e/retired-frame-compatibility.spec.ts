import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test("a persisted retired Frame CV normalizes to Brief before preview and export", async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
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
            adresse: "",
            plzOrt: "",
            telefon: "",
            email: "",
            geburtsdatum: "",
            nationalitaet: "",
            untertitel: "",
            foto: null,
          },
        },
        design: {
          template: "frame",
          colors: { bg: "#ffffff", ink: "#111827", accent: "#2563eb" },
          bgOpacity: 0.25,
          useElements: false,
        },
        elements: [],
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
  const exportRoot = page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();
  await expect(preview).toHaveAttribute("data-cv-template", "brief");
  await expect(exportRoot).toHaveAttribute("data-cv-template", "brief");
  await expect(page.locator("html")).toHaveAttribute("data-dossier-template", "brief");

  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null")?.design?.template,
      ),
    )
    .toBe("brief");
});

test("a retired Frame cover import replaces the current template with canonical Brief", async ({
  page,
}) => {
  await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({ version: 8, template: "diagonal", data: {} }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const covers = page.locator('[data-dossier-document="cover"]');
  await expect(covers.first()).toHaveAttribute("data-cover-template", "diagonal");

  await page.getByRole("button", { name: "Download" }).click();
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: "legacy-frame-cover.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        template: "frame",
        data: { vorname: "Lea", nachname: "Müller" },
      }),
    ),
  });

  await expect(covers).toHaveCount(2);
  await expect(covers.first()).toHaveAttribute("data-cover-template", "brief");
  await expect(covers.nth(1)).toHaveAttribute("data-cover-template", "brief");
  await expect(page.locator("html")).toHaveAttribute("data-dossier-template", "brief");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null")?.template),
    )
    .toBe("brief");
});
