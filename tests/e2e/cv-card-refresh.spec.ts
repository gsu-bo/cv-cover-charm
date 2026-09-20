import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

const TEMPLATES = [
  {
    id: "neon",
    colors: { bg: "#0d0b2b", primary: "#e11d8f", secondary: "#7c3aed", ink: "#f8fafc" },
    minSurfaceMm: 41,
  },
  {
    id: "verlauf",
    colors: { primary: "#7f5af0", secondary: "#2cb67d", ink: "#ffffff", bg: "#ffffff" },
    minSurfaceMm: 44,
  },
  {
    id: "citrus",
    colors: { primary: "#fb7185", secondary: "#fbbf24", bg: "#fffdf9", ink: "#3f1d2b" },
    minSurfaceMm: 37,
  },
] as const;

type SeedTemplate = {
  id: string;
  colors: Record<string, string>;
};

function data() {
  return {
    titel: "Lebenslauf",
    person: {
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Bahnhofstrasse 42",
      plzOrt: "8000 Zürich",
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
        ort: "Schulhaus Feld, Zürich",
        beschreibung: "Schwerpunkt Mathematik und Informatik",
      },
    ],
    erfahrung: [
      {
        id: "work-1",
        zeit: "Sept. 2026",
        titel: "Schnupperlehre Informatik",
        ort: "Beispiel AG, Zürich",
        beschreibung: "Support, kleine Automatisierungen mit Python",
      },
    ],
    sprachen: [
      { id: "de", name: "Deutsch", niveau: "Muttersprache" },
      { id: "en", name: "Englisch", niveau: "Gute Schulkenntnisse (B1)" },
    ],
    hobbys: ["Volleyball", "Programmieren"],
    staerken: ["Zuverlässig", "Teamfähig"],
    referenzen: [],
    labels: {},
    hidden: {},
  };
}

async function seed(page: Page, template: SeedTemplate) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
    },
    {
      payload: {
        version: 2,
        data: data(),
        design: {
          template: template.id,
          colors: template.colors,
          bgOpacity: 0.06,
          useElements: false,
        },
        elements: [],
      },
    },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.dossierTemplate === expected,
    template.id,
  );
  const sheet = page
    .locator('[data-dossier-document="cv"] [data-cv-page="0"]')
    .filter({ visible: true })
    .first();
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return sheet;
}

async function motifSlider(page: Page) {
  const slider = page
    .locator("label")
    .filter({ hasText: "Hintergrund-Motiv" })
    .locator('input[type="range"]');

  if ((await slider.count()) === 0) {
    const toggles = page.locator('[data-editor-section-toggle][aria-expanded="false"]');
    for (let index = 0; index < (await toggles.count()); index += 1) {
      await toggles.nth(index).click();
      if ((await slider.count()) > 0) break;
    }
  }

  await expect(slider).toBeVisible();
  return slider;
}

async function setMotifPercent(slider: Locator, percent: number) {
  await slider.focus();
  if (percent === 100) {
    await slider.press("End");
    return;
  }
  await slider.press("Home");
  for (let value = 0; value < percent; value += 1) {
    await slider.press("ArrowRight");
  }
}

async function setRangeValue(slider: Locator, value: number) {
  await slider.focus();
  await slider.press("Home");
  for (let current = 0; current < value; current += 1) {
    await slider.press("ArrowRight");
  }
}

const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

async function typographySnapshot(root: Locator) {
  return root.evaluate((node) => {
    const title = node.querySelector<HTMLElement>("[data-cv-page] [data-cv-doc-title]");
    const rubric = Array.from(
      node.querySelectorAll<HTMLElement>("[data-cv-page] [data-cv-section-title]"),
    ).find((candidate) => candidate.textContent?.trim() === "Projekte");
    const rule = rubric?.parentElement?.querySelector<HTMLElement>('[data-cv-accent="section"]');
    if (!title || !rubric || !rule) return null;
    const titleStyle = getComputedStyle(title);
    const rubricStyle = getComputedStyle(rubric);
    const ruleStyle = getComputedStyle(rule);
    return {
      title: {
        fontSize: titleStyle.fontSize,
        color: titleStyle.color,
        fontWeight: titleStyle.fontWeight,
        fontStyle: titleStyle.fontStyle,
        decoration: titleStyle.textDecorationLine,
        marginBottom: titleStyle.marginBottom,
      },
      rubric: {
        fontSize: rubricStyle.fontSize,
        color: rubricStyle.color,
        fontWeight: rubricStyle.fontWeight,
        fontStyle: rubricStyle.fontStyle,
        decoration: rubricStyle.textDecorationLine,
      },
      ruleColor: ruleStyle.backgroundColor,
    };
  });
}

async function citrusGeometrySnapshot(root: Locator) {
  return root.evaluate((node) => {
    const page = node.querySelector<HTMLElement>('[data-cv-page="0"]');
    const main = page?.querySelector<HTMLElement>("[data-cv-main]");
    const section = main?.querySelector<HTMLElement>("[data-cv-section]");
    const row = section?.firstElementChild as HTMLElement | null;
    const title = row?.querySelector<HTMLElement>("[data-cv-section-title]");
    const rule = row?.querySelector<HTMLElement>('[data-cv-accent="section"]');
    const entry = main?.querySelector<HTMLElement>("[data-cv-entry]");
    if (!page || !main || !row || !title || !rule || !entry) return null;

    const pageRect = page.getBoundingClientRect();
    const ruleRect = rule.getBoundingClientRect();
    const titleStyle = getComputedStyle(title);
    const rowStyle = getComputedStyle(row);
    const entryStyle = getComputedStyle(entry);
    const ruleStyle = getComputedStyle(rule);
    const cssPxPerMm = 96 / 25.4;
    const toCssMm = (pixels: number) => pixels / cssPxPerMm;
    const toPageMm = (pixels: number) => (pixels / pageRect.width) * 210;
    const rowTransform =
      rowStyle.transform === "none" ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(rowStyle.transform);

    return {
      // The controls are authored in CSS millimetres. Preview zoom changes DOM
      // rectangles, so read their computed CSS-space values instead of deriving
      // control values from the scaled A4 backing rectangle.
      headingOffsetMm: toCssMm(rowTransform.m41),
      contentIndentMm: toCssMm(Number.parseFloat(entryStyle.marginLeft) || 0),
      // Keep page-normalised visual geometry only for boundary/parity checks.
      ruleRightMm: toPageMm(ruleRect.right - pageRect.left),
      ruleWidthMm: toCssMm(Number.parseFloat(ruleStyle.width) || 0),
      pillBackground: titleStyle.backgroundColor,
      pillPaddingLeft: titleStyle.paddingLeft,
      headingDisplay: titleStyle.display,
      pageCount: node.querySelectorAll("[data-cv-page]").length,
    };
  });
}

test.describe("Neon / Verlauf / Citrus CV refresh", () => {
  test.setTimeout(120_000);

  test("all three use an expressive hero and a readable document title", async ({ page }) => {
    await page.setViewportSize({ width: 1137, height: 913 });
    const screenshots = new Set<string>();

    for (const template of TEMPLATES) {
      const sheet = await seed(page, template);
      const pageBox = await sheet.boundingBox();
      expect(pageBox).not.toBeNull();
      if (!pageBox) continue;

      const title = sheet.locator("[data-cv-doc-title]").first();
      await expect(title).toHaveText("Lebenslauf");
      const titleMetrics = await title.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          fontSize: Number.parseFloat(style.fontSize),
          zoom: Number.parseFloat(style.zoom || "1") || 1,
        };
      });
      expect(
        titleMetrics.fontSize * titleMetrics.zoom,
        `${template.id} document title should be clearly readable`,
      ).toBeGreaterThanOrEqual(15);

      const surface = sheet.locator("[data-cv-surface]").first();
      const surfaceBox = await surface.boundingBox();
      expect(surfaceBox).not.toBeNull();
      if (!surfaceBox) continue;
      const surfaceTopMm = ((surfaceBox.y - pageBox.y) / pageBox.width) * 210;
      expect(surfaceTopMm, `${template.id} needs a real hero zone`).toBeGreaterThanOrEqual(
        template.minSurfaceMm,
      );

      const nameBox = await sheet.locator("[data-cv-name]").first().boundingBox();
      expect(nameBox).not.toBeNull();
      if (nameBox) {
        expect(nameBox.y, `${template.id} name belongs in the hero`).toBeLessThan(surfaceBox.y);
        if (template.id === "neon") {
          expect(
            nameBox.y + nameBox.height,
            "neon name must stay fully above the light paper boundary",
          ).toBeLessThanOrEqual(surfaceBox.y - 1);
        }
      }

      const sectionRule = sheet.locator('[data-cv-accent="section"]').first();
      await expect(sectionRule).toBeVisible();
      const ruleGeometry = await sectionRule.evaluate((node) => {
        const row = node.parentElement;
        if (!row) return { rightGap: Number.POSITIVE_INFINITY, width: 0 };
        const rule = node.getBoundingClientRect();
        const headingRow = row.getBoundingClientRect();
        return {
          rightGap: Math.abs(headingRow.right - rule.right),
          width: rule.width,
        };
      });
      expect(
        ruleGeometry.rightGap,
        `${template.id} section rule should reach the row edge`,
      ).toBeLessThanOrEqual(2);
      expect(
        ruleGeometry.width,
        `${template.id} section rule should remain visible`,
      ).toBeGreaterThan(4);

      const shot = await sheet.screenshot({ animations: "disabled" });
      expect(shot.length, `${template.id} should render substantial output`).toBeGreaterThan(8_000);
      screenshots.add(hash(shot));
    }

    expect(screenshots.size).toBe(TEMPLATES.length);
  });

  test("Citrus rubric controls keep safe defaults, persist and match export geometry", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1137, height: 913 });
    await seed(page, TEMPLATES[2]);

    const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    const exportRoot = page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();
    await expect(preview).toBeVisible();

    const defaultPreview = await citrusGeometrySnapshot(preview);
    const defaultExport = await citrusGeometrySnapshot(exportRoot);
    expect(defaultPreview).not.toBeNull();
    expect(defaultExport).not.toBeNull();
    if (!defaultPreview || !defaultExport) return;

    await expect(page.locator('[data-cv-citrus-pill="true"]').first()).toHaveAttribute(
      "data-cv-citrus-content-indent",
      "4",
    );
    expect(defaultPreview.pillBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(defaultPreview.headingOffsetMm).toBeCloseTo(0, 1);
    expect(defaultPreview.contentIndentMm).toBeCloseTo(4, 1);
    expect(defaultPreview.pageCount).toBe(1);
    expect(defaultExport.headingOffsetMm).toBeCloseTo(defaultPreview.headingOffsetMm, 1);
    expect(defaultExport.contentIndentMm).toBeCloseTo(defaultPreview.contentIndentMm, 1);
    expect(defaultExport.ruleRightMm).toBeCloseTo(defaultPreview.ruleRightMm, 1);

    const typographyToggle = page
      .locator("[data-editor-section-toggle]")
      .filter({ hasText: "Schrift und Layout" })
      .first();
    await expect(typographyToggle).toBeVisible();
    await typographyToggle.click();

    const controls = page.locator("[data-citrus-rubric-controls]");
    await expect(controls).toBeVisible();
    await expect(controls.getByText("Rubrik als Pille", { exact: true })).toBeVisible();
    const headingSlider = controls.getByRole("slider", { name: "Rubrik horizontal" });
    const indentSlider = controls.getByRole("slider", { name: "Inhaltseinzug unter Rubrik" });
    await expect(headingSlider).toHaveValue("0");
    await expect(indentSlider).toHaveValue("4");

    await controls.getByRole("button", { name: "Nein" }).click();
    await setRangeValue(headingSlider, 5);
    await setRangeValue(indentSlider, 10);

    await expect.poll(async () =>
      page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") || "{}") as {
          design?: Record<string, unknown>;
        };
        return [
          saved.design?.citrusRubricPill,
          saved.design?.citrusRubricOffsetMm,
          saved.design?.citrusContentIndentMm,
        ];
      }),
    ).toEqual([false, 5, 10]);

    const changedPreview = await citrusGeometrySnapshot(preview);
    const changedExport = await citrusGeometrySnapshot(exportRoot);
    expect(changedPreview).not.toBeNull();
    expect(changedExport).not.toBeNull();
    if (!changedPreview || !changedExport) return;

    expect(changedPreview.pillBackground).toBe("rgba(0, 0, 0, 0)");
    expect(changedPreview.pillPaddingLeft).toBe("0px");
    expect(changedPreview.headingDisplay).not.toBe("none");
    expect(changedPreview.ruleWidthMm).toBeGreaterThan(5);
    expect(changedPreview.headingOffsetMm).toBeCloseTo(5, 1);
    expect(changedPreview.contentIndentMm).toBeCloseTo(10, 1);
    expect(changedPreview.ruleRightMm).toBeGreaterThan(defaultPreview.ruleRightMm);
    expect(changedPreview.ruleRightMm).toBeLessThan(210);
    expect(changedExport.headingOffsetMm).toBeCloseTo(changedPreview.headingOffsetMm, 1);
    expect(changedExport.contentIndentMm).toBeCloseTo(changedPreview.contentIndentMm, 1);
    expect(changedExport.ruleRightMm).toBeCloseTo(changedPreview.ruleRightMm, 1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-cv-citrus-pill="false"]').first()).toHaveAttribute(
      "data-cv-citrus-rubric-x",
      "5",
    );
    const persistedPreview = page
      .locator('[data-dossier-document="cv"][data-export-mode="false"]')
      .first();
    const persisted = await citrusGeometrySnapshot(persistedPreview);
    expect(persisted).not.toBeNull();
    expect(persisted?.headingOffsetMm).toBeCloseTo(5, 1);
    expect(persisted?.contentIndentMm).toBeCloseTo(10, 1);
  });

  test("background motif slider updates decorative layers at 0/25/50/100 only", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1137, height: 913 });
    const motifTemplates: SeedTemplate[] = [
      {
        id: "glow",
        colors: {
          primary: "#2563eb",
          secondary: "#a855f7",
          accent: "#06b6d4",
          ink: "#111827",
          bg: "#ffffff",
        },
      },
      TEMPLATES[0],
      TEMPLATES[2],
    ];

    for (const template of motifTemplates) {
      const sheet = await seed(page, template);
      const slider = await motifSlider(page);
      const motifLayers = sheet.locator("[data-dossier-sheet-motif]");
      expect(await motifLayers.count(), `${template.id} should expose decorative motif layers`).toBeGreaterThan(0);
      const name = sheet.locator("[data-cv-name]").first();
      let zeroShot: Buffer | null = null;

      for (const percent of [0, 25, 50, 100]) {
        await setMotifPercent(slider, percent);
        await expect
          .poll(async () => Number.parseFloat(await motifLayers.first().evaluate((node) => getComputedStyle(node).opacity)))
          .toBeCloseTo(percent / 100, 2);
        await expect(slider).toHaveValue(String(percent));
        expect(await name.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
        if (percent === 0) zeroShot = await sheet.screenshot({ animations: "disabled" });
        if (percent === 100) {
          const fullShot = await sheet.screenshot({ animations: "disabled" });
          expect(zeroShot, `${template.id} should capture its zero-motif state`).not.toBeNull();
          expect(
            hash(fullShot),
            `${template.id} should change visibly between 0% and 100% motif strength`,
          ).not.toBe(hash(zeroShot!));
        }
      }
    }

    const stableSheet = await seed(page, {
      id: "blockig",
      colors: {
        primary: "#334155",
        secondary: "#94a3b8",
        accent: "#0f766e",
        ink: "#111827",
        bg: "#ffffff",
      },
    });
    const stableSlider = await motifSlider(page);
    await setMotifPercent(stableSlider, 0);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    const zeroShot = await stableSheet.screenshot({ animations: "disabled" });
    await setMotifPercent(stableSlider, 100);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    const fullShot = await stableSheet.screenshot({ animations: "disabled" });
    expect(hash(fullShot), "template without a decorative motif should stay visually stable").toBe(
      hash(zeroShot),
    );
  });

  test("persisted recovered typography reaches preview and PDF export canvas identically", async ({
    page,
  }) => {
    await seed(page, TEMPLATES[0]);
    await page.evaluate(() => {
      const key = "lebenslauf:v1";
      const saved = JSON.parse(localStorage.getItem(key) || "{}") as {
        data?: Record<string, unknown> & { customSections?: unknown[]; sectionOrder?: string[] };
        design?: Record<string, unknown>;
      };
      saved.design = {
        ...(saved.design ?? {}),
        headingRule: "full",
        docTitleFontSizePx: 21,
        docTitleColor: "#2457c5",
        docTitleBold: false,
        docTitleItalic: true,
        docTitleUnderline: true,
        docTitleMarginBottomPx: 13,
        sectionTitleFontSizePx: 17,
        sectionTitleColor: "#8a2be2",
        sectionTitleBold: false,
        sectionTitleItalic: true,
        sectionTitleUnderline: true,
        sectionTitleMarginBottomPx: 9,
      };
      saved.data = {
        ...(saved.data ?? {}),
        customSections: [
          {
            id: "projects",
            title: "Projekte",
            entries: [
              {
                id: "project-1",
                zeit: "2026",
                titel: "Schulprojekt",
                ort: "Zürich",
                beschreibung: "Eine kleine Web-App",
              },
            ],
          },
        ],
        sectionOrder: [
          "person",
          "schule",
          "erfahrung",
          "sprachen",
          "hobbys",
          "staerken",
          "referenzen",
          "custom:projects",
        ],
      };
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const cvRoots = page.locator('[data-dossier-document="cv"]');
    await expect(cvRoots).toHaveCount(2);
    const preview = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
    const exportRoot = page
      .locator('[data-dossier-document="cv"][data-export-mode="true"]')
      .first();
    await expect(preview.locator("[data-cv-doc-title]").first()).toHaveText("Lebenslauf");
    await expect(
      preview.locator("[data-cv-page]").getByText("Projekte", { exact: true }).first(),
    ).toBeVisible();

    const previewSnapshot = await typographySnapshot(preview);
    const unmasked = await page.evaluate(() => {
      const mask = document.getElementById("cv-pdf-raster-text-mask") as HTMLStyleElement | null;
      if (!mask) return false;
      mask.disabled = true;
      return true;
    });
    expect(unmasked, "PDF text-layer source must be readable with the raster mask disabled").toBe(
      true,
    );
    const exportSnapshot = await typographySnapshot(exportRoot);
    await page.evaluate(() => {
      const mask = document.getElementById("cv-pdf-raster-text-mask") as HTMLStyleElement | null;
      if (mask) mask.disabled = false;
    });
    expect(previewSnapshot).not.toBeNull();
    expect(exportSnapshot).toEqual(previewSnapshot);
    expect(previewSnapshot).toEqual({
      title: {
        fontSize: "21px",
        color: "rgb(36, 87, 197)",
        fontWeight: "400",
        fontStyle: "italic",
        decoration: "underline",
        marginBottom: "13px",
      },
      rubric: {
        fontSize: "17px",
        color: "rgb(138, 43, 226)",
        fontWeight: "400",
        fontStyle: "italic",
        decoration: "underline",
      },
      ruleColor: "rgb(138, 43, 226)",
    });
  });
});
