import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

const FRESH = [
  {
    id: "edge",
    name: "Edge",
    colors: {
      bg: "#f7f7f4",
      primary: "#182433",
      secondary: "#4da3ff",
      accent: "#2f7de1",
      ink: "#18202a",
    },
  },
  {
    id: "glow",
    name: "Glow",
    colors: {
      bg: "#f7f9ff",
      primary: "#6d5dfb",
      secondary: "#7dd3fc",
      accent: "#14b8a6",
      ink: "#172033",
    },
  },
  {
    id: "frame",
    name: "Frame",
    colors: {
      bg: "#f6f3ed",
      primary: "#26352f",
      secondary: "#d8894a",
      accent: "#b96b32",
      ink: "#1e2722",
    },
  },
  {
    id: "monoLuxe",
    name: "Mono Luxe",
    colors: {
      bg: "#f8f6f1",
      primary: "#171717",
      secondary: "#b08d57",
      accent: "#8e6f42",
      ink: "#171717",
    },
  },
  {
    id: "horizon",
    name: "Horizon",
    colors: {
      bg: "#f6f9ff",
      primary: "#11233f",
      secondary: "#2f6dff",
      accent: "#6fc3ff",
      ink: "#152033",
    },
  },
  {
    id: "sunrise",
    name: "Sunrise",
    colors: {
      bg: "#fff8f2",
      primary: "#ff7a59",
      secondary: "#ffb27a",
      accent: "#f4c76a",
      ink: "#3a2a24",
    },
  },
  {
    id: "forestFlow",
    name: "Forest Flow",
    colors: {
      bg: "#f5f8f4",
      primary: "#1f4d43",
      secondary: "#2e8b7f",
      accent: "#9abf9c",
      ink: "#1d2b27",
    },
  },
  {
    id: "violetPulse",
    name: "Violet Pulse",
    colors: {
      bg: "#faf7ff",
      primary: "#4338ca",
      secondary: "#7c3aed",
      accent: "#d946ef",
      ink: "#1f1733",
    },
  },
  {
    id: "studio2",
    name: "Studio 2",
    colors: {
      bg: "#fbfbf8",
      primary: "#202a3b",
      secondary: "#f2c84b",
      accent: "#e78a2f",
      ink: "#1b2430",
    },
  },
  {
    id: "studio3",
    name: "Studio 3",
    colors: {
      bg: "#f7fbfa",
      primary: "#173d3a",
      secondary: "#5ec6b6",
      accent: "#e2a94b",
      ink: "#18302d",
    },
  },
  {
    id: "warm2",
    name: "Warm 2",
    colors: {
      bg: "#fff7f0",
      primary: "#d95f4c",
      secondary: "#f6b26b",
      accent: "#7f9b76",
      ink: "#3a2521",
    },
  },
  {
    id: "warm3",
    name: "Warm 3",
    colors: {
      bg: "#fbf7ef",
      primary: "#1e6f68",
      secondary: "#e5a84f",
      accent: "#c86648",
      ink: "#24312e",
    },
  },
  {
    id: "warm4",
    name: "Warm 4",
    colors: {
      bg: "#fff8f5",
      primary: "#a84f62",
      secondary: "#e6b89c",
      accent: "#c77a5b",
      ink: "#37272c",
    },
  },
  {
    id: "warm5",
    name: "Warm 5",
    colors: {
      bg: "#fbf8ee",
      primary: "#687454",
      secondary: "#d7aa52",
      accent: "#b8674f",
      ink: "#2b3026",
    },
  },
  {
    id: "verlauf2",
    name: "Verlauf 2",
    colors: {
      bg: "#f5f9ff",
      primary: "#2447b8",
      secondary: "#35b7c8",
      accent: "#9be7e5",
      ink: "#ffffff",
    },
  },
  {
    id: "verlauf3",
    name: "Verlauf 3",
    colors: {
      bg: "#fff8f5",
      primary: "#7b315d",
      secondary: "#e77b52",
      accent: "#f4bb8a",
      ink: "#ffffff",
    },
  },
] as const;

const coverData = {
  meta: { title: "", author: "", subject: "", keywords: "" },
  kicker: "Bewerbung um eine Lehrstelle als",
  eyebrow: "Bewerbungsdossier",
  beruf: "Informatiker/in EFZ",
  lehrbeginn: "August 2027",
  vorname: "Lea",
  nachname: "Müller",
  adresse: "Bahnhofstrasse 42",
  plzOrt: "8000 Zürich",
  telefon: "+41 79 123 45 67",
  email: "lea.mueller@example.ch",
  geburtsdatum: "14.03.2010",
  lehrbetrieb: "Beispiel AG",
  ansprechperson: "Frau Beispiel",
  betriebAdresse: "Musterweg 8, 8000 Zürich",
  ort: "Zürich",
  datum: "22.08.2026",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
};

function coverPayload(template: (typeof FRESH)[number]) {
  return {
    version: 6,
    template: template.id,
    colors: { [template.id]: template.colors },
    layout: { [template.id]: {} },
    customs: [],
    fontScale: 1,
    data: coverData,
  };
}

function cvPayload(template: (typeof FRESH)[number]) {
  return {
    version: 2,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Bahnhofstrasse 42",
        plzOrt: "8000 Zürich",
        telefon: "+41 79 123 45 67",
        email: "lea.mueller@example.ch",
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
      sprachen: [
        { id: "de", name: "Deutsch", niveau: "Muttersprache" },
        { id: "en", name: "Englisch", niveau: "Gute Schulkenntnisse (B1)" },
      ],
      hobbys: ["Volleyball im Verein", "Programmieren kleiner Spiele"],
      staerken: ["Zuverlässig", "Teamfähig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: {
      template: template.id,
      colors: template.colors,
      bgOpacity: 0.06,
      useElements: false,
    },
    elements: [],
  };
}

async function settleCover(page: Page, template: string) {
  const sheet = page
    .locator(`[data-dossier-document="cover"][data-cover-template="${template}"]`)
    .first();
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return sheet;
}

async function settleCv(page: Page, template: string) {
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.dossierTemplate === expected,
    template,
  );
  const sheet = page
    .locator('[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page]')
    .first();
  await sheet.waitFor({ state: "visible" });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return sheet;
}

const hash = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

test.describe("Fresh dossier templates", () => {
  test.setTimeout(240_000);

  test("all live Fresh templates are selectable", async ({ page }) => {
    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    const templateSection = page
      .locator("[data-editor-section-toggle]")
      .filter({ hasText: "Vorlage" })
      .first();
    await expect(templateSection).toBeVisible();
    if ((await templateSection.getAttribute("aria-expanded")) !== "true") {
      await templateSection.click();
    }

    for (const template of FRESH.filter(({ id }) => id !== "warm4" && id !== "warm5")) {
      await expect(page.getByRole("button", { name: template.name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Warm 4", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Warm 5", exact: true })).toHaveCount(0);
  });

  test("all sixteen title pages render as distinct full dossiers", async ({ page }) => {
    await page.setViewportSize({ width: 1137, height: 913 });
    const hashes = new Set<string>();

    for (const template of FRESH) {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ payload }) => {
          localStorage.clear();
          localStorage.setItem("titelblatt:v3", JSON.stringify(payload));
        },
        { payload: coverPayload(template) },
      );
      await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
      const sheet = await settleCover(page, template.id);
      const shot = await sheet.screenshot({ animations: "disabled" });
      expect(shot.length, `${template.name} title page should not be blank`).toBeGreaterThan(8_000);
      hashes.add(hash(shot));
    }

    expect(hashes.size).toBe(FRESH.length);
  });

  test("all sixteen CVs render and stay visually paired with their template", async ({ page }) => {
    await page.setViewportSize({ width: 1137, height: 913 });
    const hashes = new Set<string>();

    for (const template of FRESH) {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ payload }) => {
          localStorage.clear();
          localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
          localStorage.setItem("lebenslauf:layout:v1", "classic");
          localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
        },
        { payload: cvPayload(template) },
      );
      await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
      const sheet = await settleCv(page, template.id);
      const shot = await sheet.screenshot({ animations: "disabled" });
      expect(shot.length, `${template.name} CV should not be blank`).toBeGreaterThan(8_000);
      hashes.add(hash(shot));
    }

    expect(hashes.size).toBe(FRESH.length);
  });
});
