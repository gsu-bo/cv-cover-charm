import { expect, test } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

test.describe("M9 demo CV pagination", () => {
  test.setTimeout(6 * 60_000);

  test("every selectable template keeps the family-second demo CV within two unclipped pages", async ({
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

    // Familie is now the canonical second block: personal data first, then family,
    // then the established CV sections such as education.
    const firstPageText = (await pages.first().innerText()).replace(/\s+/g, " ").trim();
    const familyIndex = firstPageText.indexOf("Familie");
    const schoolIndex = firstPageText.indexOf("Schulbildung");
    expect(familyIndex, "family must render on page 1 directly after the personal block").toBeGreaterThanOrEqual(0);
    expect(schoolIndex, "education must render after the family block").toBeGreaterThan(familyIndex);

    // Styling panels also contain reset buttons called "Vorlage". Section.tsx already exposes
    // a stable semantic toggle marker, so target that contract and ignore the adjacent hint text.
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
    // Count the runtime picker itself so shared templates such as Brief cannot drift from this gate.
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

      // Template selection, dossier-theme propagation and pagination do not commit in one
      // React frame. Wait for the document to become mutation-quiet before sampling pages;
      // otherwise this gate can attribute the previous template's pagination to the new one.
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

      // React selection is the source of truth here. Autosave intentionally lags behind the UI,
      // so localStorage must not decide which template the pagination gate is inspecting.
      const templateId = await cv.getAttribute("data-cv-template");
      expect(templateId, `${name}: selected template must reach the rendered CV`).toBeTruthy();
      exercisedTemplateIds.add(templateId!);

      const renderedFirstPageText = (await pages.first().innerText()).replace(/\s+/g, " ").trim();
      const renderedFamilyIndex = renderedFirstPageText.indexOf("Familie");
      const renderedSchoolIndex = renderedFirstPageText.indexOf("Schulbildung");
      expect(renderedFamilyIndex, `${templateId}: family must stay on page 1`).toBeGreaterThanOrEqual(0);
      expect(
        renderedSchoolIndex,
        `${templateId}: education must stay after the family block`,
      ).toBeGreaterThan(renderedFamilyIndex);

      // Some intentionally quiet templates suppress section rules entirely. When a template does
      // render them, they must still consume the remaining heading-row width cleanly; absence is
      // a presentation choice and must not fail this pagination-focused gate.
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

      // With family deliberately moved near the top, later established sections may naturally
      // continue on page 2. The quality contract is therefore completeness + max two pages + no
      // clipping, not that references must remain on page 1.
      await expect(cv).toContainText("Referenzen");
      await expect(cv).toContainText("Herr Thomas Weber");
      await expect(cv).toContainText("Monika Müller");
      await expect(cv).toContainText("Jaro");

      const pageCount = await pages.count();
      if (pageCount > 2) {
        unexpectedSpillages.push(`${templateId}:${pageCount}:more-than-two-pages`);
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
          `${templateId}: compact pagination must not trade page flow for clipped content`,
        ).toBeLessThanOrEqual(clipped.clientHeight + 3);
      }
    }

    expect(
      exercisedTemplateIds.size,
      "runtime template picker must exercise 39 unique CV templates",
    ).toBe(39);
    expect(
      unexpectedSpillages,
      `family-second demo must stay within two unclipped pages; spillages=${unexpectedSpillages.join(" | ")}`,
    ).toEqual([]);
  });
});
