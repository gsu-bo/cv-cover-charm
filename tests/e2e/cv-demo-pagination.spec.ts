import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const LONG_CONTENT_LAYOUTS = ["classic", "modern", "minimal", "timeline", "editorial"] as const;

function longEntry(id: string, index: number) {
  return {
    id,
    zeit: `${2026 - index} – ${2027 - index}`,
    titel: `Ausbildung und Praxiserfahrung ${index + 1}`,
    ort: `Beispielbetrieb ${index + 1}, Zürich`,
    beschreibung:
      "Mitarbeit an realistischen Aufgaben, selbstständige Dokumentation und Zusammenarbeit im Team.",
  };
}

function longCvPayload() {
  return {
    version: 2,
    data: {
      person: {
        vorname: "Lea Sophie Alexandra",
        nachname: "Müller-Winterberger-Schneider",
        adresse: "Bahnhofstrasse 42",
        plzOrt: "8000 Zürich",
        telefon: "+41 79 123 45 67",
        email: "lea.mueller@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin, 3. Sekundarklasse",
        foto: null,
      },
      schule: Array.from({ length: 13 }, (_, index) => longEntry(`school-${index}`, index)),
      erfahrung: Array.from({ length: 11 }, (_, index) => longEntry(`work-${index}`, index + 2)),
      sprachen: [],
      hobbys: [],
      staerken: [],
      referenzen: Array.from({ length: 5 }, (_, index) => ({
        id: `ref-${index}`,
        name: `Referenzperson ${index + 1}`,
        funktion: "Klassenlehrperson",
        kontakt: `+41 44 123 45 ${String(index).padStart(2, "0")}`,
      })),
      labels: {},
      hidden: {},
    },
    design: {
      template: "klassisch",
      colors: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" },
      bgOpacity: 0.06,
      useElements: false,
    },
    elements: [],
  };
}

async function seedLongCv(page: Page, layout: (typeof LONG_CONTENT_LAYOUTS)[number]) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload, selectedLayout }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", selectedLayout);
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
      localStorage.setItem(
        "lebenslauf:placement:v1",
        JSON.stringify({
          kontakt: "side",
          schule: "main",
          erfahrung: "main",
          sprachen: "side",
          hobbys: "side",
          staerken: "side",
          referenzen: "main",
        }),
      );
    },
    { payload: longCvPayload(), selectedLayout: layout },
  );
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  const root = page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
  await expect(root.locator("[data-cv-page]").first()).toBeVisible({ timeout: 15_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return root;
}

async function longContentClippingErrors(page: Page) {
  return page
    .locator('[data-dossier-document="cv"][data-export-mode="false"]')
    .first()
    .locator("[data-cv-page]")
    .evaluateAll((pages) => {
      const failures: string[] = [];
      pages.forEach((pageElement, pageIndex) => {
        const main = pageElement.querySelector<HTMLElement>("[data-cv-main]");
        if (!main) {
          failures.push(`page ${pageIndex + 1}: missing main`);
          return;
        }
        const mainRect = main.getBoundingClientRect();
        Array.from(main.children).forEach((child, rowIndex) => {
          const rect = (child as HTMLElement).getBoundingClientRect();
          if (rect.bottom > mainRect.bottom + 1.5) {
            failures.push(`page ${pageIndex + 1} row ${rowIndex + 1}: bottom clipped`);
          }
          if (rect.left < mainRect.left - 1.5 || rect.right > mainRect.right + 1.5) {
            failures.push(`page ${pageIndex + 1} row ${rowIndex + 1}: horizontal overflow`);
          }
        });
      });
      return failures;
    });
}

test.describe("M9 demo CV pagination", () => {
  test.setTimeout(6 * 60_000);

  test("every selectable template keeps the family-second demo CV on one unclipped page", async ({
    page,
  }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });

    const download = page.getByRole("button", { name: "Download", exact: true });
    await expect(download).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
    await download.click();
    await page.getByRole("button", { name: "Beispieldaten übernehmen", exact: true }).click();
    await page.getByRole("button", { name: "Ja", exact: true }).click();

    const cv = page.locator("main [data-dossier-document='cv']");
    const pages = cv.locator("[data-cv-page]");
    await expect(cv).toContainText("Herr Thomas Weber");

    const templateSection = page
      .locator("[data-editor-section-toggle]")
      .filter({ hasText: "Vorlage" })
      .first();
    await expect(templateSection).toBeVisible();
    if ((await templateSection.getAttribute("aria-expanded")) !== "true") {
      await templateSection.click();
    }
    const templatePanelId = await templateSection.getAttribute("aria-controls");
    expect(templatePanelId).toBeTruthy();
    const templatePanel = page.locator(`[id="${templatePanelId}"]`);
    const templateButtons = templatePanel.locator("button[title][aria-pressed]");
    await expect(templateButtons).toHaveCount(39);
    const templateCount = await templateButtons.count();
    const unexpectedSpillages: string[] = [];
    const exercisedTemplateIds = new Set<string>();

    for (let index = 0; index < templateCount; index += 1) {
      const button = templateButtons.nth(index);
      const name = (await button.textContent())?.trim() || `template-${index + 1}`;
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");

      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let timer = 0;
            const observer = new MutationObserver(() => {
              window.clearTimeout(timer);
              timer = window.setTimeout(finish, 120);
            });
            const finish = () => {
              observer.disconnect();
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            };

            observer.observe(document.documentElement, {
              subtree: true,
              childList: true,
              attributes: true,
              characterData: true,
            });
            timer = window.setTimeout(finish, 120);
          }),
      );

      const templateId = await cv.getAttribute("data-cv-template");
      expect(templateId, `${name}: selected template must reach the rendered CV`).toBeTruthy();
      exercisedTemplateIds.add(templateId!);

      const ruleGeometry = await pages
        .first()
        .locator('[data-cv-accent="section"]:visible')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const row = node.parentElement;
            if (!row)
              return {
                rightGap: Number.POSITIVE_INFINITY,
                width: 0,
                rule: {},
                row: {},
                before: {},
                after: {},
              };
            const rule = node.getBoundingClientRect();
            const headingRow = row.getBoundingClientRect();
            const ruleStyle = getComputedStyle(node);
            const rowStyle = getComputedStyle(row);
            const before = getComputedStyle(row, "::before");
            const after = getComputedStyle(row, "::after");
            return {
              rightGap: Math.abs(headingRow.right - rule.right),
              width: rule.width,
              rule: {
                display: ruleStyle.display,
                width: ruleStyle.width,
                maxWidth: ruleStyle.maxWidth,
                marginLeft: ruleStyle.marginLeft,
                marginRight: ruleStyle.marginRight,
                flex: ruleStyle.flex,
                transform: ruleStyle.transform,
              },
              row: {
                display: rowStyle.display,
                gap: rowStyle.gap,
                paddingLeft: rowStyle.paddingLeft,
                paddingRight: rowStyle.paddingRight,
                justifyContent: rowStyle.justifyContent,
              },
              before: {
                content: before.content,
                display: before.display,
                width: before.width,
              },
              after: {
                content: after.content,
                display: after.display,
                width: after.width,
              },
            };
          }),
        );
      for (const geometry of ruleGeometry) {
        expect(
          geometry.rightGap,
          `${templateId}: section rule must reach the right edge of its heading row; ${JSON.stringify(geometry)}`,
        ).toBeLessThanOrEqual(2);
        expect(
          geometry.width,
          `${templateId}: section rule must have visible width`,
        ).toBeGreaterThan(4);
      }

      await expect(cv).toContainText("Familie");
      await expect(cv).toContainText("Referenzen");
      await expect(cv).toContainText("Herr Thomas Weber");

      const pageCount = await pages.count();
      if (pageCount !== 1) {
        unexpectedSpillages.push(`${templateId}:${pageCount}:expected-one-page`);
        continue;
      }

      const clippedPages = await pages.locator("[data-cv-main]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        })),
      );
      for (const clipped of clippedPages) {
        expect(
          clipped.scrollHeight,
          `${templateId}: one-page density must not trade pagination for clipped content`,
        ).toBeLessThanOrEqual(clipped.clientHeight + 3);
      }
    }

    expect(
      exercisedTemplateIds.size,
      "runtime template picker must exercise 39 unique CV templates",
    ).toBe(39);
    expect(
      unexpectedSpillages,
      `family-second demo must stay on one page; spillages=${unexpectedSpillages.join(" | ")}`,
    ).toEqual([]);
  });

  test("long names and long content paginate across every layout without clipping", async ({
    page,
  }) => {
    for (const layout of LONG_CONTENT_LAYOUTS) {
      const root = await seedLongCv(page, layout);
      await expect.poll(() => root.locator("[data-cv-page]").count()).toBeGreaterThan(1);
      await expect.poll(() => longContentClippingErrors(page)).toEqual([]);

      const nameBox = await root.locator("[data-cv-page='0'] [data-cv-name]").first().boundingBox();
      const mainBox = await root.locator("[data-cv-page='0'] [data-cv-main]").first().boundingBox();
      expect(nameBox).not.toBeNull();
      expect(mainBox).not.toBeNull();
      expect((nameBox?.x ?? 0) + (nameBox?.width ?? 0)).toBeLessThanOrEqual(
        (mainBox?.x ?? 0) + (mainBox?.width ?? 0) + 1.5,
      );
    }
  });
});
