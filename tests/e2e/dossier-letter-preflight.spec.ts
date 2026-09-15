import { expect, test, type Page } from "@playwright/test";
import { stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const LETTER_KEY = "anschreiben:v1";

const LONG_FITTING_BODY = [
  "Seit mehreren Jahren interessiere ich mich für Computer, digitale Werkzeuge und die Frage, wie technische Probleme Schritt für Schritt gelöst werden können. Besonders gefällt mir, dass in der Informatik sorgfältiges Denken und kreatives Ausprobieren zusammengehören.",
  "In der Schule übernehme ich Aufgaben zuverlässig und bleibe auch dann dran, wenn eine Lösung nicht sofort funktioniert. Bei Gruppenarbeiten kann ich meine Ideen erklären, höre anderen zu und unterstütze das Team dort, wo Hilfe gebraucht wird.",
  "Während einer Schnupperlehre möchte ich den Berufsalltag genauer kennenlernen und zeigen, dass ich motiviert bin, Neues zu lernen. Ich freue mich darauf, Fragen zu stellen, praktische Aufgaben zu übernehmen und einen realistischen Einblick in Ihr Unternehmen zu erhalten.",
  "Die ausgeschriebene Lehrstelle spricht mich deshalb besonders an. Über die Gelegenheit, mich persönlich vorzustellen und mehr über die Ausbildung in Ihrem Betrieb zu erfahren, würde ich mich sehr freuen.",
].join("\n\n");

const HUGE_BODY = Array.from(
  { length: 55 },
  (_, index) =>
    `Absatz ${index + 1}: Ich interessiere mich sehr für diesen Beruf und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft mit einem ausführlichen Beispiel aus Schule und Alltag zeigen.`,
).join("\n\n");

function coverPayload() {
  return {
    version: 7,
    template: "modern",
    colors: {
      modern: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
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
      datum: "02.09.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
  };
}

function cvPayload() {
  return {
    version: 2,
    data: {
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Dorfstrasse 12",
        plzOrt: "4535 Hubersdorf",
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
          titel: "Sekundarschule",
          ort: "Solothurn",
          beschreibung: "",
        },
      ],
      erfahrung: [],
      sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
      hobbys: ["Programmieren"],
      staerken: ["Zuverlässig"],
      referenzen: [],
      labels: {},
      hidden: {},
    },
    design: {
      template: "modern",
      colors: { primary: "#111827", accent: "#f43f5e", bg: "#fafafa" },
      bgOpacity: 0.06,
      useElements: false,
    },
    elements: [],
  };
}

function letterPayload(text: string, patch: Record<string, unknown> = {}) {
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
      datum: "02.09.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
      anrede: "Guten Tag Herr Weber",
      text,
      richTextHtml: "",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      images: [],
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
      ...patch,
    },
    design: {
      template: "modern",
      colors: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
      font: "sans",
      headerMode: "compact",
      footerMode: "compact",
    },
  };
}

async function seedDossier(page: Page, letter: ReturnType<typeof letterPayload>) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cover, cv, letterValue, letterKey }) => {
      localStorage.clear();
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
      localStorage.setItem(letterKey, JSON.stringify(letterValue));
    },
    {
      cover: coverPayload(),
      cv: cvPayload(),
      letterValue: letter,
      letterKey: LETTER_KEY,
    },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function openReview(page: Page) {
  const card = page.getByRole("button").filter({ hasText: "Gesamtdossier herunterladen" });
  await expect(card).toBeVisible();
  await card.click();
  const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("M1 dossier sending truth", () => {
  test.setTimeout(240_000);

  test("missing fields, overflow and fitting content share one safe dossier preflight", async ({
    page,
  }) => {
    await seedDossier(page, letterPayload(LONG_FITTING_BODY, { betreff: "" }));

    let dialog = await openReview(page);
    const readiness = dialog.locator("[data-dossier-letter-readiness]");
    await expect(readiness).toContainText("noch nicht versandbereit");
    await expect(readiness).toContainText("Betreff");
    let downloadButton = dialog.getByRole("button", {
      name: "PDF herunterladen",
      exact: true,
    });
    await expect(downloadButton).toBeDisabled();
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate(
      ({ hugeBody, letterKey }) => {
        const saved = JSON.parse(localStorage.getItem(letterKey) ?? "{}");
        saved.data.betreff = "Bewerbung um eine Lehrstelle als Informatikerin EFZ";
        saved.data.text = hugeBody;
        saved.data.richTextHtml = "";
        localStorage.setItem(letterKey, JSON.stringify(saved));
      },
      { hugeBody: HUGE_BODY, letterKey: LETTER_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    dialog = await openReview(page);
    const overflow = dialog.locator("[data-dossier-letter-overflow]");
    await expect(overflow).toContainText("Motivationsschreiben ist zu lang", { timeout: 15_000 });
    await expect(overflow).toContainText("abgeschnittenes Dossier-PDF wird nicht erstellt");
    downloadButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(downloadButton).toBeDisabled();
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate(
      ({ fittingBody, letterKey }) => {
        const saved = JSON.parse(localStorage.getItem(letterKey) ?? "{}");
        saved.data.text = fittingBody;
        saved.data.richTextHtml = "";
        localStorage.setItem(letterKey, JSON.stringify(saved));
      },
      { fittingBody: LONG_FITTING_BODY, letterKey: LETTER_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    dialog = await openReview(page);
    await expect(dialog.locator("[data-dossier-letter-overflow]")).toHaveCount(0);
    downloadButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(downloadButton).toBeEnabled({ timeout: 15_000 });

    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(10_000);
  });
});
