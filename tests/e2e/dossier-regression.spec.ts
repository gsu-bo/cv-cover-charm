import { expect, test, type Page } from "@playwright/test";
import { readFile, stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const FAMILY_IDS = ["classic", "modern", "executive", "editorial"] as const;
const FAMILY_TEMPLATES = {
  classic: "serioes",
  modern: "modern",
  executive: "pastell",
  editorial: "klassisch",
} as const;
const LAYOUT_IDS = ["classic", "modern", "minimal", "timeline", "editorial"] as const;
const PHOTO_SHAPES = ["rect", "square", "portrait", "circle"] as const;

const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='320' viewBox='0 0 240 320'%3E%3Crect width='240' height='320' fill='%23dbeafe'/%3E%3Ccircle cx='120' cy='110' r='55' fill='%2394a3b8'/%3E%3Crect x='55' y='180' width='130' height='105' rx='42' fill='%2364748b'/%3E%3C/svg%3E";

const previewRoot = (page: Page) =>
  page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();
const exportRoot = (page: Page) =>
  page.locator('[data-dossier-document="cv"][data-export-mode="true"]').first();

function entry(id: string, index: number) {
  return {
    id,
    zeit: `${2026 - index} – ${2027 - index}`,
    titel: `Ausbildung und Praxiserfahrung ${index + 1}`,
    ort: `Beispielbetrieb ${index + 1}, Zürich`,
    beschreibung:
      "Mitarbeit an realistischen Aufgaben, selbstständige Dokumentation und Zusammenarbeit im Team.",
  };
}

function cvData({ long = false, photo = false } = {}) {
  const schoolCount = long ? 13 : 2;
  return {
    person: {
      vorname: long ? "Lea Sophie Alexandra" : "Lea",
      nachname: long ? "Müller-Winterberger-Schneider" : "Müller",
      adresse: "Bahnhofstrasse 42",
      plzOrt: "8000 Zürich",
      telefon: "+41 79 123 45 67",
      email: "lea.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      nationalitaet: "Schweiz",
      untertitel: "Schülerin, 3. Sekundarklasse",
      foto: photo ? PHOTO : null,
    },
    schule: Array.from({ length: schoolCount }, (_, i) => entry(`school-${i}`, i)),
    erfahrung: Array.from({ length: long ? 11 : 2 }, (_, i) => entry(`work-${i}`, i + 2)),
    sprachen: long
      ? []
      : [
          { id: "de", name: "Deutsch", niveau: "Muttersprache" },
          { id: "en", name: "Englisch", niveau: "B1" },
        ],
    hobbys: long ? [] : ["Volleyball", "Programmieren"],
    staerken: long ? [] : ["Zuverlässig", "Teamfähig"],
    referenzen: long
      ? Array.from({ length: 5 }, (_, i) => ({
          id: `ref-${i}`,
          name: `Referenzperson ${i + 1}`,
          funktion: "Klassenlehrperson",
          kontakt: `+41 44 123 45 ${String(i).padStart(2, "0")}`,
        }))
      : [
          {
            id: "ref-1",
            name: "Herr Thomas Weber",
            funktion: "Klassenlehrer",
            kontakt: "+41 44 123 45 67",
          },
        ],
    labels: {},
    hidden: {},
  };
}

function cvPayload(options?: {
  long?: boolean;
  photo?: boolean;
  template?: (typeof FAMILY_TEMPLATES)[keyof typeof FAMILY_TEMPLATES];
}) {
  return {
    version: 2,
    data: cvData(options),
    design: {
      template: options?.template ?? "modern",
      colors: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" },
      bgOpacity: 0.06,
      useElements: false,
    },
    elements: [],
  };
}

type SeedOptions = {
  family?: (typeof FAMILY_IDS)[number];
  layout?: (typeof LAYOUT_IDS)[number];
  mirrored?: boolean;
  long?: boolean;
  photo?: boolean;
  photoShape?: (typeof PHOTO_SHAPES)[number];
  coverRaw?: string;
  legacyPhotoShape?: (typeof PHOTO_SHAPES)[number];
};

async function settlePagination(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function seedCv(page: Page, options: SeedOptions = {}) {
  const family = options.family ?? "classic";
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload, layout, mirrored, photoShape, coverRaw, legacyPhotoShape }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", layout);
      localStorage.setItem("lebenslauf:layout-mirror:v1", mirrored ? "true" : "false");
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
      if (photoShape) {
        localStorage.setItem(
          "lebenslauf:photo:v2",
          JSON.stringify({ shape: photoShape, zoom: 1.6, x: 25, y: 70, borderWidth: 0.4 }),
        );
      }
      if (legacyPhotoShape) {
        localStorage.removeItem("lebenslauf:photo:v2");
        localStorage.setItem("lebenslauf:photo-shape:v1", legacyPhotoShape);
      }
      if (coverRaw) localStorage.setItem("titelblatt:v3", coverRaw);
      window.location.reload();
    },
    {
      payload: cvPayload({
        long: options.long,
        photo: options.photo,
        template: FAMILY_TEMPLATES[family],
      }),
      layout: options.layout ?? "classic",
      mirrored: options.mirrored ?? false,
      photoShape: options.photoShape,
      coverRaw: options.coverRaw,
      legacyPhotoShape: options.legacyPhotoShape,
    },
  );
  await page.waitForLoadState("domcontentloaded");
  const visiblePage = previewRoot(page).locator("[data-cv-page]").filter({ visible: true }).first();
  await visiblePage.waitFor({ state: "visible" });
  await visiblePage.locator("[data-cv-main] [data-cv-entry]").first().waitFor({ state: "visible" });
  await settlePagination(page);
}

async function clippingErrors(page: Page) {
  return previewRoot(page)
    .locator("[data-cv-page]")
    .evaluateAll((pages) => {
      const failures: string[] = [];
      pages.forEach((pageEl, pageIndex) => {
        const main = pageEl.querySelector<HTMLElement>("[data-cv-main]");
        if (!main) {
          failures.push(`page ${pageIndex + 1}: missing main`);
          return;
        }
        const mainRect = main.getBoundingClientRect();
        Array.from(main.children).forEach((child, childIndex) => {
          const rect = (child as HTMLElement).getBoundingClientRect();
          if (rect.bottom > mainRect.bottom + 1.5) {
            failures.push(`page ${pageIndex + 1} row ${childIndex + 1}: bottom clipped`);
          }
          if (rect.left < mainRect.left - 1.5 || rect.right > mainRect.right + 1.5) {
            failures.push(`page ${pageIndex + 1} row ${childIndex + 1}: horizontal overflow`);
          }
        });
      });
      return failures;
    });
}

async function assertNoMainClipping(page: Page, label: string) {
  await expect
    .poll(() => clippingErrors(page), { message: `${label} preview geometry` })
    .toEqual([]);
}

async function seedCoverTemplate(page: Page, template: string) {
  await page.addInitScript(
    ({ selectedTemplate }) => {
      localStorage.clear();
      localStorage.setItem(
        "titelblatt:v3",
        JSON.stringify({
          version: 6,
          template: selectedTemplate,
          colors: {
            [selectedTemplate]: {
              bg: "#faf7f2",
              primary: "#24364b",
              secondary: "#c9895d",
              tertiary: "#d8c3aa",
              accent: "#d6a47d",
              ink: "#1f2937",
            },
          },
          layout: { [selectedTemplate]: {} },
          customs: [],
          fontScale: 1,
          data: {
            meta: { title: "", author: "", subject: "", keywords: "" },
            kicker: "Bewerbung um eine Lehrstelle als",
            eyebrow: "Bewerbung",
            beruf: "Informatiker/in EFZ",
            lehrbeginn: "Lehrbeginn August 2027",
            vorname: "Lea",
            nachname: "Müller",
            adresse: "Bahnhofstrasse 42",
            plzOrt: "8000 Zürich",
            telefon: "+41 79 123 45 67",
            email: "lea.mueller@example.ch",
            geburtsdatum: "14.03.2010",
            lehrbetrieb: "Beispiel AG",
            ansprechperson: "Herr Thomas Weber",
            betriebAdresse: "Industriestrasse 8, 8005 Zürich",
            ort: "Hubersdorf",
            datum: "22.08.2026",
            labelKontakt: "",
            labelEmpfaenger: "",
            foto: null,
          },
        }),
      );
    },
    { selectedTemplate: template },
  );
  await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });

  const sheet = page.locator('[data-dossier-document="cover"]').first();
  await sheet.waitFor({ state: "visible" });
  await sheet.locator('[data-block-id="decor-bottom-field"]').waitFor({ state: "visible" });
  return sheet;
}

function coverPayload() {
  return {
    version: 7,
    template: "modern",
    colors: {
      modern: {
        bg: "#ffffff",
        primary: "#24364b",
        accent: "#d6a47d",
      },
    },
    layout: { modern: {} },
    customs: [],
    fontScale: 1.2,
    font: "sans",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "Lehrbeginn August 2027",
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "Beispiel AG",
      ansprechperson: "Herr Thomas Weber",
      betriebAdresse: "Industriestrasse 8, 4500 Solothurn",
      ort: "Hubersdorf",
      datum: "25.08.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
  };
}

function letterPayload() {
  return {
    version: 1,
    data: {
      absenderName: "Lea Müller",
      absenderAdresse: "Dorfstrasse 12",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "+41 79 123 45 67",
      absenderEmail: "lea.mueller@example.ch",
      empfaengerFirma: "Beispiel AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4500 Solothurn",
      ort: "Hubersdorf",
      datum: "25.08.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
      anrede: "Guten Tag Herr Weber",
      text: "Der Beruf Informatiker/in EFZ interessiert mich sehr. Ich arbeite gerne sorgfältig, lerne Neues und möchte Ihr Team in einer Schnupperlehre kennenlernen.",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
    },
    design: {
      template: "modern",
      colors: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
      font: "sans",
    },
  };
}

async function seedCoreDossier(page: Page, withLetter = false) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cover, cv, letter }) => {
      localStorage.clear();
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      if (letter) localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
    },
    {
      cover: coverPayload(),
      cv: cvPayload({ template: "modern" }),
      letter: withLetter ? letterPayload() : null,
    },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

test.describe("M5.8 dossier regression", () => {
  test.setTimeout(120_000);

  test("Horizont-Farbfläche schliesst ohne weisse Naht bis zum unteren Blattrand", async ({
    page,
  }) => {
    const sheet = await seedCoverTemplate(page, "welle");
    const geometry = await sheet.evaluate((documentElement) => {
      const band = documentElement.querySelector<HTMLElement>(
        '[data-block-id="decor-bottom-field"]',
      );
      const rule = documentElement.querySelector<HTMLElement>(
        '[data-block-id="decor-horizon-rule"]',
      );
      if (!band || !rule) throw new Error("Sichtbarer Horizont-Hintergrund fehlt");

      const sheetRect = documentElement.getBoundingClientRect();
      const bandRect = band.getBoundingClientRect();
      const ruleRect = rule.getBoundingClientRect();
      return {
        sheetRight: sheetRect.right,
        sheetBottom: sheetRect.bottom,
        bandTop: bandRect.top,
        bandRight: bandRect.right,
        bandBottom: bandRect.bottom,
        ruleTop: ruleRect.top,
      };
    });

    expect(Math.abs(geometry.bandTop - geometry.ruleTop)).toBeLessThanOrEqual(0.5);
    expect(geometry.bandRight).toBeGreaterThan(geometry.sheetRight);
    expect(geometry.bandBottom).toBeGreaterThan(geometry.sheetBottom);
  });

  test("all 20 design-style × CV-layout combinations render without clipping", async ({ page }) => {
    for (const family of FAMILY_IDS) {
      for (const layout of LAYOUT_IDS) {
        await seedCv(page, { family, layout });
        await expect(page.locator("html")).toHaveAttribute("data-dossier-family", family);
        await expect(page.locator("html")).toHaveAttribute("data-cv-variant", layout);
        await assertNoMainClipping(page, `${family}/${layout}`);
      }
    }
  });

  test("all five layouts remain valid when mirrored", async ({ page }) => {
    for (const layout of LAYOUT_IDS) {
      await seedCv(page, { family: "executive", layout, mirrored: true, photo: true });
      await expect(page.locator("html")).toHaveAttribute("data-cv-mirrored", "true");
      await expect(
        previewRoot(page).locator("[data-cv-page] [data-cv-photo]").first(),
      ).toBeVisible();
      await assertNoMainClipping(page, `mirrored executive/${layout}`);
    }
  });

  test("Luftig is a spacious Standard flow without a right-floating date rail", async ({
    page,
  }) => {
    const metrics = async () =>
      previewRoot(page)
        .locator('[data-cv-page="0"] [data-cv-main]')
        .evaluate((main) => {
          const section = main.querySelector<HTMLElement>("[data-cv-section]");
          const entry = main.querySelector<HTMLElement>("[data-cv-entry]:has(> [data-cv-rail])");
          const rail = entry?.querySelector<HTMLElement>(":scope > [data-cv-rail]");
          const body = entry
            ? Array.from(entry.children).find((child) => child !== rail)
            : undefined;
          if (!section || !entry || !rail || !(body instanceof HTMLElement)) {
            throw new Error("Expected Standard CV section and dated entry");
          }
          const entryStyle = getComputedStyle(entry);
          const railRect = rail.getBoundingClientRect();
          const bodyRect = body.getBoundingClientRect();
          return {
            sectionMarginTop: Number.parseFloat(getComputedStyle(section).marginTop),
            entryMarginBottom: Number.parseFloat(entryStyle.marginBottom),
            display: entryStyle.display,
            textAlign: entryStyle.textAlign,
            railBeforeBody: railRect.left < bodyRect.left,
          };
        });

    await seedCv(page, { family: "classic", layout: "classic" });
    const standard = await metrics();
    const standardPages = await previewRoot(page).locator("[data-cv-page]").count();

    await seedCv(page, { family: "classic", layout: "minimal" });
    const airy = await metrics();
    const airyPages = await previewRoot(page).locator("[data-cv-page]").count();

    expect(airy.railBeforeBody).toBe(true);
    expect(airy.display).toBe("flex");
    expect(airy.textAlign).not.toBe("right");
    expect(airy.sectionMarginTop).toBeGreaterThan(standard.sectionMarginTop);
    expect(airy.entryMarginBottom).toBeGreaterThan(standard.entryMarginBottom);
    expect(standardPages).toBe(1);
    // Luftig deliberately spends more vertical space than Standard. A moderate
    // fixture may therefore move onto a second page; the real contract is that
    // pagination stays bounded and content never clips.
    expect(airyPages).toBeGreaterThanOrEqual(standardPages);
    expect(airyPages).toBeLessThanOrEqual(2);
    await assertNoMainClipping(page, "Luftig standard-flow fixture");
  });

  test("mirror swaps real Sidebar geometry, persists, and restores without transforms", async ({
    page,
  }) => {
    await seedCv(page, { family: "classic", layout: "modern", photo: true });
    const root = previewRoot(page);
    const geometry = async () =>
      root.locator('[data-cv-page="0"]').evaluate((sheet) => {
        const sidebar = sheet.querySelector<HTMLElement>("[data-cv-sidebar]");
        const main = sheet.querySelector<HTMLElement>("[data-cv-main]");
        if (!sidebar || !main) throw new Error("Sidebar geometry missing");
        const sidebarRect = sidebar.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        return {
          sidebarX: sidebarRect.x,
          mainX: mainRect.x,
          pageTransform: getComputedStyle(sheet).transform,
          sidebarTransform: getComputedStyle(sidebar).transform,
          mainTransform: getComputedStyle(main).transform,
          side: sidebar.dataset.cvSidebarSide,
        };
      });

    const normal = await geometry();
    expect(normal.sidebarX).toBeLessThan(normal.mainX);
    expect(normal.side).toBe("left");

    await page.evaluate(() => {
      localStorage.setItem("lebenslauf:info-position:v1", "mirrored");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "true");
      window.dispatchEvent(new CustomEvent("lebenslauf-layout-change"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-cv-mirrored", "true");

    const mirrored = await geometry();
    expect(mirrored.sidebarX).toBeGreaterThan(mirrored.mainX);
    expect(mirrored.side).toBe("right");
    expect([mirrored.pageTransform, mirrored.sidebarTransform, mirrored.mainTransform]).toEqual([
      "none",
      "none",
      "none",
    ]);
    await assertNoMainClipping(page, "mirrored Sidebar");

    await page.reload({ waitUntil: "domcontentloaded" });
    await root.locator('[data-cv-page="0"]').waitFor({ state: "visible" });
    await expect(page.locator("html")).toHaveAttribute("data-cv-mirrored", "true");
    expect((await geometry()).sidebarX).toBeGreaterThan((await geometry()).mainX);

    await page.evaluate(() => {
      localStorage.setItem("lebenslauf:info-position:v1", "standard");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
      window.dispatchEvent(new CustomEvent("lebenslauf-layout-change"));
    });
    await expect(page.locator("html")).toHaveAttribute("data-cv-mirrored", "false");
    const restored = await geometry();
    expect(restored.sidebarX).toBeLessThan(restored.mainX);
    expect(restored.side).toBe("left");
  });

  test("all four photo shapes preserve shared crop and border treatment", async ({ page }) => {
    const expectedRatio = { rect: 0.75, square: 1, portrait: 1.25, circle: 1 } as const;
    for (const shape of PHOTO_SHAPES) {
      await seedCv(page, { family: "modern", layout: "classic", photo: true, photoShape: shape });
      await expect(page.locator("html")).toHaveAttribute("data-cv-photo-shape", shape);
      const photo = previewRoot(page).locator("[data-cv-page] [data-cv-photo]").first();
      await expect(photo).toBeVisible();
      const box = await photo.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.height ?? 0) / (box?.width ?? 1)).toBeCloseTo(expectedRatio[shape], 1);
      const crop = await photo.locator("img").evaluate((img) => {
        const style = getComputedStyle(img);
        return { width: style.width, left: style.left, top: style.top };
      });
      expect(Number.parseFloat(crop.width)).toBeGreaterThan((box?.width ?? 0) * 1.5);
      expect(Number.parseFloat(crop.left)).toBeLessThan(0);
      expect(Number.parseFloat(crop.top)).toBeLessThan(0);
    }
  });

  test("legacy CV photo-shape preference migrates safely", async ({ page }) => {
    await seedCv(page, { photo: true, legacyPhotoShape: "circle" });
    await expect(page.locator("html")).toHaveAttribute("data-cv-photo-shape", "circle");
    await page.getByRole("button", { name: "Quadrat", exact: true }).click();
    const migrated = await page.evaluate(() => localStorage.getItem("lebenslauf:photo:v2"));
    expect(migrated).not.toBeNull();
    expect(JSON.parse(migrated ?? "{}").shape).toBe("square");
  });

  test("copying and editing the CV photo never mutates title-page storage", async ({ page }) => {
    const cover = JSON.stringify({
      version: 6,
      template: "modern",
      colors: { modern: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" } },
      layout: {
        modern: {
          foto: {
            ratio: 1,
            radius: 999,
            imgZoom: 1.8,
            imgX: 20,
            imgY: 65,
            borderWidth: 0.7,
          },
        },
      },
      customs: [],
      fontScale: 1,
      data: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Bahnhofstrasse 42",
        plzOrt: "8000 Zürich",
        telefon: "+41 79 123 45 67",
        email: "lea@example.ch",
        geburtsdatum: "14.03.2010",
        foto: PHOTO,
      },
    });
    await seedCv(page, { coverRaw: cover });
    expect(await page.evaluate(() => localStorage.getItem("titelblatt:v3"))).toBe(cover);
    await expect(page.locator("html")).toHaveAttribute("data-cv-photo-shape", /.+/);
    await page.getByRole("button", { name: "Vom Titelblatt", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("lebenslauf:photo:v2") ?? "{}").shape),
      )
      .toBe("circle");
    const copied = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("lebenslauf:photo:v2") ?? "{}"),
    );
    expect(copied.zoom).toBe(1.8);
    expect(copied.x).toBe(20);
    expect(copied.y).toBe(65);
    expect(copied.borderWidth).toBe(0.7);
    await expect(previewRoot(page).locator("[data-cv-page] [data-cv-photo]").first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("titelblatt:v3"))).toBe(cover);
    await page.getByRole("button", { name: "Quadrat", exact: true }).click();
    await page.waitForTimeout(500);
    const storage = await page.evaluate(() => ({
      cover: localStorage.getItem("titelblatt:v3"),
      cvPhoto: localStorage.getItem("lebenslauf:photo:v2"),
    }));
    expect(storage.cover).toBe(cover);
    expect(JSON.parse(storage.cvPhoto ?? "{}").shape).toBe("square");
  });

  test("empty saved CV inherits the full title page and can re-sync everything", async ({
    page,
  }) => {
    const cover = coverPayload();
    cover.template = "pastell";
    cover.colors = {
      pastell: { bg: "#fff7ed", primary: "#7c2d12", accent: "#fb923c" },
    };
    cover.font = "serif";
    cover.fontScale = 1.15;

    const emptyStoredCv = cvPayload({ template: "modern" });
    emptyStoredCv.data = {
      person: {
        vorname: "",
        nachname: "",
        adresse: "",
        plzOrt: "",
        telefon: "",
        email: "",
        geburtsdatum: "",
        nationalitaet: "",
        untertitel: "",
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
    };

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ titlePage, cv }) => {
        localStorage.clear();
        localStorage.setItem("titelblatt:v3", JSON.stringify(titlePage));
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      },
      { titlePage: cover, cv: emptyStoredCv },
    );
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });

    const takeAll = page.getByRole("button", { name: "Alles übernehmen" });
    await expect(takeAll).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "{}");
          return {
            template: saved.design?.template,
            font: saved.design?.font,
            vorname: saved.data?.person?.vorname,
          };
        }),
      )
      .toEqual({ template: "pastell", font: "serif", vorname: "Lea" });

    await page.evaluate(() => {
      const titlePage = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "{}");
      titlePage.template = "modern";
      titlePage.colors = {
        ...(titlePage.colors ?? {}),
        modern: { bg: "#ffffff", primary: "#172554", accent: "#38bdf8" },
      };
      titlePage.font = "sans";
      titlePage.data.vorname = "Mia";
      localStorage.setItem("titelblatt:v3", JSON.stringify(titlePage));
    });

    await takeAll.click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "{}");
          return {
            template: saved.design?.template,
            accent: saved.design?.colors?.accent,
            font: saved.design?.font,
            vorname: saved.data?.person?.vorname,
          };
        }),
      )
      .toEqual({ template: "modern", accent: "#38bdf8", font: "sans", vorname: "Mia" });
  });

  test("PDF export downloads a non-empty PDF from the export CV pages only", async ({ page }) => {
    await seedCv(page, { family: "executive", layout: "timeline", long: true, photo: true });
    const preview = previewRoot(page);
    const exported = exportRoot(page);
    await expect.poll(() => preview.locator("[data-cv-page]").count()).toBeGreaterThan(1);
    const previewPages = await preview.locator("[data-cv-page]").count();
    await expect.poll(() => exported.locator("[data-cv-page]").count()).toBe(previewPages);
    expect(await page.locator("[data-cv-measure-page][data-cv-page]").count()).toBe(0);

    await page.getByRole("button", { name: "Download" }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: /Nur Lebenslauf als PDF/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(10_000);
  });

  test("empty saved Motivationsschreiben inherits title-page data and design and can re-sync all", async ({
    page,
  }) => {
    await seedCoreDossier(page);
    await page.evaluate(() => {
      localStorage.setItem(
        "anschreiben:v1",
        JSON.stringify({
          version: 1,
          data: {
            absenderName: "",
            absenderAdresse: "",
            absenderPlzOrt: "",
            absenderTelefon: "",
            absenderEmail: "",
            empfaengerFirma: "",
            empfaengerName: "",
            empfaengerAdresse: "",
            empfaengerPlzOrt: "",
            ort: "",
            datum: "",
            betreff: "",
            anrede: "Guten Tag",
            text: "",
            richTextHtml: "",
            gruss: "Freundliche Grüsse",
            unterschrift: "",
          },
          design: {
            template: "brief",
            colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
            font: "sans",
          },
        }),
      );
    });
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Motivationsschreiben" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}");
          return {
            name: saved.data?.absenderName,
            plzOrt: saved.data?.absenderPlzOrt,
            company: saved.data?.empfaengerFirma,
          };
        }),
      )
      .toEqual({ name: "Lea Müller", plzOrt: "4535 Hubersdorf", company: "Beispiel AG" });
    await expect(page.getByRole("textbox", { name: "Titel / Betreff", exact: true })).toHaveValue(
      "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
    );
    const preview = page.getByLabel("Vorschau Motivationsschreiben");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("data-letter-template", "modern");
    await expect(page.getByRole("button", { name: "Farben", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alles übernehmen", exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}");
          return {
            template: saved.design?.template,
            accent: saved.design?.colors?.accent,
            font: saved.design?.font,
            name: saved.data?.absenderName,
          };
        }),
      )
      .toEqual({ template: "modern", accent: "#d6a47d", font: "sans", name: "Lea Müller" });

    const body = page.getByLabel("Brieftext");
    const preservedBody = "Mein individuell geschriebener Brieftext bleibt erhalten.";
    await body.fill(preservedBody);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}").data?.text ?? "",
        ),
      )
      .toBe(preservedBody);

    await page.evaluate(() => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "{}");
      cover.data.lehrbetrieb = "Neue Beispiel AG";
      cover.data.ansprechperson = "Frau Anna Neu";
      cover.colors.modern.accent = "#38bdf8";
      cover.font = "serif";
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
    });

    await page.getByRole("button", { name: "Alles übernehmen" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}").data?.empfaengerFirma ?? "",
        ),
      )
      .toBe("Neue Beispiel AG");
    await expect(preview).toHaveAttribute("data-letter-font", "serif");
    await expect(body).toHaveText(preservedBody);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}");
          return {
            accent: saved.design?.colors?.accent,
            font: saved.design?.font,
            text: saved.data?.text,
          };
        }),
      )
      .toEqual({ accent: "#38bdf8", font: "serif", text: preservedBody });
  });

  test("standalone Motivationsschreiben PDF downloads as a one-page text PDF", async ({ page }) => {
    await seedCoreDossier(page, true);
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("textbox", { name: "Titel / Betreff", exact: true })).toHaveValue(
      "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
    );

    const downloadToggle = page.getByRole("button", { name: "Download", exact: true });
    await expect(downloadToggle).toHaveAttribute("data-editor-ready", "true");
    await expect(downloadToggle).toHaveAttribute("aria-expanded", "false");
    await downloadToggle.click();
    await expect(downloadToggle).toHaveAttribute("aria-expanded", "true");
    const button = page
      .locator("[data-editor-action-menu] button")
      .filter({ hasText: "Nur Motivationsschreiben als PDF" });
    await expect(button).toBeEnabled();
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^Motivationsschreiben-Lea-(?:Müller|Mueller)-Informatiker-in-EFZ\.pdf$/,
    );
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(5_000);

    const pdfSource = (await readFile(path ?? "")).toString("latin1");
    expect(pdfSource).toContain("Bewerbung um eine Lehrstelle als Informatiker/in EFZ");
    expect(pdfSource).toContain("Guten Tag Herr Weber");
  });

  test("Motivationsschreiben paginates long content and returns to one page after shortening", async ({
    page,
  }) => {
    await seedCoreDossier(page);
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );

    const body = page.getByRole("textbox", { name: "Brieftext" });
    const root = page.locator("main [data-letter-document-root]");
    const pages = root.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", {
      timeout: 20_000,
    });

    await body.fill(
      Array.from(
        { length: 55 },
        (_, index) =>
          `Absatz ${index + 1}: Ich interessiere mich sehr für diesen Beruf und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft zeigen.`,
      ).join("\n\n"),
    );
    await expect.poll(() => pages.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: /Beilagen/ }).click();
    const firstAttachment = page.getByLabel("Beilage 1", { exact: true });
    await expect(firstAttachment).toBeVisible();

    await root.evaluate((element) => {
      const countPages = () =>
        element.querySelectorAll("[data-letter-document-pages] [data-letter-page]").length;
      element.dataset.minimumPreviewPageCount = String(countPages());
      const observer = new MutationObserver(() => {
        const minimum = Number(element.dataset.minimumPreviewPageCount ?? countPages());
        element.dataset.minimumPreviewPageCount = String(Math.min(minimum, countPages()));
      });
      observer.observe(element, { childList: true, subtree: true });
      (
        element as HTMLElement & { __previewStabilityObserver?: MutationObserver }
      ).__previewStabilityObserver = observer;
    });

    await firstAttachment.press("End");
    await firstAttachment.type(" Zusatz");
    await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", {
      timeout: 20_000,
    });
    await expect(root).toHaveAttribute("data-minimum-preview-page-count", /^[2-9]\d*$/);

    await root.evaluate((element) => {
      const stableElement = element as HTMLElement & {
        __previewStabilityObserver?: MutationObserver;
      };
      stableElement.__previewStabilityObserver?.disconnect();
      delete stableElement.__previewStabilityObserver;
    });

    const downloadToggle = page.getByRole("button", { name: "Download", exact: true });
    await downloadToggle.click();
    await expect(
      page.locator("[data-editor-action-menu] button").filter({
        hasText: "Nur Motivationsschreiben als PDF",
      }),
    ).toBeEnabled();

    await body.fill(
      "Ich interessiere mich sehr für die Lehrstelle und freue mich auf ein Gespräch.",
    );
    await expect.poll(() => pages.count(), { timeout: 20_000 }).toBe(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("letter layout controls and Word-like formatting persist", async ({ page }) => {
    await seedCoreDossier(page);
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );
    await page.getByRole("button", { name: "Header & Footer", exact: true }).click();
    await page
      .locator('[data-dossier-chrome-controls="letter"] [data-dossier-header-mode-control]')
      .selectOption("compact");
    await page.getByRole("button", { name: "Layout", exact: true }).click();

    await page.getByRole("button", { name: "Meine Kontaktdaten Rechts" }).click();
    await page.getByRole("button", { name: "Firma / Lehrbetrieb Rechts" }).click();
    await page.getByRole("button", { name: "Ort & Datum Rechts" }).click();
    await page.getByLabel("Trennlinie nach meinen Kontaktdaten").check();
    await page.getByLabel("Trennlinie nach Firma / Lehrbetrieb").check();
    await page.getByLabel("Trennlinie nach Titel / Betreff").check();

    const preview = page.getByLabel("Vorschau Motivationsschreiben");
    await expect(preview.locator('[data-letter-section="sender"]')).toHaveCSS(
      "text-align",
      "right",
    );
    await expect(preview.locator('[data-letter-section="recipient"]')).toHaveCSS(
      "text-align",
      "right",
    );
    await expect(preview.locator('[data-letter-section="date"]')).toHaveCSS("text-align", "right");
    await expect(preview.locator('[data-letter-pdf-rule="sender"]')).toBeVisible();
    await expect(preview.locator('[data-letter-pdf-rule="recipient"]')).toBeVisible();
    await expect(preview.locator('[data-letter-pdf-rule="subject"]')).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Titel / Betreff", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Vorlage", exact: true }).click();
    await expect(page.getByRole("button", { name: "Modern", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Brief", exact: true }).click();
    await expect(preview).toHaveAttribute("data-letter-template", "brief");
    await expect(page.getByRole("button", { name: "Farben", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Editorial", exact: true }).click();
    await expect(preview).toHaveAttribute("data-letter-template", "klassisch");
    await expect(page.getByRole("button", { name: "Farben", exact: true })).toBeVisible();

    const body = page.getByRole("textbox", { name: "Brieftext" });
    await body.evaluate((element) => {
      element.innerHTML = "<div>Absatz eins formatiert</div><div>Absatz zwei bleibt separat</div>";
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    });

    const selectBlock = async (index: number) => {
      await body.evaluate((element, blockIndex) => {
        const block = element.children.item(blockIndex);
        if (!block) throw new Error(`Brieftext-Block ${blockIndex} fehlt`);
        const range = document.createRange();
        range.selectNodeContents(block);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      }, index);
    };

    await selectBlock(0);
    const selectionToolbar = page.locator("[data-letter-selection-toolbar]");
    await expect(selectionToolbar).toBeVisible();
    await selectionToolbar.getByRole("button", { name: "Fett", exact: true }).click();
    await selectionToolbar.getByRole("button", { name: "Kursiv", exact: true }).click();
    await selectionToolbar.getByRole("button", { name: "Unterstrichen", exact: true }).click();
    await selectionToolbar.getByLabel("Schriftfarbe").fill("#c026d3");

    await page.getByRole("button", { name: "Liste" }).click();
    await expect(page.getByRole("button", { name: "Bullet", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Strich", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Plus", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Punkt zentriert", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Kein Zeichen", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Bullet", exact: true }).click();

    await selectBlock(1);
    const toolbar = page.locator("[data-letter-rich-toolbar]");
    const alignmentControl = toolbar.locator("[data-letter-alignment-control]");
    const columnsControl = toolbar.locator("[data-letter-column-control]");
    const insertControl = toolbar.locator("[data-letter-insert-control]");
    const oneColumnButton = columnsControl.getByRole("button", { name: "1 Spalte" });
    const twoColumnButton = columnsControl.getByRole("button", { name: "2 Spalten" });
    await expect(alignmentControl).toBeVisible();
    await expect(columnsControl).toBeVisible();
    await expect(insertControl).toBeVisible();
    await expect(toolbar.locator("[data-letter-alignment-control]")).toHaveCount(1);
    await expect(toolbar.locator("[data-letter-column-control]")).toHaveCount(1);
    await expect(toolbar.locator("[data-letter-insert-control]")).toHaveCount(1);
    await twoColumnButton.click();
    await expect(twoColumnButton).toHaveAttribute("aria-pressed", "true");
    await expect(alignmentControl.locator('button[aria-pressed="true"]')).toHaveCount(0);
    await expect(body.locator(":scope > div").nth(1)).toHaveAttribute("data-align", "left");
    await expect(body.locator(":scope > div").nth(1)).toHaveCSS("text-align", "left");
    await expect(body.locator(":scope > div").nth(1)).toHaveCSS("column-count", "2");
    await expect(body.locator(":scope > div").nth(1)).toHaveCSS("column-rule-style", "none");

    await page.getByRole("button", { name: "Blocksatz" }).click();
    await expect(oneColumnButton).toHaveAttribute("aria-pressed", "true");
    await expect(body.locator(":scope > div").nth(1)).not.toHaveAttribute("data-columns", /.+/);
    await expect(body.locator(":scope > div").nth(1)).toHaveCSS("text-align", "justify");

    await twoColumnButton.click();
    await expect(twoColumnButton).toHaveAttribute("aria-pressed", "true");
    await expect(body.locator(":scope > div").nth(1)).toHaveAttribute("data-align", "left");

    await page.getByRole("button", { name: "Tabelle" }).click();
    await expect(page.getByRole("grid", { name: "Tabellengrösse auswählen" })).toBeVisible();
    await page.getByRole("gridcell", { name: "Tabelle 2 × 3 einfügen" }).focus();
    await expect(page.getByText("2 × 3 Tabelle")).toBeVisible();
    await page.getByRole("gridcell", { name: "Tabelle 2 × 3 einfügen" }).click();

    const previewBody = preview.locator('[data-letter-pdf-richtext="body"]');
    const previewBlocks = previewBody.locator(":scope > div");
    await expect(previewBlocks).toHaveCount(2);
    await expect(previewBlocks.nth(0)).not.toHaveAttribute("data-columns", /.+/);
    await expect(previewBlocks.nth(0)).toHaveAttribute("data-list", "bullet");
    await expect(previewBlocks.nth(1)).toHaveAttribute("data-columns", "2");
    await expect(previewBlocks.nth(1)).toHaveAttribute("data-align", "left");
    await expect(previewBlocks.nth(1)).toHaveCSS("text-align", "left");
    await expect(previewBlocks.nth(1)).toHaveCSS("column-count", "2");
    await expect(previewBlocks.nth(0).locator("strong")).toContainText("Absatz eins formatiert");
    await expect(previewBlocks.nth(0).locator("em")).toContainText("Absatz eins formatiert");
    await expect(previewBlocks.nth(0).locator("u")).toContainText("Absatz eins formatiert");
    const previewColor = previewBlocks.nth(0).locator('[data-letter-text-color="#c026d3"]');
    await expect(previewColor).toContainText("Absatz eins formatiert");
    await expect(previewColor).toHaveCSS("color", "rgb(192, 38, 211)");
    const exportColor = page
      .locator("[data-letter-standalone-export] [data-letter-document-pages]")
      .locator('[data-letter-text-color="#c026d3"]')
      .first();
    await expect(exportColor).toContainText("Absatz eins formatiert");
    await expect(exportColor).toHaveCSS("color", "rgb(192, 38, 211)");
    expect(
      await previewBlocks
        .nth(0)
        .evaluate((element) => getComputedStyle(element, "::before").content),
    ).toContain("•");

    const table = previewBody.locator("table[data-letter-table]");
    await expect(table).toHaveCount(1);
    await expect(table.locator("tr")).toHaveCount(2);
    await expect(table.locator("td")).toHaveCount(6);

    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}")))
      .toMatchObject({
        design: {
          senderAlign: "right",
          recipientAlign: "right",
          dateAlign: "right",
          ruleAfterSender: true,
          ruleAfterRecipient: true,
          ruleAfterSubject: true,
        },
        data: { text: "Absatz eins formatiert\nAbsatz zwei bleibt separat" },
      });

    const readSavedRichText = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}").data?.richTextHtml ?? "",
      );
    await expect.poll(readSavedRichText).toContain('data-columns="2"');
    await expect.poll(readSavedRichText).toContain("<table data-letter-table>");
    const saved = await readSavedRichText();
    expect(saved).toContain("<strong>");
    expect(saved).toContain("<em>");
    expect(saved).toContain("<u>");
    expect(saved).toContain('data-list="bullet"');
    expect(saved).toContain('data-columns="2"');
    expect(saved).toContain("<table data-letter-table>");
    expect(saved).toContain("<td>");
  });

  test("start screen keeps JSON available and unlocks finished dossier formats when complete", async ({
    page,
  }) => {
    await seedCoreDossier(page);

    await expect(page.getByText(/Die JSON-Projektdatei kannst du jederzeit sichern/)).toBeVisible();

    const dossierCard = page.getByRole("button", { name: /Gesamtdossier herunterladen/ });
    await dossierCard.click();
    let dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
    await expect(dialog).toBeVisible();

    const jsonOption = dialog.getByRole("radio", { name: /Projektdatei \(JSON\)/ });
    const pdfOption = dialog.getByRole("radio", { name: /Fertiges Dossier \(PDF\)/ });
    const docxOption = dialog.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
    await expect(jsonOption).toBeEnabled();
    await expect(pdfOption).toBeDisabled();
    await expect(docxOption).toBeDisabled();
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate((letter) => {
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
    }, letterPayload());

    await dossierCard.click();
    dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
    await expect(dialog).toBeVisible();

    const readyPdfOption = dialog.getByRole("radio", { name: /Fertiges Dossier \(PDF\)/ });
    const readyDocxOption = dialog.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
    await expect(readyPdfOption).toBeEnabled();
    await expect(readyDocxOption).toBeEnabled();

    await expect
      .poll(() =>
        page.locator("[data-dossier-document]").evaluateAll((nodes) => {
          const order = nodes
            .map((node) => node.getAttribute("data-dossier-document"))
            .filter((value): value is string => !!value);
          return order.filter((value, index) => order.indexOf(value) === index).slice(0, 3);
        }),
      )
      .toEqual(["cover", "letter", "cv"]);

    await readyPdfOption.click();
    const downloadButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(downloadButton).toBeEnabled({ timeout: 15_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(10_000);

    const pdfSource = (await readFile(path ?? "")).toString("latin1");
    expect(pdfSource).toContain("Bewerbung um eine Lehrstelle als Informatiker/in EFZ");
    expect(pdfSource).toContain("Guten Tag Herr Weber");
  });

  test("editor action menus share order, wording and monochrome icon labels", async ({ page }) => {
    const cases = [
      {
        path: "/titelblatt",
        ownPdf: "Nur Titelblatt als PDF",
        reset: "Titelblatt zurücksetzen",
        positionReset: true,
      },
      {
        path: "/lebenslauf",
        ownPdf: "Nur Lebenslauf als PDF",
        reset: "Lebenslauf zurücksetzen",
        positionReset: true,
      },
      {
        path: "/anschreiben",
        ownPdf: "Nur Motivationsschreiben als PDF",
        reset: "Motivationsschreiben zurücksetzen",
        positionReset: false,
      },
    ] as const;

    for (const item of cases) {
      await page.goto(`${BASE_URL}${item.path}`, { waitUntil: "domcontentloaded" });
      const downloadToggle = page.getByRole("button", { name: "Download", exact: true });
      await expect(downloadToggle).toHaveAttribute("data-editor-ready", "true");
      await expect(downloadToggle).toHaveAttribute("aria-expanded", "false");
      await downloadToggle.click();
      await expect(downloadToggle).toHaveAttribute("aria-expanded", "true");
      let menu = page.locator("[data-editor-action-menu]");
      await expect(menu).toBeVisible();

      await page.getByRole("button", { name: "Beispieldaten übernehmen", exact: true }).click();
      await page.getByRole("button", { name: "Ja", exact: true }).click();
      await expect(downloadToggle).toHaveAttribute("aria-expanded", "false");
      await downloadToggle.click();
      await expect(downloadToggle).toHaveAttribute("aria-expanded", "true");
      menu = page.locator("[data-editor-action-menu]");
      await expect(menu).toBeVisible();

      const labels = await menu.locator("[data-editor-menu-label]").allTextContents();
      expect(labels).toEqual([
        "Ganzes Dossier als PDF",
        item.ownPdf,
        "Dossier speichern",
        "Dossier laden",
        "Beispieldaten übernehmen",
        ...(item.positionReset ? ["Positionen & Grössen zurücksetzen"] : []),
        "Früheren Stand laden",
        item.reset,
      ]);

      const labelNodes = menu.locator("[data-editor-menu-label]");
      await expect(labelNodes.locator("svg")).toHaveCount(await labelNodes.count());
    }
  });

  test("Motivationsschreiben keeps autosave and earlier states in its own pool", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const sentinels = await page.evaluate(() => {
      localStorage.clear();
      const cover = JSON.stringify({
        version: 7,
        data: { vorname: "Cover", nachname: "Pool", beruf: "Informatiker/in EFZ" },
      });
      const cv = JSON.stringify({
        version: 1,
        data: { person: { vorname: "CV", nachname: "Pool" } },
      });
      localStorage.setItem("titelblatt:v3", cover);
      localStorage.setItem("lebenslauf:v1", cv);
      localStorage.setItem(
        "anschreiben:v1",
        JSON.stringify({
          version: 1,
          data: {
            anrede: "Guten Tag",
            gruss: "Freundliche Grüsse",
            betreff: "Aktueller Betreff",
          },
          design: {},
        }),
      );
      localStorage.setItem(
        "anschreiben:history",
        JSON.stringify([
          {
            id: "letter-old",
            at: Date.now() - 60_000,
            label: "Älterer Brief",
            payload: {
              version: 1,
              data: {
                anrede: "Guten Tag",
                gruss: "Freundliche Grüsse",
                betreff: "Alter Betreff",
              },
            },
          },
        ]),
      );
      return { cover, cv };
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const downloadToggle = page.getByRole("button", { name: "Download", exact: true });
    await expect(downloadToggle).toHaveAttribute("data-editor-ready", "true");
    await expect(page.getByRole("textbox", { name: "Titel / Betreff", exact: true })).toHaveValue(
      "Aktueller Betreff",
    );
    await downloadToggle.click();

    const historyButton = page
      .locator("[data-editor-action-menu] button")
      .filter({ hasText: "Früheren Stand laden" });
    await expect(historyButton).toBeEnabled();
    await historyButton.click();
    await page.locator("[data-letter-history-item]").first().click();
    await expect(page.getByRole("textbox", { name: "Titel / Betreff", exact: true })).toHaveValue(
      "Alter Betreff",
    );

    await page.waitForFunction(() => {
      const raw = localStorage.getItem("anschreiben:v1");
      if (!raw) return false;
      return JSON.parse(raw).data?.betreff === "Alter Betreff";
    });
    const pools = await page.evaluate(() => ({
      cover: localStorage.getItem("titelblatt:v3"),
      cv: localStorage.getItem("lebenslauf:v1"),
      letterHistory: JSON.parse(localStorage.getItem("anschreiben:history") ?? "[]"),
      coverHistory: localStorage.getItem("titelblatt:history"),
      cvHistory: localStorage.getItem("lebenslauf:history"),
    }));
    expect(pools.cover).toBe(sentinels.cover);
    expect(pools.cv).toBe(sentinels.cv);
    expect(pools.letterHistory.length).toBeGreaterThanOrEqual(1);
    expect(pools.coverHistory).toBeNull();
    expect(pools.cvHistory).toBeNull();
  });

  test("Titelblatt and Motivationsschreiben expose independent Beilagen controls", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });

    const coverDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(coverDownload).toHaveAttribute("data-editor-ready", "true");

    const emptyCover = page.locator('[data-dossier-document="cover"]').first();
    await expect(emptyCover.locator('[data-block-id="kontaktTitel"]')).toHaveCount(0);
    const emptyAttachments = emptyCover.locator('[data-block-id="beilagen"]');
    await expect(emptyAttachments).toBeVisible();
    const emptyFooterGeometry = await emptyCover.evaluate((cover) => {
      const attachments = cover.querySelector<HTMLElement>('[data-block-id="beilagen"]');
      if (!attachments) throw new Error("Default cover attachments are missing");
      const coverRect = cover.getBoundingClientRect();
      const attachmentsRect = attachments.getBoundingClientRect();
      return { coverBottom: coverRect.bottom, attachmentsBottom: attachmentsRect.bottom };
    });
    expect(emptyFooterGeometry.attachmentsBottom).toBeLessThan(emptyFooterGeometry.coverBottom - 1);

    const companyHeader = page.getByRole("button", { name: /^Firma \/ Lehrbetrieb/ });
    if ((await companyHeader.getAttribute("aria-expanded")) !== "true") await companyHeader.click();
    const companyPanelId = await companyHeader.getAttribute("aria-controls");
    expect(companyPanelId).toBeTruthy();
    const companyPanel = page.locator(`[id="${companyPanelId}"]`);
    const companyToggle = companyPanel.getByLabel("Auf Titelblatt anzeigen");
    await expect(companyToggle).not.toBeChecked();
    await companyPanel.getByLabel("Firma", { exact: true }).fill("Beispiel AG");

    const coverBeilagenHeader = page.getByRole("button", { name: /^Beilagen/ });
    if ((await coverBeilagenHeader.getAttribute("aria-expanded")) !== "true") {
      await coverBeilagenHeader.click();
    }
    const coverBeilagenPanelId = await coverBeilagenHeader.getAttribute("aria-controls");
    expect(coverBeilagenPanelId).toBeTruthy();
    const coverBeilagenPanel = page.locator(`[id="${coverBeilagenPanelId}"]`);
    const coverBeilagenToggle = coverBeilagenPanel.getByLabel("Auf Titelblatt anzeigen");
    await expect(coverBeilagenToggle).toBeChecked();
    await expect(page.locator('[data-block-id="beilagenTitel"]').first()).toContainText("Beilagen");
    await expect(page.locator('[data-block-id="beilagen"]').first()).toContainText(
      "Motivationsschreiben",
    );
    await expect(page.locator('[data-block-id="empfaenger"]')).toHaveCount(0);

    await companyToggle.check();
    await expect(page.locator('[data-block-id="empfaenger"]').first()).toContainText("Beispiel AG");
    await coverBeilagenToggle.uncheck();
    await expect(page.locator('[data-block-id="beilagenTitel"]')).toHaveCount(0);
    await expect(page.locator('[data-block-id="empfaenger"]').first()).toContainText("Beispiel AG");

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.removeItem("anschreiben:v1");
      localStorage.removeItem("anschreiben:history");
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const letterDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(letterDownload).toHaveAttribute("data-editor-ready", "true");
    const letterBeilagenHeader = page.getByRole("button", { name: /^Beilagen/ });
    if ((await letterBeilagenHeader.getAttribute("aria-expanded")) !== "true") {
      await letterBeilagenHeader.click();
    }
    const letterPanelId = await letterBeilagenHeader.getAttribute("aria-controls");
    expect(letterPanelId).toBeTruthy();
    const letterPanel = page.locator(`[id="${letterPanelId}"]`);
    const letterToggle = letterPanel.getByLabel("Im Motivationsschreiben anzeigen");
    await expect(letterToggle).toBeChecked();
    const preview = page.getByLabel("Vorschau Motivationsschreiben");
    await expect(preview.locator('[data-letter-pdf-text="attachments-heading"]')).toHaveText(
      "Beilagen",
    );
    await expect(preview.locator('[data-letter-pdf-text="attachments-body"]')).toContainText(
      "Lebenslauf",
    );
    await expect(preview.locator('[data-letter-pdf-text="attachments-body"]')).toContainText(
      "Zeugnis",
    );

    await letterToggle.uncheck();
    await expect(preview.locator('[data-letter-pdf-text="attachments-heading"]')).toHaveCount(0);
    await expect(page.locator('[data-block-id="beilagenTitel"]')).toHaveCount(0);
  });

  test("all dossier design templates are selectable in all three workspaces", async ({ page }) => {
    const expectedDesigns = 39;

    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    const coverDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(coverDownload).toHaveAttribute("data-editor-ready", "true");
    const coverTemplateHeader = page.getByRole("button", { name: /^Vorlage/ });
    if ((await coverTemplateHeader.getAttribute("aria-expanded")) !== "true")
      await coverTemplateHeader.click();
    const coverPanelId = await coverTemplateHeader.getAttribute("aria-controls");
    const coverPanel = page.locator(`[id="${coverPanelId}"]`);
    await expect(coverPanel.locator("button[aria-pressed]")).toHaveCount(expectedDesigns);
    await coverPanel.getByRole("button", { name: "Brief", exact: true }).click();
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null")?.template,
      ),
    ).toBe("brief");

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    const cvDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(cvDownload).toHaveAttribute("data-editor-ready", "true");
    const cvTemplateHeader = page
      .locator("button[data-editor-section-toggle]")
      .filter({ hasText: "Vorlage" })
      .first();
    if ((await cvTemplateHeader.getAttribute("aria-expanded")) !== "true")
      await cvTemplateHeader.click();
    const cvPanelId = await cvTemplateHeader.getAttribute("aria-controls");
    const cvPanel = page.locator(`[id="${cvPanelId}"]`);
    // 39 design buttons plus the separate CV layout cards.
    await expect(cvPanel.getByRole("button", { name: "Brief", exact: true })).toBeVisible();
    await cvPanel.getByRole("button", { name: "Brief", exact: true }).click();
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null")?.design?.template,
      ),
    ).toBe("brief");

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const letterDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(letterDownload).toHaveAttribute("data-editor-ready", "true");
    const letterTemplateHeader = page.getByRole("button", { name: /^Vorlage/ });
    if ((await letterTemplateHeader.getAttribute("aria-expanded")) !== "true")
      await letterTemplateHeader.click();
    const letterPanelId = await letterTemplateHeader.getAttribute("aria-controls");
    const letterPanel = page.locator(`[id="${letterPanelId}"]`);
    await expect(letterPanel.locator("button[aria-pressed]")).toHaveCount(expectedDesigns);
    await letterPanel.getByRole("button", { name: "Brief", exact: true }).click();
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null")?.design?.template,
      ),
    ).toBe("brief");
  });

  test("document editors expose one consistent overview home link", async ({ page }) => {
    for (const path of ["/titelblatt", "/lebenslauf", "/anschreiben"]) {
      await page.goto(`${BASE_URL}${path}`);
      const header = page.locator("header").first();
      const overview = header.getByRole("link", { name: "Übersicht" });
      await expect(overview).toHaveCount(1);
      await expect(overview).toHaveAttribute("href", "/");
    }

    await page.goto(`${BASE_URL}/titelblatt`);
    await expect(page.locator('header a[href="/lebenslauf"]')).toHaveCount(0);
    await page.goto(`${BASE_URL}/lebenslauf`);
    await expect(page.locator('header a[href="/titelblatt"]')).toHaveCount(0);
  });

  test("card-template sidebar clears the header and stays inside the card", async ({ page }) => {
    await seedCv(page, { layout: "modern" });
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "{}");
      saved.data = { ...saved.data, titel: "Lebenslauf" };
      saved.design = {
        ...saved.design,
        template: "neon",
        colors: { bg: "#09071f", primary: "#7c3aed", accent: "#ec4899" },
      };
      localStorage.setItem("lebenslauf:v1", JSON.stringify(saved));
    });
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await expect(previewRoot(page)).toHaveAttribute("data-cv-template", "neon");

    const sheet = previewRoot(page).locator('[data-cv-page="0"]');
    await sheet.waitFor({ state: "visible" });
    const sidebar = sheet.locator("[data-cv-sidebar]");
    const header = sheet.locator("[data-cv-main] [data-cv-header]").first();
    const main = sheet.locator("[data-cv-main]");
    await expect(sidebar).toBeVisible();
    await expect(header).toBeVisible();

    const geometry = await Promise.all([
      sheet.boundingBox(),
      sidebar.boundingBox(),
      header.boundingBox(),
      main.boundingBox(),
    ]);
    const [sheetBox, sidebarBox, headerBox, mainBox] = geometry;
    expect(sheetBox).not.toBeNull();
    expect(sidebarBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(mainBox).not.toBeNull();

    expect(sidebarBox!.x).toBeGreaterThan(sheetBox!.x + 1);
    expect(sidebarBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1.5);
    expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(mainBox!.x + 1.5);
    await expect(sheet.getByText("Lebenslauf", { exact: true })).toBeVisible();
  });
});
