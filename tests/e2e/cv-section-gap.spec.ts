import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

const CV_DATA = {
  titel: "Lebenslauf",
  person: {
    vorname: "Lea",
    nachname: "Müller",
    adresse: "Dorfstrasse 12",
    plzOrt: "4535 Hubersdorf",
    telefon: "+41 79 123 45 67",
    email: "lea.mueller@example.ch",
    geburtsdatum: "14.03.2010",
    nationalitaet: "Schweiz",
    untertitel: "Schülerin, 3. Sekundarklasse",
    foto: null,
  },
  schule: [
    {
      id: "school-1",
      zeit: "2023 – heute",
      titel: "Sekundarschule, Niveau A",
      ort: "Schulhaus Zentrum, Hubersdorf",
      beschreibung: "Schwerpunkt Mathematik und Informatik",
    },
  ],
  erfahrung: [
    {
      id: "work-1",
      zeit: "Sept. 2026",
      titel: "Schnupperlehre Informatik",
      ort: "Beispiel AG, Hubersdorf",
      beschreibung: "Support und kleine Automatisierungen",
    },
  ],
  sprachen: [],
  hobbys: [],
  staerken: [],
  referenzen: [],
  customSections: [],
  sectionOrder: ["person", "schule", "erfahrung", "sprachen", "hobbys", "staerken", "referenzen"],
  sectionLayouts: {
    schule: { page: 1, width: "half", positioning: "flow" },
    erfahrung: { page: 1, width: "half", positioning: "flow" },
  },
  labels: {},
  hidden: {},
};

test.describe("global CV rubric spacing", () => {
  test.setTimeout(90_000);

  test("changes only vertical spacing and keeps two half-width rubrics side by side", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await page.evaluate((data) => {
      localStorage.clear();
      localStorage.setItem(
        "lebenslauf:v1",
        JSON.stringify({
          version: 6,
          data,
          design: {
            template: "modern",
            colors: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" },
            font: "freundlich",
            bgOpacity: 0.25,
            useElements: false,
          },
          elements: [],
        }),
      );
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:section-gap:v1", "7.5");
    }, CV_DATA);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.cvSectionGap))
      .toBe("custom");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--cv-section-gap")))
      .toBe("7.5mm");

    const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    await expect(preview).toBeVisible();

    const pair = preview
      .locator(
        '[data-cv-section-row]:has([data-cv-rubric="schule"]):has([data-cv-rubric="erfahrung"])',
      )
      .first();
    await expect(pair).toBeVisible();

    const school = pair.locator('[data-cv-rubric="schule"]').first();
    const experience = pair.locator('[data-cv-rubric="erfahrung"]').first();
    const schoolBox = await school.boundingBox();
    const experienceBox = await experience.boundingBox();
    expect(schoolBox).not.toBeNull();
    expect(experienceBox).not.toBeNull();
    if (!schoolBox || !experienceBox) return;

    expect(Math.abs(schoolBox.y - experienceBox.y)).toBeLessThanOrEqual(2);
    expect(experienceBox.x).toBeGreaterThan(schoolBox.x + schoolBox.width * 0.7);

    const margins = await pair.evaluate((node) => {
      const schoolHeading = node.querySelector<HTMLElement>('[data-cv-section="schule"]');
      const experienceHeading = node.querySelector<HTMLElement>('[data-cv-section="erfahrung"]');
      return {
        school: schoolHeading ? Number.parseFloat(getComputedStyle(schoolHeading).marginTop) : -1,
        experience: experienceHeading
          ? Number.parseFloat(getComputedStyle(experienceHeading).marginTop)
          : -1,
      };
    });
    expect(margins.school).toBeGreaterThan(25);
    expect(Math.abs(margins.school - margins.experience)).toBeLessThanOrEqual(0.5);

    const exportRoot = page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();
    const exportMargin = await exportRoot
      .locator('[data-cv-section="schule"]')
      .first()
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).marginTop));
    expect(Math.abs(exportMargin - margins.school)).toBeLessThanOrEqual(0.5);
  });
});
