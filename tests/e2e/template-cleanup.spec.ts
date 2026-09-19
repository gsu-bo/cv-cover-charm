import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const CV_KEY = "lebenslauf:v1";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";

type CleanupTemplate =
  | "blockig"
  | "colorful"
  | "orbit"
  | "prism"
  | "frame"
  | "ribbon"
  | "monoLuxe"
  | "glow"
  | "cove"
  | "aurora"
  | "edel";

const FULL_COMPACT_SUPPRESSION = ["orbit", "prism", "frame", "ribbon", "monoLuxe"] as const;

function cvPayload(template: CleanupTemplate) {
  return {
    version: 6,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Bahnhofstrasse 42",
        plzOrt: "8000 Zürich",
        telefon: "+41 79 123 45 67",
        email: "lea@example.ch",
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
      sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Volleyball", "Programmieren"],
      staerken: ["Zuverlässig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: {
      template,
      colors: {
        bg: "#f4f4f2",
        primary: "#1f2937",
        secondary: "#3b82f6",
        tertiary: "#facc15",
        accent: "#f97316",
        ink: "#111111",
      },
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
  };
}

function chromeState(headerMode: "compact" | "contact" | "none") {
  const options = {
    headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  };
  return {
    version: 1,
    sync: true,
    shared: options,
    cv: options,
    letter: options,
  };
}

const previewCv = (page: Page, template: CleanupTemplate) =>
  page
    .locator(
      `[data-dossier-document="cv"][data-cv-template="${template}"][data-export-mode="false"]`,
    )
    .first();

const exportCv = (page: Page, template: CleanupTemplate) =>
  page
    .locator(
      `[data-dossier-document="cv"][data-cv-template="${template}"][data-export-mode="true"]`,
    )
    .first();

async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function seedCv(
  page: Page,
  template: CleanupTemplate,
  headerMode: "compact" | "contact" | "none" = "compact",
) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload, chrome, cvKey, chromeKey }) => {
      localStorage.clear();
      localStorage.setItem(cvKey, JSON.stringify(payload));
      localStorage.setItem(chromeKey, JSON.stringify(chrome));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
      window.location.reload();
    },
    {
      payload: cvPayload(template),
      chrome: chromeState(headerMode),
      cvKey: CV_KEY,
      chromeKey: CHROME_KEY,
    },
  );
  await page.waitForLoadState("domcontentloaded");
  const root = previewCv(page, template);
  await root.locator("[data-cv-page]").first().waitFor({ state: "visible" });
  await expect(root.locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
    "data-dossier-effective-header-mode",
    headerMode,
  );
  await settle(page);
  return root;
}

async function motifOpacities(root: Locator) {
  return root.locator("[data-dossier-sheet-motif]").evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(getComputedStyle(node).opacity)),
  );
}

async function storedMotifOpacity(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.design?.bgOpacity,
    CV_KEY,
  );
}

async function openCvChrome(page: Page) {
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const header = page
    .locator("[data-editor-section-toggle]")
    .filter({ hasText: "Header & Footer" })
    .first();
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  const controls = page.locator('[data-dossier-chrome-controls="cv"]');
  await expect(controls).toBeVisible();
  return controls;
}

async function pseudoStyle(locator: Locator, pseudo: "::before" | "::after") {
  return locator.evaluate((node, target) => {
    const style = getComputedStyle(node, target);
    return {
      display: style.display,
      content: style.content,
      width: Number.parseFloat(style.width) || 0,
      height: Number.parseFloat(style.height) || 0,
      left: style.left,
      right: style.right,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      transform: style.transform,
    };
  }, pseudo);
}

test.describe("template cleanup", () => {
  test.setTimeout(120_000);

  test("Colorful remains available and old drafts stay Colorful", async ({ page }) => {
    await seedCv(page, "colorful");

    await expect(page.locator("html")).toHaveAttribute("data-dossier-template", "colorful");
    await page.getByRole("button", { name: /Vorlage\s+Colorful/ }).click();
    await expect(page.getByRole("button", { name: "Colorful", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Blockig CV keeps only the narrow full-height grey rail from the cleaned background", async ({
    page,
  }) => {
    await seedCv(page, "blockig");
    await expect(page.locator("html")).toHaveAttribute("data-dossier-template", "blockig");

    const geometry = await page
      .locator(
        '[data-dossier-document="cv"][data-cv-template="blockig"][data-export-mode="false"]',
      )
      .first()
      .evaluate((documentRoot) => {
        const pageElement = documentRoot.querySelector<HTMLElement>("[data-cv-page]");
        const background = documentRoot.querySelector<HTMLElement>(
          '[data-dossier-sheet-background="blockig"]',
        );
        if (!pageElement || !background) return null;

        const pageRect = pageElement.getBoundingClientRect();
        const measured = Array.from(background.children)
          .filter((node): node is HTMLElement => node instanceof HTMLElement)
          .map((node) => ({ rect: node.getBoundingClientRect(), style: getComputedStyle(node) }));
        const grey = measured.find(
          ({ rect, style }) =>
            style.backgroundColor === "rgb(31, 41, 55)" &&
            Math.abs(rect.height - pageRect.height) <= 1,
        );
        if (!grey) return null;

        const orangeBackgroundFragments = measured.filter(
          ({ rect, style }) =>
            style.backgroundColor === "rgb(249, 115, 22)" && rect.width > 0 && rect.height > 0,
        ).length;
        const extraGreyFragments = measured.filter(
          ({ rect, style }) =>
            style.backgroundColor === "rgb(31, 41, 55)" &&
            rect.width > 0 &&
            rect.height > 0 &&
            Math.abs(rect.height - pageRect.height) > 1,
        ).length;

        return {
          pageWidth: pageRect.width,
          pageHeight: pageRect.height,
          greyWidth: grey.rect.width,
          greyHeight: grey.rect.height,
          greyColor: grey.style.backgroundColor,
          orangeBackgroundFragments,
          extraGreyFragments,
        };
      });

    expect(geometry).not.toBeNull();
    if (!geometry) return;

    expect(geometry.greyWidth / geometry.pageWidth).toBeCloseTo(19 / 210, 2);
    expect(geometry.greyHeight / geometry.pageHeight).toBeCloseTo(1, 2);
    expect(geometry.greyColor).toBe("rgb(31, 41, 55)");
    expect(geometry.orangeBackgroundFragments).toBe(0);
    expect(geometry.extraGreyFragments).toBe(0);
  });

  test("approved compact templates suppress motif presentation without changing stored opacity", async ({
    page,
  }) => {
    for (const template of FULL_COMPACT_SUPPRESSION) {
      const root = await seedCv(page, template);
      const opacities = await motifOpacities(root);
      expect(opacities.length, `${template} should expose motif wrappers`).toBeGreaterThan(0);
      expect(
        opacities.every((opacity) => opacity === 0),
        `${template} compact motifs should be presentation-suppressed`,
      ).toBe(true);
      expect(await storedMotifOpacity(page), `${template} stored slider value must stay untouched`).toBe(
        0.25,
      );
      await expect(root.locator("[data-cv-page]")).toHaveCount(1);

      const exported = exportCv(page, template);
      const exportOpacities = await motifOpacities(exported);
      expect(exportOpacities.every((opacity) => opacity === 0)).toBe(true);
    }
  });

  test("switching Orbit from compact to contact restores the user's 25% motif immediately", async ({
    page,
  }) => {
    const root = await seedCv(page, "orbit");
    expect((await motifOpacities(root)).every((opacity) => opacity === 0)).toBe(true);
    expect(await storedMotifOpacity(page)).toBe(0.25);

    const controls = await openCvChrome(page);
    await controls.locator("[data-cv-header-mode-control]").selectOption("contact-stacked");
    await expect(root.locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
      "data-dossier-effective-header-mode",
      "contact",
    );
    await expect
      .poll(async () => (await motifOpacities(root))[0])
      .toBeCloseTo(0.25, 2);
    expect((await motifOpacities(root)).every((opacity) => Math.abs(opacity - 0.25) < 0.01)).toBe(
      true,
    );
    expect(await storedMotifOpacity(page)).toBe(0.25);

    const exported = exportCv(page, "orbit");
    expect(
      (await motifOpacities(exported)).every((opacity) => Math.abs(opacity - 0.25) < 0.01),
    ).toBe(true);
  });

  test("Glow, Colorful and Aurora remove only their isolated compact fragments", async ({ page }) => {
    const glow = await seedCv(page, "glow");
    const glowParts = await glow
      .locator('[data-dossier-sheet-background="glow"]')
      .first()
      .evaluate((background) => {
        const motif = background.querySelector<HTMLElement>(":scope > [data-dossier-sheet-motif]");
        if (!motif) return [];
        return Array.from(motif.children)
          .slice(0, 3)
          .map((node) => getComputedStyle(node).display);
      });
    expect(glowParts).toHaveLength(3);
    expect(glowParts[0]).not.toBe("none");
    expect(glowParts[1]).not.toBe("none");
    expect(glowParts[2]).toBe("none");
    expect((await motifOpacities(glow))[0]).toBeCloseTo(0.25, 2);

    const colorful = await seedCv(page, "colorful");
    const colorfulHeader = colorful.locator("[data-cv-header]").first();
    const colorfulCompact = colorful.locator("[data-dossier-compact-header]").first();
    await expect(colorfulCompact).toBeVisible();
    const colorfulDecoration = await pseudoStyle(colorfulHeader, "::after");
    expect(colorfulDecoration.content).toBe("none");
    const colorfulCompactBox = await colorfulCompact.boundingBox();
    expect(colorfulCompactBox).not.toBeNull();
    expect(colorfulCompactBox?.width ?? 0).toBeGreaterThan(100);

    const aurora = await seedCv(page, "aurora");
    const auroraCompact = aurora.locator("[data-dossier-compact-header]").first();
    const auroraStyle = await pseudoStyle(auroraCompact, "::before");
    expect(auroraStyle.display).toBe("none");
    expect(await auroraCompact.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(
      "linear-gradient",
    );
  });

  test("Cove removes only the compact secondary blob and keeps contact decoration", async ({ page }) => {
    const root = await seedCv(page, "cove");
    const compact = root.locator("[data-dossier-compact-header]").first();
    await expect(compact).toBeVisible();
    expect((await pseudoStyle(compact, "::after")).display).toBe("none");
    expect(await compact.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );

    const controls = await openCvChrome(page);
    await controls.locator("[data-cv-header-mode-control]").selectOption("contact-stacked");
    await expect(root.locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
      "data-dossier-effective-header-mode",
      "contact",
    );
    const contact = root.locator("[data-dossier-contact-header-background]").first();
    await expect(contact).toBeVisible();
    const contactDecoration = await pseudoStyle(contact, "::after");
    expect(contactDecoration.display).not.toBe("none");
    expect(contactDecoration.content).not.toBe("none");
    expect(contactDecoration.width).toBeGreaterThan(0);
  });

  test("Edel Light compact gets a full-width top gold treatment and keeps its diamond", async ({
    page,
  }) => {
    const root = await seedCv(page, "edel");
    const compact = root.locator("[data-dossier-compact-header]").first();
    await expect(compact).toBeVisible();

    const geometry = await compact.evaluate((node) => {
      const header = getComputedStyle(node);
      const topGold = getComputedStyle(node, "::before");
      const diamond = getComputedStyle(node, "::after");
      return {
        headerWidth: Number.parseFloat(header.width) || 0,
        goldWidth: Number.parseFloat(topGold.width) || 0,
        goldHeight: Number.parseFloat(topGold.height) || 0,
        goldContent: topGold.content,
        goldLeft: topGold.left,
        goldRight: topGold.right,
        diamondContent: diamond.content,
        diamondWidth: Number.parseFloat(diamond.width) || 0,
        diamondHeight: Number.parseFloat(diamond.height) || 0,
        diamondTransform: diamond.transform,
      };
    });

    expect(geometry.goldContent).not.toBe("none");
    expect(geometry.goldHeight).toBeGreaterThan(0);
    expect(geometry.headerWidth).toBeGreaterThan(0);
    expect(geometry.goldLeft).toBe("0px");
    expect(geometry.goldRight).toBe("0px");
    expect(geometry.goldWidth / geometry.headerWidth).toBeCloseTo(1, 2);
    expect(geometry.diamondContent).not.toBe("none");
    expect(geometry.diamondWidth).toBeGreaterThan(0);
    expect(geometry.diamondHeight).toBeGreaterThan(0);
    expect(geometry.diamondTransform).not.toBe("none");
    await expect(root.locator("[data-cv-page]")).toHaveCount(1);
  });
});
