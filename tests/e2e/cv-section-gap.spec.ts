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
      .filter({ visible: true })
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
      .filter({ visible: true })
      .first()
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).marginTop));
    expect(Math.abs(exportMargin - margins.school)).toBeLessThanOrEqual(0.5);
  });

  test("explicit rubric typography and full/none rule beat template defaults in preview and export", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await page.evaluate((data) => {
      localStorage.clear();
      localStorage.setItem(
        "lebenslauf:v1",
        JSON.stringify({
          version: 6,
          data: {
            ...data,
            sectionLayouts: {},
          },
          design: {
            template: "glow",
            colors: { primary: "#1f2937", accent: "#0ea5e9", bg: "#ffffff" },
            font: "freundlich",
            bgOpacity: 0.25,
            useElements: false,
            sectionTitleFontSizePx: 22,
            sectionTitleColor: "#8844cc",
            sectionTitleBold: false,
            sectionTitleItalic: true,
            sectionTitleUnderline: true,
            sectionTitleMarginBottomPx: 17,
            headingRule: "full",
          },
          elements: [],
        }),
      );
      localStorage.setItem("lebenslauf:layout:v1", "classic");
    }, CV_DATA);
    await page.reload({ waitUntil: "domcontentloaded" });

    const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    const exportRoot = page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();
    await expect(preview).toBeVisible();

    const assertStyledHeadings = async (root: typeof preview) => {
      const headings = root.locator('[data-cv-section-title]').filter({ visible: true });
      await expect.poll(() => headings.count()).toBeGreaterThanOrEqual(2);
      const count = Math.min(2, await headings.count());
      for (let index = 0; index < count; index += 1) {
        const styles = await headings.nth(index).evaluate((node) => {
          const computed = getComputedStyle(node);
          return {
            fontSize: computed.fontSize,
            color: computed.color,
            fontWeight: computed.fontWeight,
            fontStyle: computed.fontStyle,
            textDecorationLine: computed.textDecorationLine,
          };
        });
        expect(styles.fontSize).toBe("22px");
        expect(styles.color).toBe("rgb(136, 68, 204)");
        expect(Number(styles.fontWeight)).toBeLessThanOrEqual(500);
        expect(styles.fontStyle).toBe("italic");
        expect(styles.textDecorationLine).toContain("underline");
      }

      const section = root.locator('[data-cv-section]').filter({ visible: true }).first();
      await expect(section).toBeVisible();
      expect(
        await section.evaluate((node) => Number.parseFloat(getComputedStyle(node).marginBottom)),
      ).toBeCloseTo(17, 0);

      const rule = root.locator('[data-cv-accent="section"]').filter({ visible: true }).first();
      await expect(rule).toBeVisible();
      expect(await rule.evaluate((node) => getComputedStyle(node).display)).not.toBe("none");
      expect((await rule.boundingBox())?.width ?? 0).toBeGreaterThan(10);
    };

    await assertStyledHeadings(preview);
    await assertStyledHeadings(exportRoot);

    await page.evaluate(() => {
      const raw = localStorage.getItem("lebenslauf:v1");
      if (!raw) throw new Error("missing CV seed");
      const saved = JSON.parse(raw);
      saved.design.headingRule = "none";
      localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const noRulePreview = page
      .locator('[data-dossier-document="cv"][data-export-mode="false"]')
      .first();
    await expect(noRulePreview).toBeVisible();
    await expect(noRulePreview.locator('[data-cv-accent="section"]')).toHaveCount(0);

    const underlined = noRulePreview.locator('[data-cv-section-title]').filter({ visible: true }).first();
    await expect(underlined).toBeVisible();
    expect(await underlined.evaluate((node) => getComputedStyle(node).textDecorationLine)).toContain(
      "underline",
    );
  });
});
