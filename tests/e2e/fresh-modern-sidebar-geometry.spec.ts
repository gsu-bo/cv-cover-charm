import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const TEMPLATES = ["warm2", "warm3", "prism", "gallery", "orbit", "cove"] as const;

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

async function applyTemplate(page: Page, template: string, sidebarPct: number) {
  // Leave the CV route before mutating its persisted payload. The editor has an
  // intentional autosave loop; changing localStorage while that loop is mounted
  // can race with the current React state and restore the previous template.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ templateId, pct }) => {
      const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      if (!saved) throw new Error("Missing saved demo CV");
      saved.design.template = templateId;
      saved.design.sidebarPct = pct;
      localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
      localStorage.setItem("lebenslauf:layout:v1", "modern");
    },
    { templateId: template, pct: sidebarPct },
  );
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
}

async function sidebarGeometry(page: Page, template: string) {
  const cv = page.locator("main [data-dossier-document='cv']").first();
  await expect(cv).toHaveAttribute("data-cv-template", template);
  await expect(cv).toHaveAttribute("data-cv-layout", "modern");

  return cv.locator('[data-cv-page="0"]').evaluate((pageNode) => {
    const sidebar = Array.from(pageNode.children).find(
      (child) => child instanceof HTMLElement && child.hasAttribute("data-cv-sidebar"),
    ) as HTMLElement | undefined;
    const main = Array.from(pageNode.children).find(
      (child) => child instanceof HTMLElement && child.hasAttribute("data-cv-main"),
    ) as HTMLElement | undefined;
    if (!sidebar || !main) return null;

    const sidebarRect = sidebar.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    const mainStyle = getComputedStyle(main);
    return {
      sidebarRight: sidebarRect.right,
      mainLeft: mainRect.left,
      gap: mainRect.left - sidebarRect.right,
      overlap: Math.max(0, sidebarRect.right - mainRect.left),
      computedLeft: mainStyle.left,
      rendererLeft: mainStyle.getPropertyValue("--cv-modern-main-left").trim(),
      rendererRight: mainStyle.getPropertyValue("--cv-modern-main-right").trim(),
    };
  });
}

test("Fresh Sidebar templates keep their main column clear of the adjustable sidebar", async ({
  page,
}) => {
  test.setTimeout(2 * 60_000);
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await loadDemo(page);

  for (const template of TEMPLATES) {
    await applyTemplate(page, template, 0.3);
    const geometry = await sidebarGeometry(page, template);
    expect(geometry, `${template}: sidebar and main column must render`).not.toBeNull();
    expect(geometry?.rendererLeft, `${template}: renderer left variable`).toBeTruthy();
    expect(geometry?.rendererRight, `${template}: renderer right variable`).toBeTruthy();
    expect(
      geometry?.overlap ?? Number.POSITIVE_INFINITY,
      `${template}: main column overlaps sidebar: ${JSON.stringify(geometry)}`,
    ).toBeLessThanOrEqual(2);
    expect(
      geometry?.gap ?? Number.NEGATIVE_INFINITY,
      `${template}: Sidebar layout should retain a visible gutter`,
    ).toBeGreaterThan(2);
  }

  const geometries = [];
  for (const sidebarPct of [0.22, 0.5]) {
    await applyTemplate(page, "warm2", sidebarPct);
    const geometry = await sidebarGeometry(page, "warm2");
    expect(geometry?.overlap ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2);
    geometries.push(geometry);
  }

  expect(geometries[0]?.rendererLeft).toBe("54mm");
  expect(geometries[1]?.rendererLeft).toBe("113mm");
  expect(
    geometries[1]?.mainLeft ?? Number.NEGATIVE_INFINITY,
    "wider user sidebar must move the main column right in the scaled preview",
  ).toBeGreaterThan((geometries[0]?.mainLeft ?? 0) + 50);
});
