import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";

const cvPayload = {
  version: 6,
  data: {
    titel: "Lebenslauf",
    person: {
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 000 00 00",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      nationalitaet: "Schweiz",
      untertitel: "hugubugu",
      foto: PHOTO,
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
    template: "brief",
    colors: { primary: "#24364b", accent: "#d6a47d", bg: "#ffffff" },
    bgOpacity: 0.25,
    useElements: false,
  },
  elements: [],
};

async function seed(page: Page) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cv }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem(
        "lebenslauf:photo-place:v1",
        JSON.stringify({ mode: "auto", xMm: 147, yMm: 23, widthMm: 41, frameColor: "#123456" }),
      );
      localStorage.setItem(
        "lebenslauf:photo:v2",
        JSON.stringify({ shape: "square", zoom: 1.15, x: 0.42, y: 0.61, borderWidth: 1.5 }),
      );
      localStorage.setItem(
        "bewerbungsdossier:chrome:v1",
        JSON.stringify({
          version: 1,
          sync: false,
          cv: {
            headerMode: "contact",
            headerShowName: true,
            headerShowAddress: true,
            headerShowPhone: true,
            headerShowEmail: true,
            footerMode: "none",
          },
          letter: { headerMode: "none", footerMode: "none" },
          shared: { headerMode: "none", footerMode: "none" },
        }),
      );
    },
    { cv: cvPayload },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
}

const preview = (page: Page) =>
  page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();

async function setPhotoMode(page: Page, mode: "auto" | "frei") {
  await page.evaluate(async (nextMode) => {
    const module = await import("/src/components/cv/photo-place.ts");
    module.setCvPhotoPlacement({ mode: nextMode });
  }, mode);
}

test.describe("Package 1 CV top-area regression", () => {
  test.setTimeout(60_000);

  test("body identity survives a name-bearing header and Brief/Standard auto photo is top-right", async ({
    page,
  }) => {
    await seed(page);
    const cv = preview(page);
    await expect(cv).toBeVisible();

    const bodyName = cv.locator("[data-cv-name]").first();
    const subtitle = cv.locator("[data-cv-subtitle]").first();
    const header = cv.locator('[data-dossier-chrome="cv"]').first();
    await expect(bodyName).toHaveText("Lea Müller");
    await expect(subtitle).toHaveText("hugubugu");
    await expect(header).toContainText("Lea Müller");

    const photo = cv.locator('[data-cv-page="0"] [data-cv-photo]');
    await expect(photo).toHaveCount(1);
    const [nameBox, photoBox] = await Promise.all([bodyName.boundingBox(), photo.boundingBox()]);
    expect(nameBox).not.toBeNull();
    expect(photoBox).not.toBeNull();
    expect(photoBox!.x).toBeGreaterThan(nameBox!.x);
  });

  test("Auto/Free repeatedly renders one logical photo and preserves its configuration", async ({
    page,
  }) => {
    await seed(page);
    const cv = preview(page);
    const photos = cv.locator('[data-cv-page="0"] [data-cv-photo]');

    for (const mode of ["frei", "auto", "frei", "auto", "frei", "auto"] as const) {
      await setPhotoMode(page, mode);
      await expect(photos).toHaveCount(1);
      if (mode === "frei") await expect(cv.locator("[data-cv-photo-free]")).toHaveCount(1);
      else await expect(cv.locator("[data-cv-photo-free]")).toHaveCount(0);
    }

    const placement = await page.evaluate(async () => {
      const module = await import("/src/components/cv/photo-place.ts");
      return module.getCvPhotoPlacement();
    });
    expect(placement).toMatchObject({
      mode: "auto",
      xMm: 147,
      yMm: 23,
      widthMm: 41,
      frameColor: "#123456",
    });
  });

  test("all supported photo shapes stay single-instance across positioning modes", async ({
    page,
  }) => {
    await seed(page);
    const cv = preview(page);
    const photos = cv.locator('[data-cv-page="0"] [data-cv-photo]');

    for (const shape of ["rect", "square", "portrait", "circle"] as const) {
      await page.evaluate(async (nextShape) => {
        const module = await import("/src/components/cv/photo.ts");
        module.setCvPhotoStyle({ shape: nextShape });
      }, shape);
      await setPhotoMode(page, "frei");
      await expect(photos).toHaveCount(1);
      await setPhotoMode(page, "auto");
      await expect(photos).toHaveCount(1);
    }
  });
});
