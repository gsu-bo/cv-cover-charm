import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";

const cvPayload = {
  version: 6,
  data: {
    titel: "Lebenslauf",
    person: {
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Uniqueweg 42",
      plzOrt: "8000 Zürich",
      telefon: "+41 79 555 44 33",
      email: "chrome-test@example.ch",
      geburtsdatum: "14.03.2010",
      nationalitaet: "Schweiz",
      untertitel: "Schülerin, 3. Sekundarklasse",
      foto: null,
    },
    schule: [],
    erfahrung: [],
    sprachen: [],
    hobbys: [],
    staerken: [],
    referenzen: [],
    labels: {},
    hidden: {},
  },
  design: {
    template: "modern",
    colors: { primary: "#24364b", accent: "#d6a47d", bg: "#ffffff" },
    bgOpacity: 0.25,
    useElements: false,
  },
  elements: [],
};

const sharedChrome = (headerMode: "compact" | "contact" | "none") => ({
  version: 1,
  sync: true,
  shared: {
    headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  },
  cv: {
    headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  },
  letter: {
    headerMode,
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    footerMode: "compact",
  },
});

async function seedCv(page: Page) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cv }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    },
    { cv: cvPayload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first(),
  ).toBeVisible();
}

const previewCv = (page: Page) =>
  page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();

async function openCvChrome(page: Page) {
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const header = page
    .locator("[data-editor-section-toggle]")
    .filter({ hasText: "Header & Footer" })
    .first();
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  const controls = page.locator('[data-dossier-chrome-controls="cv"]');
  await expect(controls).toHaveCount(1);
  await expect(controls).toBeVisible();
  return controls;
}

async function openLetterLayout(page: Page) {
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const layout = page.locator("[data-editor-section-toggle]").filter({ hasText: "Layout" }).first();
  await expect(layout).toBeVisible();
  if ((await layout.getAttribute("aria-expanded")) !== "true") await layout.click();
  await expect(layout).toHaveAttribute("aria-expanded", "true");
  const controls = page.locator('[data-dossier-chrome-controls="letter"]');
  await expect(controls).toHaveCount(1);
  await expect(controls).toBeVisible();
  return controls;
}

test.describe("shared CV / motivation-letter chrome", () => {
  test.setTimeout(120_000);

  test("CV exposes one shared control set and sync-on changes reach the motivation letter", async ({
    page,
  }) => {
    await seedCv(page);

    const controls = await openCvChrome(page);
    await expect(controls.locator("[data-dossier-chrome-sync]")).toBeChecked();

    await controls.locator("[data-cv-header-mode-control]").selectOption("contact-stacked");
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.shared?.headerMode,
          CHROME_KEY,
        ),
      )
      .toBe("contact");
    await expect(previewCv(page).locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
      "data-dossier-header-mode",
      "contact",
    );

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-letter-page]").first()).toHaveAttribute(
      "data-letter-header-mode",
      "contact",
    );
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.shared?.headerMode,
          CHROME_KEY,
        ),
      )
      .toBe("contact");
  });

  test("a stale chrome snapshot nested in the letter cannot roll back the canonical dossier state", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ canonical, stale }) => {
        localStorage.clear();
        localStorage.setItem("bewerbungsdossier:chrome:v1", JSON.stringify(canonical));
        localStorage.setItem(
          "anschreiben:v1",
          JSON.stringify({
            version: 1,
            data: {
              absenderName: "Lea Müller",
              betreff: "Bewerbung Informatik",
              text: "Motivation",
            },
            design: { template: "brief", colors: {}, font: "sans" },
            chrome: stale,
          }),
        );
      },
      { canonical: sharedChrome("contact"), stale: sharedChrome("compact") },
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator("[data-letter-page]").first()).toHaveAttribute(
      "data-letter-header-mode",
      "contact",
    );
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.shared?.headerMode,
          CHROME_KEY,
        ),
      )
      .toBe("contact");
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null")?.chrome),
      )
      .toBeUndefined();
  });

  test("sync uses one dossier contact source, splits cleanly, and rejoins from the active branch", async ({
    page,
  }) => {
    await seedCv(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "anschreiben:v1",
        JSON.stringify({
          version: 1,
          data: {
            absenderName: "Andere Person",
            absenderAdresse: "Briefweg 9",
            absenderPlzOrt: "3000 Bern",
            absenderTelefon: "+41 31 000 00 00",
            absenderEmail: "anderes@example.ch",
            betreff: "Bewerbung Informatik",
            text: "Motivation",
          },
          design: { template: "brief", colors: {}, font: "freundlich" },
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const cv = previewCv(page);
    const controls = await openCvChrome(page);
    await controls.locator("[data-cv-header-mode-control]").selectOption("contact-stacked");
    await expect(cv.locator("[data-dossier-integrated-contact]").first()).toContainText(
      "Lea Müller",
    );
    await expect(cv.locator("[data-dossier-integrated-contact]").first()).not.toContainText(
      "Andere Person",
    );

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const letterHeader = page.locator("[data-dossier-integrated-contact]").first();
    await expect(letterHeader).toContainText("Lea Müller");
    await expect(letterHeader).not.toContainText("Andere Person");

    const letterControls = await openLetterLayout(page);
    await letterControls.locator("[data-dossier-chrome-sync]").uncheck();
    await expect(letterHeader).toContainText("Andere Person");
    await letterControls.locator("[data-letter-header-mode-control]").selectOption("none");

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await expect(previewCv(page).locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
      "data-dossier-header-mode",
      "contact",
    );

    const cvControlsAfterSplit = await openCvChrome(page);
    await cvControlsAfterSplit.locator("[data-dossier-chrome-sync]").check();
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.shared?.headerMode,
          CHROME_KEY,
        ),
      )
      .toBe("contact");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(previewCv(page).locator('[data-dossier-chrome="cv"]').first()).toHaveAttribute(
      "data-dossier-header-mode",
      "contact",
    );
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-dossier-integrated-contact]").first()).toContainText(
      "Lea Müller",
    );
  });

  test("CV contact header owns contact fields exactly once while body identity stays visible", async ({
    page,
  }) => {
    await seedCv(page);
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
      key: CHROME_KEY,
      state: sharedChrome("contact"),
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const cv = previewCv(page);
    const firstPage = cv.locator("[data-cv-page]").first();
    const integrated = firstPage.locator("[data-dossier-integrated-contact]");
    await expect(integrated).toContainText("Lea Müller");
    await expect(integrated).toContainText("Uniqueweg 42");
    await expect(integrated).toContainText("+41 79 555 44 33");
    await expect(integrated).toContainText("chrome-test@example.ch");

    const bodyText = () =>
      firstPage.evaluate((node) =>
        Array.from(node.querySelectorAll<HTMLElement>("[data-cv-main], [data-cv-sidebar]"))
          .map((part) => part.innerText)
          .join("\n"),
      );
    await expect.poll(bodyText).toContain("Lea Müller");
    await expect.poll(bodyText).not.toContain("Uniqueweg 42");
    await expect.poll(bodyText).not.toContain("+41 79 555 44 33");
    await expect.poll(bodyText).not.toContain("chrome-test@example.ch");
    await expect.poll(bodyText).toContain("14.03.2010");
    await expect.poll(bodyText).toContain("Schweiz");

    const controls = await openCvChrome(page);
    await controls.getByLabel("E-Mail integrieren").uncheck();
    await expect(integrated).not.toContainText("chrome-test@example.ch");
    await expect.poll(bodyText).toContain("chrome-test@example.ch");
  });
});
