import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const CV_KEY = "lebenslauf:v1";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";

type IdentityTemplate = "prism" | "neon";

const PALETTES: Record<IdentityTemplate, Record<string, string>> = {
  prism: {
    bg: "#f5f7fc",
    primary: "#172554",
    secondary: "#2f66e6",
    accent: "#6f95f2",
    ink: "#18223a",
  },
  neon: {
    bg: "#0d0b2b",
    primary: "#e11d8f",
    secondary: "#7c3aed",
    ink: "#f8fafc",
  },
};

function cvPayload(template: IdentityTemplate) {
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
      erfahrung: [],
      sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Volleyball", "Programmieren"],
      staerken: ["Zuverlässig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: {
      template,
      colors: PALETTES[template],
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
  };
}

function chromeState(headerMode: "compact" | "contact") {
  const options = {
    headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  };
  return { version: 1, sync: true, shared: options, cv: options, letter: options };
}

const previewCv = (page: Page, template: IdentityTemplate) =>
  page
    .locator(
      `[data-dossier-document="cv"][data-cv-template="${template}"][data-export-mode="false"]`,
    )
    .first();

const exportCv = (page: Page, template: IdentityTemplate) =>
  page
    .locator(
      `[data-dossier-document="cv"][data-cv-template="${template}"][data-export-mode="true"]`,
    )
    .first();

async function seed(
  page: Page,
  template: IdentityTemplate,
  headerMode: "compact" | "contact" = "compact",
) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload, chrome }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("bewerbungsdossier:chrome:v1", JSON.stringify(chrome));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
      window.location.reload();
    },
    { payload: cvPayload(template), chrome: chromeState(headerMode) },
  );
  await page.waitForLoadState("domcontentloaded");
  const root = previewCv(page, template);
  await root.locator("[data-cv-page]").first().waitFor({ state: "visible" });
  await expect(root.locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
    "data-dossier-effective-header-mode",
    headerMode,
  );
  return root;
}

async function pseudo(locator: Locator, target: "::before" | "::after") {
  return locator.evaluate((node, pseudoTarget) => {
    const style = getComputedStyle(node, pseudoTarget);
    return {
      content: style.content,
      clipPath: style.clipPath,
      width: Number.parseFloat(style.width) || 0,
      backgroundImage: style.backgroundImage,
    };
  }, target);
}

async function storedOpacity(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.design?.bgOpacity,
    CV_KEY,
  );
}

test.describe("Prism + Neon header identity", () => {
  test.setTimeout(120_000);

  test("Prism compact uses faceted chrome while keeping motif suppression and stored opacity", async ({
    page,
  }) => {
    const root = await seed(page, "prism", "compact");
    const compact = root.locator("[data-dossier-compact-header]").first();
    await expect(compact).toBeVisible();

    const before = await pseudo(compact, "::before");
    const after = await pseudo(compact, "::after");
    expect(before.content).not.toBe("none");
    expect(after.content).not.toBe("none");
    expect(before.clipPath).not.toBe("none");
    expect(after.clipPath).not.toBe("none");
    expect(before.width).toBeGreaterThan(0);
    expect(after.width).toBeGreaterThan(0);

    const motifOpacities = await root.locator("[data-dossier-sheet-motif]").evaluateAll((nodes) =>
      nodes.map((node) => Number.parseFloat(getComputedStyle(node).opacity)),
    );
    expect(motifOpacities.length).toBeGreaterThan(0);
    expect(motifOpacities.every((value) => value === 0)).toBe(true);
    expect(await storedOpacity(page)).toBe(0.25);
    await expect(root.locator("[data-cv-page]")).toHaveCount(1);

    const exported = exportCv(page, "prism");
    const exportedCompact = exported.locator("[data-dossier-compact-header]").first();
    expect((await pseudo(exportedCompact, "::after")).clipPath).not.toBe("none");
  });

  test("Prism contact keeps readable contact data inside the same faceted identity", async ({ page }) => {
    const root = await seed(page, "prism", "contact");
    const background = root.locator("[data-dossier-contact-header-background]").first();
    const contact = root.locator("[data-dossier-integrated-contact]").first();
    await expect(background).toBeVisible();
    await expect(contact).toBeVisible();
    await expect(contact).toContainText("Lea Müller");
    await expect(contact).toContainText("lea@example.ch");
    expect((await pseudo(background, "::before")).clipPath).not.toBe("none");
    expect((await pseudo(background, "::after")).clipPath).not.toBe("none");
    expect(await contact.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 255, 255)");
    expect(await storedOpacity(page)).toBe(0.25);
    await expect(root.locator("[data-cv-page]")).toHaveCount(1);
  });

  test("Neon compact and contact share one gradient identity with light text", async ({ page }) => {
    let root = await seed(page, "neon", "compact");
    const compact = root.locator("[data-dossier-compact-header]").first();
    await expect(compact).toBeVisible();
    const compactBackground = await compact.evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(compactBackground).toContain("linear-gradient");
    expect(compactBackground).toContain("radial-gradient");
    await expect(root.locator("[data-cv-page]")).toHaveCount(1);

    root = await seed(page, "neon", "contact");
    const background = root.locator("[data-dossier-contact-header-background]").first();
    const contact = root.locator("[data-dossier-integrated-contact]").first();
    await expect(background).toBeVisible();
    await expect(contact).toContainText("Lea Müller");
    await expect(contact).toContainText("+41 79 123 45 67");
    const contactBackground = await background.evaluate((node) => getComputedStyle(node).backgroundImage);
    expect(contactBackground).toContain("linear-gradient");
    expect(contactBackground).toContain("radial-gradient");
    expect(await contact.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 255, 255)");
    await expect(root.locator("[data-cv-page]")).toHaveCount(1);

    const exported = exportCv(page, "neon");
    const exportedBackground = exported.locator("[data-dossier-contact-header-background]").first();
    expect(await exportedBackground.evaluate((node) => getComputedStyle(node).backgroundImage)).toContain(
      "linear-gradient",
    );
  });
});
