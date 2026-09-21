import { expect, test, type Page } from "@playwright/test";
import { DEMO_CV } from "../../src/components/cv/types";

const BASE_URL = "http://127.0.0.1:4173";

const cover = {
  version: 8,
  template: "modern",
  colors: { modern: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" } },
  layout: { modern: {} },
  customs: [],
  fontScale: 1,
  font: "freundlich",
  data: {
    meta: { title: "", author: "", subject: "", keywords: "" },
    kicker: "Bewerbung um eine Lehrstelle als",
    eyebrow: "Bewerbung",
    beruf: "Informatiker/in EFZ",
    lehrbeginn: "August 2027",
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
    showBetriebOnCover: true,
    showBeilagenOnCover: true,
    beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    ort: "Hubersdorf",
    datum: "02.09.2026",
    labelKontakt: "",
    labelEmpfaenger: "",
    foto: null,
  },
};

const cv = {
  version: 6,
  data: DEMO_CV,
  design: {
    template: "modern",
    colors: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
    font: "freundlich",
    bgOpacity: 0.25,
    useElements: false,
  },
  elements: [],
  elementStyles: {},
  coverFingerprint: null,
};

const letter = {
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
    datum: "02.09.2026",
    betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
    anrede: "Guten Tag Herr Weber",
    text: "Die Informatik begeistert mich, weil ich gerne logisch denke und technische Probleme Schritt für Schritt löse. Ich arbeite zuverlässig, lerne schnell und freue mich darauf, den Berufsalltag in Ihrem Unternehmen kennenzulernen.",
    richTextHtml: "",
    gruss: "Freundliche Grüsse",
    unterschrift: "Lea Müller",
    images: [],
    showBeilagen: true,
    beilagen: ["Lebenslauf", "Zeugnis"],
  },
  design: {
    template: "brief",
    colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
    font: "freundlich",
    fontOverride: null,
    headerMode: "compact",
    footerMode: "compact",
  },
};

async function seed(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ coverValue, cvValue, letterValue }) => {
      localStorage.clear();
      localStorage.setItem("titelblatt:v3", JSON.stringify(coverValue));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cvValue));
      localStorage.setItem("anschreiben:v1", JSON.stringify(letterValue));
    },
    { coverValue: cover, cvValue: cv, letterValue: letter },
  );
}

async function expectNoHorizontalAppScroll(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document, `${label}: document must not scroll horizontally`).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
  expect(widths.body, `${label}: body must not scroll horizontally`).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
}

async function expectInsideViewport(page: Page, selector: string, label: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${label}: expected visible box`).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;
  expect(box.x, `${label}: left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width, `${label}: right edge`).toBeLessThanOrEqual(viewport.width + 1);
}

const routes = [
  {
    path: "/titelblatt",
    name: "Titelblatt",
    preview: "main [data-cover-template]",
    mobileToggle: "header button[aria-expanded]",
  },
  {
    path: "/lebenslauf",
    name: "Lebenslauf",
    preview: "main [data-cv-page]",
    mobileToggle: "header button[aria-expanded]",
  },
  {
    path: "/anschreiben",
    name: "Motivationsschreiben",
    preview: "main [data-letter-page]",
    mobileToggle: "header button[aria-pressed]",
  },
] as const;

const viewports = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

test.describe("M9 responsive product smoke", () => {
  test.setTimeout(5 * 60_000);

  for (const viewport of viewports) {
    test(`${viewport.name}: all dossier editors remain usable without app-level horizontal clipping`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seed(page);

      for (const route of routes) {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded" });
        const download = page.locator("button[data-editor-ready='true']").first();
        await expect(download, `${route.name}: editor ready`).toBeVisible({ timeout: 15_000 });
        await expectNoHorizontalAppScroll(page, `${viewport.name}/${route.name}`);

        if (viewport.width < 640) {
          const panel = page.locator("[data-editor-panel] aside");
          await expect(panel).toHaveAttribute("aria-hidden", "false");

          if (route.path === "/lebenslauf") {
            await expect(
              page.locator("[data-cv-content-editor]"),
              "Lebenslauf: content editor must stay visible on mobile",
            ).toBeVisible();
            await expect(
              page.locator('[data-editor-section-title="Persönliche Angaben"]'),
              "Lebenslauf: personal section must stay visible on mobile",
            ).toBeVisible();
            await expect(
              page.locator('[data-editor-section-title="Schule"]'),
              "Lebenslauf: school section must stay visible on mobile",
            ).toBeVisible();
          }

          const toggle = page.locator(route.mobileToggle).first();
          await expect(toggle, `${route.name}: mobile form toggle`).toBeVisible();
          await toggle.click();
          await expect(panel).toHaveAttribute("aria-hidden", "true");
        }

        await expect(page.locator(route.preview).first(), `${route.name}: preview`).toBeVisible();
        await expectInsideViewport(page, route.preview, `${viewport.name}/${route.name}/preview`);

        await download.click();
        const menu = page.locator("[data-editor-action-menu]");
        await expect(menu, `${route.name}: download menu`).toBeVisible();
        await expectInsideViewport(
          page,
          "[data-editor-action-menu]",
          `${viewport.name}/${route.name}/download-menu`,
        );
        await download.click();
        await expect(menu).toHaveCount(0);
      }
    });
  }
});
