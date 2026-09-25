import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const SIDEBAR_TEMPLATES = ["terracotta", "warm2", "warm3", "prism", "gallery", "orbit", "cove"] as const;
type InfoPosition = "standard" | "mirrored";

async function waitEditorReady(page: Page) {
  const download = page.getByRole("button", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
  return download;
}

async function loadDemo(page: Page) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  const download = await waitEditorReady(page);
  await download.click();
  await page.getByRole("button", { name: "Beispieldaten übernehmen", exact: true }).click();
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  await expect(download).toHaveAttribute("aria-expanded", "false");
}

async function applyTemplate(
  page: Page,
  template: string,
  sidebarPct: number,
  infoPosition: InfoPosition = "standard",
) {
  // Leave the CV route before mutating its persisted payload. The editor has an
  // intentional autosave loop; changing localStorage while that loop is mounted
  // can race with the current React state and restore the previous template.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ templateId, pct, position }) => {
      const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      if (!saved) throw new Error("Missing saved demo CV");
      saved.design.template = templateId;
      saved.design.sidebarPct = pct;
      localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
      localStorage.setItem("lebenslauf:layout:v1", "modern");
      localStorage.setItem("lebenslauf:info-position:v1", position);
      localStorage.setItem("lebenslauf:layout-mirror:v1", position === "mirrored" ? "true" : "false");
    },
    { templateId: template, pct: sidebarPct, position: infoPosition },
  );
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
}

async function applyCurrentTimGaussMargins(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem(
      "bewerbungsdossier:page-margins:v1",
      JSON.stringify({ cv: { top: 20, right: 30, bottom: 1, left: 78 } }),
    );
  });
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
}

async function makeContentRich(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
    if (!saved) throw new Error("Missing saved demo CV");

    const schoolSeed = saved.data.schule?.[0] ?? {
      id: "school-seed",
      zeit: "2024 – 2026",
      titel: "Sekundarschule",
      ort: "Solothurn",
      beschreibung: "Projektarbeit, Informatik und selbstständiges Lernen.",
    };
    const workSeed = saved.data.erfahrung?.[0] ?? {
      id: "work-seed",
      zeit: "2026",
      titel: "Schnupperlehre",
      ort: "Beispielbetrieb",
      beschreibung: "Mehrere Aufgaben, Rückmeldungen aus dem Team und eigene Dokumentation.",
    };

    saved.data.schule = Array.from({ length: 14 }, (_, index) => ({
      ...schoolSeed,
      id: `sidebar-school-${index}`,
      titel: `SidebarSchoolMarker${index + 1}`,
      beschreibung:
        "Realistischer längerer Schuleintrag mit Informatik, Projektarbeit, selbstständigem Lernen und Dokumentation.",
    }));
    saved.data.erfahrung = Array.from({ length: 12 }, (_, index) => ({
      ...workSeed,
      id: `sidebar-work-${index}`,
      titel: `SidebarWorkMarker${index + 1}`,
      beschreibung:
        "Realistischer längerer Praxiseintrag mit mehreren Aufgaben, Rückmeldungen aus dem Team und eigener Dokumentation.",
    }));
    localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
  });
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
}

async function sidebarGeometry(
  page: Page,
  template: string,
  infoPosition: InfoPosition,
  pageIndex = 0,
  exportMode = false,
) {
  const cv = page
    .locator(`[data-dossier-document='cv'][data-export-mode='${exportMode ? "true" : "false"}']`)
    .first();
  await expect(cv).toHaveAttribute("data-cv-template", template);
  await expect(cv).toHaveAttribute("data-cv-layout", "modern");
  await expect(cv).toHaveAttribute("data-cv-info-position", infoPosition);

  const pageNode = cv.locator(`[data-cv-page="${pageIndex}"]`);
  await expect(pageNode, `${template}: expected CV page ${pageIndex + 1}`).toHaveCount(1);

  return pageNode.evaluate((node, position) => {
    const sidebar = Array.from(node.children).find(
      (child) => child instanceof HTMLElement && child.hasAttribute("data-cv-sidebar"),
    ) as HTMLElement | undefined;
    const main = Array.from(node.children).find(
      (child) => child instanceof HTMLElement && child.hasAttribute("data-cv-main"),
    ) as HTMLElement | undefined;
    if (!sidebar || !main) return null;

    const pageRect = node.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const mainStyle = getComputedStyle(main);
    const mirrored = position === "mirrored";
    const gap = mirrored ? sidebarRect.left - mainRect.right : mainRect.left - sidebarRect.right;
    const overlap = mirrored
      ? Math.max(0, mainRect.right - sidebarRect.left)
      : Math.max(0, sidebarRect.right - mainRect.left);
    const pxPerMm = pageRect.width / 210;
    const contentRects = Array.from(
      main.querySelectorAll<HTMLElement>("[data-cv-header], [data-cv-section], [data-cv-entry]"),
    )
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const contentOverlap = contentRects.reduce((worst, rect) => {
      const candidate = mirrored
        ? Math.max(0, rect.right - sidebarRect.left)
        : Math.max(0, sidebarRect.right - rect.left);
      return Math.max(worst, candidate);
    }, 0);

    return {
      sidebarLeft: sidebarRect.left,
      sidebarRight: sidebarRect.right,
      mainLeft: mainRect.left,
      mainRight: mainRect.right,
      mainLeftMm: (mainRect.left - pageRect.left) / pxPerMm,
      mainRightMm: (pageRect.right - mainRect.right) / pxPerMm,
      sidebarWidthMm: sidebarRect.width / pxPerMm,
      gap,
      gapMm: gap / pxPerMm,
      overlap,
      contentOverlap,
      computedLeft: mainStyle.left,
      computedRight: mainStyle.right,
      rendererLeft: mainStyle.getPropertyValue("--cv-modern-main-left").trim(),
      rendererRight: mainStyle.getPropertyValue("--cv-modern-main-right").trim(),
    };
  }, infoPosition);
}

function expectSidebarClear(
  geometry: Awaited<ReturnType<typeof sidebarGeometry>>,
  label: string,
) {
  expect(geometry, `${label}: sidebar and main column must render`).not.toBeNull();
  expect(geometry?.rendererLeft, `${label}: renderer left variable`).toBeTruthy();
  expect(geometry?.rendererRight, `${label}: renderer right variable`).toBeTruthy();
  expect(
    geometry?.overlap ?? Number.POSITIVE_INFINITY,
    `${label}: main column overlaps sidebar: ${JSON.stringify(geometry)}`,
  ).toBeLessThanOrEqual(2);
  expect(
    geometry?.contentOverlap ?? Number.POSITIVE_INFINITY,
    `${label}: rendered main content crosses into sidebar: ${JSON.stringify(geometry)}`,
  ).toBeLessThanOrEqual(2);
  expect(
    geometry?.gap ?? Number.NEGATIVE_INFINITY,
    `${label}: Sidebar layout should retain a positive gutter: ${JSON.stringify(geometry)}`,
  ).toBeGreaterThan(0);
}

function expectReviewedSidebarGutter(
  geometry: Awaited<ReturnType<typeof sidebarGeometry>>,
  label: string,
) {
  expectSidebarClear(geometry, label);
  expect(
    geometry?.gapMm ?? Number.NEGATIVE_INFINITY,
    `${label}: reviewed Sidebar gutter must stay at least 8 mm: ${JSON.stringify(geometry)}`,
  ).toBeGreaterThanOrEqual(7.5);
}

test.describe("CV sidebar content clearance", () => {
  test.setTimeout(3 * 60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await loadDemo(page);
  });

  test("sidebar-left keeps page 1 main content clear across column templates", async ({ page }) => {
    for (const template of SIDEBAR_TEMPLATES) {
      await applyTemplate(page, template, 0.3, "standard");
      expectSidebarClear(
        await sidebarGeometry(page, template, "standard"),
        `${template} sidebar-left page 1`,
      );
    }
  });

  test("sidebar-right mirrors the same clearance invariant", async ({ page }) => {
    for (const template of ["terracotta", "warm2", "cove"] as const) {
      await applyTemplate(page, template, 0.3, "mirrored");
      expectSidebarClear(
        await sidebarGeometry(page, template, "mirrored"),
        `${template} sidebar-right page 1`,
      );
    }
  });

  test("stale global template CSS cannot reclaim the Sidebar main x-origin", async ({ page }) => {
    await applyTemplate(page, "terracotta", 0.22, "standard");
    const before = await sidebarGeometry(page, "terracotta", "standard");
    expectReviewedSidebarGutter(before, "terracotta before stale global template scope");

    // Reproduce the failure mode behind the real overlap screenshot: the local
    // CV is still Kolumne/terracotta, but a stale global template selector with
    // historic !important main geometry (Gallery uses 20mm) wins the CSS cascade.
    await page.evaluate(() => {
      document.documentElement.dataset.dossierTemplate = "gallery";
    });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );

    const after = await sidebarGeometry(page, "terracotta", "standard");
    expectReviewedSidebarGutter(after, "terracotta with stale gallery global template scope");
    expect(after?.mainLeft).toBeCloseTo(before?.mainLeft ?? 0, 1);
    expect(after?.mainRight).toBeCloseTo(before?.mainRight ?? 0, 1);
  });

  test("current Tim-Gauss page margins preserve the full reviewed sidebar gutter", async ({ page }) => {
    for (const template of ["terracotta", "warm2"] as const) {
      await applyTemplate(page, template, 0.22, "standard");
      await applyCurrentTimGaussMargins(page);
      const before = await sidebarGeometry(page, template, "standard");
      expectReviewedSidebarGutter(before, `${template} current Tim-Gauss margins before refresh`);
      if (template === "terracotta") {
        expect(before?.rendererLeft).toBe("78mm");
        expect(before?.mainLeftMm ?? 0).toBeCloseTo(78, 1);
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitEditorReady(page);
      const after = await sidebarGeometry(page, template, "standard");
      expectReviewedSidebarGutter(after, `${template} current Tim-Gauss margins after refresh`);
      if (template === "terracotta") {
        expect(after?.rendererLeft).toBe("78mm");
        expect(after?.mainLeftMm ?? 0).toBeCloseTo(78, 1);
      }
    }
  });

  test("content-rich Kolumne keeps the full sidebar reservation on page 2+ in preview and export canvas", async ({
    page,
  }) => {
    await applyTemplate(page, "terracotta", 0.22, "standard");
    await applyCurrentTimGaussMargins(page);
    await makeContentRich(page);

    const preview = page.locator(
      "[data-dossier-document='cv'][data-export-mode='false'] [data-cv-page]",
    );
    const exported = page.locator(
      "[data-dossier-document='cv'][data-export-mode='true'] [data-cv-page]",
    );
    expect(await preview.count()).toBeGreaterThan(1);
    expect(await exported.count()).toBeGreaterThan(1);

    for (const pageIndex of [0, 1]) {
      expectReviewedSidebarGutter(
        await sidebarGeometry(page, "terracotta", "standard", pageIndex, false),
        `terracotta preview page ${pageIndex + 1}`,
      );
      expectReviewedSidebarGutter(
        await sidebarGeometry(page, "terracotta", "standard", pageIndex, true),
        `terracotta export page ${pageIndex + 1}`,
      );
    }
  });

  test("hard refresh preserves the same physical sidebar/main geometry", async ({ page }) => {
    await applyTemplate(page, "terracotta", 0.3, "standard");
    expectReviewedSidebarGutter(
      await sidebarGeometry(page, "terracotta", "standard"),
      "terracotta before hard refresh",
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitEditorReady(page);
    expectReviewedSidebarGutter(
      await sidebarGeometry(page, "terracotta", "standard"),
      "terracotta after hard refresh",
    );
  });

  test("non-sidebar classic layout remains a single content column", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:info-position:v1", "standard");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
    });
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await waitEditorReady(page);

    const cv = page.locator("[data-dossier-document='cv'][data-export-mode='false']").first();
    await expect(cv).toHaveAttribute("data-cv-layout", "classic");
    const firstPage = cv.locator('[data-cv-page="0"]');
    await expect(firstPage.locator(":scope > [data-cv-sidebar]")).toHaveCount(0);
    const geometry = await firstPage.evaluate((node) => {
      const main = Array.from(node.children).find(
        (child) => child instanceof HTMLElement && child.hasAttribute("data-cv-main"),
      ) as HTMLElement | undefined;
      if (!main) return null;
      const pageRect = node.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      return {
        leftInset: mainRect.left - pageRect.left,
        rightInset: pageRect.right - mainRect.right,
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry?.leftInset ?? 0).toBeGreaterThan(10);
    expect(geometry?.rightInset ?? 0).toBeGreaterThan(10);
  });

  test("adjustable sidebar width moves the main column and stays clear", async ({ page }) => {
    const geometries = [];
    for (const sidebarPct of [0.22, 0.5]) {
      await applyTemplate(page, "warm2", sidebarPct, "standard");
      const geometry = await sidebarGeometry(page, "warm2", "standard");
      expectReviewedSidebarGutter(geometry, `warm2 ${sidebarPct}`);
      geometries.push(geometry);
    }

    expect(geometries[0]?.rendererLeft).toBe("54mm");
    expect(geometries[1]?.rendererLeft).toBe("113mm");
    expect(
      geometries[1]?.mainLeft ?? Number.NEGATIVE_INFINITY,
      "wider user sidebar must move the main column right in the scaled preview",
    ).toBeGreaterThan((geometries[0]?.mainLeft ?? 0) + 50);
  });
});