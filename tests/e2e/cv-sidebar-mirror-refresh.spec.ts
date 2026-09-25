import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const LAYOUT_EVENT = "lebenslauf-layout-change";
const REVIEWED_SIDEBAR_GUTTER_MM = 8;
const GUTTER_TOLERANCE_MM = 0.5;

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

async function applyTimGaussSidebarState(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
    if (!saved) throw new Error("Missing saved demo CV");
    saved.design.template = "terracotta";
    saved.design.sidebarPct = 0.22;
    localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
    localStorage.setItem("lebenslauf:layout:v1", "modern");
    localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
    localStorage.setItem("lebenslauf:info-position:v1", "standard");
    localStorage.setItem(
      "bewerbungsdossier:page-margins:v1",
      JSON.stringify({ cv: { top: 20, right: 30, bottom: 1, left: 78 } }),
    );
  });
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await waitEditorReady(page);
}

async function setMirror(page: Page, position: InfoPosition) {
  await page.evaluate(
    ({ next, eventName }) => {
      localStorage.setItem("lebenslauf:info-position:v1", next);
      localStorage.setItem("lebenslauf:layout-mirror:v1", next === "mirrored" ? "true" : "false");
      window.dispatchEvent(new CustomEvent(eventName));
    },
    { next: position, eventName: LAYOUT_EVENT },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function geometry(page: Page, position: InfoPosition, exportMode = false) {
  const cv = page
    .locator(`[data-dossier-document='cv'][data-export-mode='${exportMode ? "true" : "false"}']`)
    .first();
  await expect(cv).toHaveAttribute("data-cv-template", "terracotta");
  await expect(cv).toHaveAttribute("data-cv-layout", "modern");
  await expect(cv).toHaveAttribute("data-cv-info-position", position);

  const firstPage = cv.locator('[data-cv-page="0"]');
  return firstPage.evaluate((node, mirrored) => {
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
    const pxPerMm = pageRect.width / 210;
    const isMirrored = mirrored === "mirrored";
    const gap = isMirrored ? sidebarRect.left - mainRect.right : mainRect.left - sidebarRect.right;
    const overlap = isMirrored
      ? Math.max(0, mainRect.right - sidebarRect.left)
      : Math.max(0, sidebarRect.right - mainRect.left);

    return {
      gap,
      gapMm: gap / pxPerMm,
      overlap,
      pinned: main.dataset.cvMainGeometryPinned,
      leftPriority: main.style.getPropertyPriority("left"),
      rightPriority: main.style.getPropertyPriority("right"),
      inlineLeft: main.style.getPropertyValue("left"),
      inlineRight: main.style.getPropertyValue("right"),
      computedLeft: getComputedStyle(main).left,
      computedRight: getComputedStyle(main).right,
    };
  }, position);
}

function expectReviewedGeometry(
  value: Awaited<ReturnType<typeof geometry>>,
  position: InfoPosition,
  label: string,
) {
  expect(value, `${label}: sidebar/main must render`).not.toBeNull();
  expect(value?.pinned, `${label}: renderer geometry must be pinned before capture`).toBe("true");
  expect(value?.leftPriority, `${label}: left edge must outrank legacy !important CSS`).toBe(
    "important",
  );
  expect(value?.rightPriority, `${label}: right edge must outrank legacy !important CSS`).toBe(
    "important",
  );
  expect(
    value?.overlap ?? Number.POSITIVE_INFINITY,
    `${label}: sidebar/main overlap: ${JSON.stringify(value)}`,
  ).toBeLessThanOrEqual(2);
  expect(
    value?.gapMm ?? Number.NEGATIVE_INFINITY,
    `${label}: reviewed 8 mm gutter collapsed: ${JSON.stringify(value)}`,
  ).toBeGreaterThanOrEqual(REVIEWED_SIDEBAR_GUTTER_MM - GUTTER_TOLERANCE_MM);

  // Tim-Gauss stores the physical sidebar-side page margin as 78 mm. Mirroring
  // moves that physical inset to the right; it must never degrade to the old
  // 71 mm near-touching state.
  if (position === "standard") {
    expect(value?.inlineLeft, `${label}: standard sidebar-side inset`).toBe("78mm");
  } else {
    expect(value?.inlineRight, `${label}: mirrored sidebar-side inset`).toBe("78mm");
  }
}

test("Kolumne keeps the reviewed gutter before and through mirror yes/no", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await loadDemo(page);
  await applyTimGaussSidebarState(page);

  // Recreate the historic cascade that produced the real screenshot: a stale
  // template rule insists on a 20 mm main origin. Correct geometry must already
  // win before the user touches "gespiegelt" and remain stable afterwards.
  await page.addStyleTag({
    content: `
      html[data-dossier-template] [data-dossier-document="cv"][data-cv-layout="modern"]
        [data-cv-page] > [data-cv-main] {
        left: 20mm !important;
        right: 20mm !important;
      }
    `,
  });

  expectReviewedGeometry(
    await geometry(page, "standard", false),
    "standard",
    "preview before mirror toggle",
  );
  expectReviewedGeometry(
    await geometry(page, "standard", true),
    "standard",
    "export before mirror toggle",
  );

  await setMirror(page, "mirrored");
  expectReviewedGeometry(
    await geometry(page, "mirrored", false),
    "mirrored",
    "preview mirrored yes",
  );
  expectReviewedGeometry(
    await geometry(page, "mirrored", true),
    "mirrored",
    "export mirrored yes",
  );

  await setMirror(page, "standard");
  expectReviewedGeometry(
    await geometry(page, "standard", false),
    "standard",
    "preview mirrored no again",
  );
  expectReviewedGeometry(
    await geometry(page, "standard", true),
    "standard",
    "export mirrored no again",
  );
});
