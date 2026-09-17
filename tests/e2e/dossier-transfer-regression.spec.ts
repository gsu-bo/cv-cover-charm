import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160'%3E%3Crect width='120' height='160' fill='%2394a3b8'/%3E%3C/svg%3E";

function cvPayload() {
  return {
    version: 6,
    data: {
      person: {
        vorname: "Mia",
        nachname: "Keller",
        adresse: "Dorfweg 7",
        plzOrt: "4535 Hubersdorf",
        telefon: "+41 79 555 44 33",
        email: "mia.keller@example.ch",
        geburtsdatum: "12.04.2010",
        nationalitaet: "Schweiz",
        untertitel: "Schülerin",
        foto: PHOTO,
      },
      schule: [
        {
          id: "school-existing",
          zeit: "2024 – heute",
          titel: "Bestehende Schule bleibt erhalten",
          ort: "Hubersdorf",
          beschreibung: "Bestehender CV-Inhalt",
        },
      ],
      erfahrung: [],
      sprachen: [],
      hobbys: [],
      staerken: [],
      referenzen: [],
      customSections: [],
      labels: {},
      hidden: {},
    },
    design: {
      template: "modern",
      colors: { bg: "#ffffff", primary: "#172554", accent: "#38bdf8" },
      font: "serif",
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [
      {
        id: "cv-local-image",
        label: "Bild 1",
        text: "",
        kind: "image",
        src: PHOTO,
        page: 1,
      },
    ],
    elementStyles: {},
    coverFingerprint: null,
  };
}

function coverPayload() {
  return {
    version: 8,
    template: "pastell",
    colors: {
      pastell: { bg: "#fff7ed", primary: "#7c2d12", accent: "#fb923c" },
    },
    layout: { pastell: {} },
    customs: [
      {
        id: "cover-free-image",
        label: "Bild 1",
        text: "",
        kind: "image",
        src: PHOTO,
      },
    ],
    fontScale: 1.15,
    font: "sans",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "August 2027",
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Titelweg 4",
      plzOrt: "4500 Solothurn",
      telefon: "+41 79 111 22 33",
      email: "lea.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "Beispiel AG",
      ansprechperson: "Frau Anna Muster",
      betriebAdresse: "Industriestrasse 8, 4500 Solothurn",
      showBetriebOnCover: true,
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnisse"],
      ort: "Hubersdorf",
      datum: "31.08.2026",
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
      absenderName: "Noemi Frei",
      absenderAdresse: "Briefweg 9",
      absenderPlzOrt: "4500 Solothurn",
      absenderTelefon: "+41 78 222 33 44",
      absenderEmail: "noemi.frei@example.ch",
      empfaengerFirma: "LetterWorks AG",
      empfaengerName: "Herr Luca Beispiel",
      empfaengerAdresse: "Werkstrasse 11",
      empfaengerPlzOrt: "4600 Olten",
      ort: "Solothurn",
      datum: "31.08.2026",
      betreff: "Bewerbung um eine Lehrstelle als Mediamatiker/in EFZ",
      anrede: "Guten Tag Herr Beispiel",
      text: "Eigener Brieftext",
      gruss: "Freundliche Grüsse",
      unterschrift: "Noemi Frei",
    },
    design: {
      template: "brief",
      colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
      font: "freundlich",
    },
  };
}

async function openSection(page: Page, name: RegExp) {
  // All three editors publish this marker only after their storage hydration has
  // run. Waiting here keeps transfer tests from clicking SSR controls whose
  // source snapshots are still intentionally empty.
  await page.locator('button[data-editor-ready="true"]').waitFor({ state: "visible" });
  const header = page.getByRole("button", { name });
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  return header.locator("xpath=ancestor::section[1]");
}

test.describe("M7 dossier transfer regression", () => {
  test("Titelblatt combines CV personal data with letter application data", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ cv, letter }) => {
        localStorage.clear();
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
        localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      },
      { cv: cvPayload(), letter: letterPayload() },
    );

    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    const application = await openSection(page, /^Bewerbung/);
    await expect(
      application.getByText("Persönliche Angaben: Lebenslauf", { exact: true }),
    ).toBeVisible();
    await expect(
      application.getByText("Betrieb und Bewerbung: Motivationsschreiben", { exact: true }),
    ).toBeVisible();
    await application.getByRole("button", { name: "Alles übernehmen", exact: true }).click();
    await expect(application.getByRole("status")).toContainText(
      "persönliche Angaben aus Lebenslauf",
    );
    await expect(application.getByLabel("Lehrberuf", { exact: true })).toHaveValue(
      "Mediamatiker/in EFZ",
    );

    const person = await openSection(page, /^Persönliche Angaben/);
    await expect(person.getByLabel("Vorname", { exact: true })).toHaveValue("Mia");
    await expect(person.getByLabel("Nachname", { exact: true })).toHaveValue("Keller");
    await expect(person.getByLabel("Adresse", { exact: true })).toHaveValue("Dorfweg 7");
    await expect(person.getByLabel("PLZ / Ort", { exact: true })).toHaveValue("4535 Hubersdorf");
    await expect(person.getByLabel("E-Mail", { exact: true })).toHaveValue("mia.keller@example.ch");

    const company = await openSection(page, /^Firma \/ Lehrbetrieb/);
    await expect(company.getByLabel("Firma", { exact: true })).toHaveValue("LetterWorks AG");
    await expect(company.getByLabel("Ansprechperson", { exact: true })).toHaveValue(
      "Herr Luca Beispiel",
    );
    await expect(company.getByLabel("Adresse", { exact: true })).toHaveValue(
      "Werkstrasse 11, 4600 Olten",
    );

    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "{}");
          return {
            vorname: saved.data?.vorname,
            nachname: saved.data?.nachname,
            geburtsdatum: saved.data?.geburtsdatum,
            beruf: saved.data?.beruf,
            lehrbetrieb: saved.data?.lehrbetrieb,
            hasPhoto: typeof saved.data?.foto === "string" && saved.data.foto.startsWith("data:"),
          };
        }),
      )
      .toEqual({
        vorname: "Mia",
        nachname: "Keller",
        geburtsdatum: "12.04.2010",
        beruf: "Mediamatiker/in EFZ",
        lehrbetrieb: "LetterWorks AG",
        hasPhoto: true,
      });
  });

  test("Titelblatt falls back to letter personal data when no CV exists", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate((letter) => {
      localStorage.clear();
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
    }, letterPayload());

    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    const application = await openSection(page, /^Bewerbung/);
    await expect(
      application.getByText("Persönliche Angaben: Motivationsschreiben", { exact: true }),
    ).toBeVisible();
    await application.getByRole("button", { name: "Alles übernehmen", exact: true }).click();

    const person = await openSection(page, /^Persönliche Angaben/);
    await expect(person.getByLabel("Vorname", { exact: true })).toHaveValue("Noemi");
    await expect(person.getByLabel("Nachname", { exact: true })).toHaveValue("Frei");
    await expect(person.getByLabel("Adresse", { exact: true })).toHaveValue("Briefweg 9");
    await expect(person.getByLabel("E-Mail", { exact: true })).toHaveValue("noemi.frei@example.ch");
  });

  test("Lebenslauf uses one dossier takeover and preserves CV-only content", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ cover, cv }) => {
        localStorage.clear();
        localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      },
      { cover: coverPayload(), cv: cvPayload() },
    );
    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    await expect
      .poll(() =>
        page.evaluate(() => JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null")?.template),
      )
      .toBe("pastell");

    const takeover = await openSection(page, /^Vom Dossier übernehmen/);
    const takeAll = takeover.getByRole("button", { name: "Alles übernehmen", exact: true });
    await expect(takeAll).toBeVisible();
    await expect(takeAll).toBeEnabled();
    await expect(takeover.getByText("Auswahl anpassen", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Angaben vom Titelblatt holen" })).toHaveCount(0);

    await takeAll.click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "{}");
          return {
            template: saved.design?.template,
            font: saved.design?.font,
            vorname: saved.data?.person?.vorname,
            school: saved.data?.schule?.[0]?.titel,
            elementIds: saved.elements?.map((element: { id?: string }) => element.id),
          };
        }),
      )
      .toEqual({
        template: "pastell",
        font: "sans",
        vorname: "Lea",
        school: "Bestehende Schule bleibt erhalten",
        elementIds: ["cv-local-image"],
      });
  });

  test("Motivationsschreiben falls back to CV data and keeps its own brief text", async ({
    page,
  }) => {
    const letter = {
      version: 1,
      data: {
        absenderName: "Alter Name",
        text: "Mein eigener Brieftext bleibt erhalten.",
        anrede: "Guten Tag",
        gruss: "Freundliche Grüsse",
      },
      design: {
        template: "brief",
        colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
        font: "sans",
      },
    };
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ cv, letterSave }) => {
        localStorage.clear();
        localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
        localStorage.setItem("anschreiben:v1", JSON.stringify(letterSave));
      },
      { cv: cvPayload(), letterSave: letter },
    );
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null")?.data?.person?.vorname,
        ),
      )
      .toBe("Mia");

    const takeover = await openSection(page, /^Vom Dossier übernehmen/);
    await expect(
      takeover.getByText("Persönliche Angaben: Lebenslauf", { exact: true }),
    ).toBeVisible();
    await expect(
      takeover.getByText("Betrieb und Bewerbung: noch nicht verfügbar", { exact: true }),
    ).toBeVisible();
    await expect(takeover.getByText("Design: Lebenslauf", { exact: true })).toBeVisible();

    const body = page.getByLabel("Brieftext");
    await expect(body).toHaveText("Mein eigener Brieftext bleibt erhalten.");
    await takeover.getByRole("button", { name: "Alles übernehmen", exact: true }).click();

    const personal = await openSection(page, /^Meine Kontaktdaten/);
    await expect(personal.getByLabel("Vorname und Nachname")).toHaveValue("Mia Keller");
    await expect(body).toHaveText("Mein eigener Brieftext bleibt erhalten.");
    await expect(page.getByLabel("Vorschau Motivationsschreiben")).toHaveAttribute(
      "data-letter-template",
      "modern",
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}");
          return {
            name: saved.data?.absenderName,
            text: saved.data?.text,
            template: saved.design?.template,
            font: saved.design?.font,
          };
        }),
      )
      .toEqual({
        name: "Mia Keller",
        text: "Mein eigener Brieftext bleibt erhalten.",
        template: "modern",
        font: "serif",
      });
  });

  test("Anschreiben wraps text around freely placed photos", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate((photo) => {
      localStorage.clear();
      localStorage.setItem(
        "anschreiben:v1",
        JSON.stringify({
          version: 1,
          data: {
            absenderName: "Mia Keller",
            text: "Dieser längere Brieftext prüft den Textfluss um ein frei platziertes Foto. ".repeat(
              12,
            ),
            anrede: "Guten Tag",
            gruss: "Freundliche Grüsse",
            unterschrift: "Mia Keller",
            images: [
              {
                id: "letter-flow-1",
                src: photo,
                side: "right",
                topMm: 8,
                widthMm: 34,
                gapMm: 4,
              },
            ],
          },
          design: {
            template: "brief",
            colors: { bg: "#ffffff", primary: "#111111", accent: "#111111" },
            font: "freundlich",
          },
        }),
      );
    }, PHOTO);

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const preview = page.getByLabel("Vorschau Motivationsschreiben");
    const image = preview.locator('[data-letter-flow-image="letter-flow-1"]');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("data-wrap", "square");
    await expect(image).toHaveAttribute("data-aspect", "original");
    await expect(image).toHaveAttribute("data-side", "right");
    expect(await image.evaluate((element) => getComputedStyle(element).cssFloat)).toBe("right");

    const box = await image.boundingBox();
    const layerBox = await preview.locator("[data-letter-text-layer]").first().boundingBox();
    if (!box) throw new Error("flow image has no bounding box");
    if (!layerBox) throw new Error("letter text layer has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(layerBox.x + layerBox.width * 0.2, box.y + box.height / 2 + 30, {
      steps: 8,
    });
    await page.mouse.up();

    await expect(image).toHaveAttribute("data-side", "left");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const saved = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "{}");
          const flow = saved.data?.images?.[0];
          return { side: flow?.side, topMm: flow?.topMm, xMm: flow?.xMm };
        }),
      )
      .toMatchObject({ side: "left", xMm: expect.any(Number) });
  });
});
