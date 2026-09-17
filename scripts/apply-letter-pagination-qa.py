from pathlib import Path

SPEC = r'''import { expect, test, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";

const BASE_URL = "http://127.0.0.1:4173";
const LETTER_KEY = "anschreiben:v1";
const CHROME_KEY = "bewerbungsdossier:chrome:v1";
const ARTIFACT_DIR = "artifacts/letter-pagination";
const execFileAsync = promisify(execFile);

function longPlainBody(count = 24) {
  return Array.from({ length: count }, (_, index) => {
    const marker = `LETTER_PARAGRAPH_${String(index + 1).padStart(2, "0")}`;
    return `${marker}: Ich interessiere mich sehr für die ausgeschriebene Lehrstelle und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft anhand konkreter Erfahrungen aus Schule, Projekten und Alltag erklären. Besonders wichtig ist mir, Aufgaben sorgfältig zu verstehen, Lösungen auszuprobieren und verständlich zu dokumentieren, was ich gelernt habe.`;
  }).join("\n\n");
}

function baseChromeOptions(patch: Record<string, unknown> = {}) {
  return {
    headerMode: "none",
    headerShowName: true,
    headerShowAddress: true,
    headerShowPhone: true,
    headerShowEmail: true,
    headerDifferentFirstPage: true,
    headerHeightMm: null,
    headerGapMm: 12,
    headerContentOffsetYMm: 0,
    letterRecipientOffsetYMm: 0,
    headerTextLayout: "stacked",
    headerInlineSeparator: "icons",
    headerBackgroundColor: null,
    headerGradientColor: null,
    footerMode: "none",
    footerHeightMm: null,
    footerContentOffsetYMm: 0,
    footerTextLayout: "inline",
    footerBackgroundColor: null,
    footerGradientColor: null,
    borderEnabled: false,
    borderColor: null,
    borderWidthMm: 0.6,
    textFont: null,
    ...patch,
  };
}

function chromeState(patch: Record<string, unknown> = {}) {
  const options = baseChromeOptions(patch);
  return {
    version: 1,
    sync: true,
    shared: { ...options },
    cv: { ...options },
    letter: { ...options },
  };
}

function letterPayload({
  template = "brief",
  text = longPlainBody(),
  richTextHtml = "",
  designPatch = {},
  dataPatch = {},
}: {
  template?: string;
  text?: string;
  richTextHtml?: string;
  designPatch?: Record<string, unknown>;
  dataPatch?: Record<string, unknown>;
} = {}) {
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
      datum: "17.09.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
      anrede: "Guten Tag Herr Weber",
      text,
      richTextHtml,
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      images: [],
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
      ...dataPatch,
    },
    design: {
      template,
      colors: {},
      font: "freundlich",
      fontOverride: null,
      senderAlign: "left",
      recipientAlign: "left",
      dateAlign: "left",
      ruleAfterSender: false,
      ruleAfterRecipient: false,
      ruleAfterSubject: false,
      ...designPatch,
    },
  };
}

function coverPayload(template = "brief") {
  return {
    version: 7,
    template,
    colors: {},
    layout: { [template]: {} },
    customs: [],
    fontScale: 1.2,
    font: "freundlich",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatikerin EFZ",
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
      datum: "17.09.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: null,
    },
  };
}

function cvPayload(template = "brief") {
  return {
    version: 6,
    data: {
      titel: "Lebenslauf",
      person: {
        vorname: "Lea",
        nachname: "Müller",
        adresse: "Dorfstrasse 12",
        plzOrt: "4535 Hubersdorf",
        telefon: "+41 79 123 45 67",
        email: "lea.mueller@example.ch",
        geburtsdatum: "14.03.2010",
        nationalitaet: "Schweiz",
        untertitel: "CV_FIRST_PAGE_MARKER",
        foto: null,
      },
      schule: [
        {
          id: "school-1",
          zeit: "2023 – heute",
          titel: "Sekundarschule",
          ort: "Hubersdorf",
          beschreibung: "Schwerpunkt Informatik und selbstständiges Arbeiten.",
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
      template,
      colors: {},
      font: "freundlich",
      bgOpacity: 0.25,
      useElements: false,
    },
    elements: [],
    elementStyles: {},
  };
}

async function waitForPagination(root: ReturnType<Page["locator"]>) {
  await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });
}

async function seedStandalone(
  page: Page,
  letter: ReturnType<typeof letterPayload>,
  chrome?: ReturnType<typeof chromeState>,
) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ savedLetter, savedChrome, letterKey, chromeKey }) => {
      localStorage.clear();
      localStorage.setItem(letterKey, JSON.stringify(savedLetter));
      if (savedChrome) localStorage.setItem(chromeKey, JSON.stringify(savedChrome));
    },
    { savedLetter: letter, savedChrome: chrome ?? null, letterKey: LETTER_KEY, chromeKey: CHROME_KEY },
  );
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible({ timeout: 20_000 });

  const preview = page.locator("main [data-letter-document-root]");
  const hidden = page.locator("[data-letter-standalone-export] [data-letter-document-root]");
  await waitForPagination(preview);
  await waitForPagination(hidden);
  return { preview, hidden };
}

async function extractPdfPages(path: string): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(path));
  const document = await getDocument({ data, disableFontFace: true }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const pdfPage = await document.getPage(pageNumber);
    const content = await pdfPage.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" "),
    );
  }
  return pages;
}

async function downloadStandaloneLetter(page: Page) {
  const downloadMenu = page.getByRole("button", { name: "Download", exact: true });
  await downloadMenu.click();
  const action = page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/i });
  await expect(action).toBeEnabled({ timeout: 20_000 });
  const promise = page.waitForEvent("download", { timeout: 90_000 });
  await action.click();
  return promise;
}

async function screenshotHiddenPages(page: Page, names: number[]) {
  const host = page.locator("[data-letter-standalone-export]");
  await host.evaluate((node) => {
    const element = node as HTMLElement;
    element.style.left = "0";
    element.style.top = "0";
    element.style.zIndex = "9999";
    element.style.background = "white";
  });
  const pages = host.locator("[data-letter-document-pages] [data-letter-page]");
  for (const index of names) {
    await pages.nth(index).screenshot({ path: `${ARTIFACT_DIR}/hidden-page-${index + 1}.png` });
  }
}

function occurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1;
}

async function seedWholeDossier(page: Page, body: string) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cover, letter, cv }) => {
      localStorage.clear();
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    },
    {
      cover: coverPayload("brief"),
      letter: letterPayload({ template: "brief", text: body }),
      cv: cvPayload("brief"),
    },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function openDossierReview(page: Page) {
  const card = page.getByRole("button").filter({ hasText: "Gesamtdossier herunterladen" });
  await expect(card).toBeVisible();
  await card.click();
  const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("real multi-page motivation-letter pagination", () => {
  test.setTimeout(240_000);

  test.beforeEach(async () => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
  });

  test("A/I/J Brief neutral preview/export/PDF share pages and page-2 searchable text", async ({
    page,
  }) => {
    const { preview, hidden } = await seedStandalone(
      page,
      letterPayload({ template: "brief", text: longPlainBody(18) }),
    );
    const previewPages = preview.locator("[data-letter-document-pages] [data-letter-page]");
    const hiddenPages = hidden.locator("[data-letter-document-pages] [data-letter-page]");
    const pageCount = await previewPages.count();
    expect(pageCount).toBeGreaterThan(1);
    await expect(hiddenPages).toHaveCount(pageCount);

    for (const index of [0, 1]) {
      const sheet = previewPages.nth(index);
      await expect(sheet).toHaveAttribute("data-letter-header-mode", "none");
      await expect(sheet).toHaveAttribute("data-letter-footer-mode", "none");
      await expect(sheet.locator("[data-dossier-compact-header]")).toHaveCount(0);
      await expect(sheet.locator("[data-letter-integrated-contact]")).toHaveCount(0);
      await expect(sheet.locator("[data-letter-footer]")).toHaveCount(0);
    }
    expect(
      await previewPages.nth(1).locator("[data-letter-text-layer]").evaluate((node) => node.style.top),
    ).toBe("16mm");
    expect(
      await previewPages
        .nth(1)
        .locator("[data-letter-text-layer]")
        .evaluate((node) => node.style.bottom),
    ).toBe("10mm");

    const secondVisibleText = await previewPages.nth(1).innerText();
    const secondMarker = secondVisibleText.match(/LETTER_PARAGRAPH_\d+/)?.[0];
    expect(secondMarker).toBeTruthy();
    await expect(previewPages.nth(1).locator('[data-letter-section="recipient"]')).toBeHidden();
    await expect(previewPages.nth(1).locator('[data-letter-section="date"]')).toBeHidden();
    await expect(previewPages.nth(1).locator('[data-letter-pdf-text="subject"]')).toBeHidden();
    await expect(previewPages.nth(1).locator('[data-letter-pdf-text="salutation"]')).toBeHidden();

    await previewPages.nth(0).screenshot({ path: `${ARTIFACT_DIR}/brief-preview-page-1.png` });
    await previewPages.nth(1).screenshot({ path: `${ARTIFACT_DIR}/brief-preview-page-2.png` });

    const download = await downloadStandaloneLetter(page);
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(10_000);
    await download.saveAs(`${ARTIFACT_DIR}/brief-multipage-standalone.pdf`);

    const pdfPages = await extractPdfPages(path ?? "");
    expect(pdfPages).toHaveLength(pageCount);
    expect(pdfPages[1]).toContain(secondMarker ?? "__missing_marker__");
    expect(pdfPages[1]).not.toContain("Beispiel AG");
    expect(pdfPages[1]).not.toContain("Bewerbung um eine Lehrstelle als Informatikerin EFZ");
    expect(pdfPages[1]).not.toContain("Guten Tag Herr Weber");

    await screenshotHiddenPages(page, [0, 1]);

    const onePage = await seedStandalone(
      page,
      letterPayload({ template: "brief", text: "LEGACY_ONE_PAGE: Kurzes Motivationsschreiben." }),
    );
    await expect(onePage.preview.locator("[data-letter-document-pages] [data-letter-page]")).toHaveCount(
      1,
    );
    await expect(onePage.hidden.locator("[data-letter-document-pages] [data-letter-page]")).toHaveCount(
      1,
    );
  });

  test("B/C/D contact continuation, first-page switch and compact semantics stay authoritative", async ({
    page,
  }) => {
    let roots = await seedStandalone(
      page,
      letterPayload({ text: longPlainBody(18) }),
      chromeState({
        headerMode: "contact",
        headerShowAddress: false,
        headerShowPhone: false,
        headerShowEmail: true,
        headerDifferentFirstPage: true,
      }),
    );
    let pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    expect(await pages.count()).toBeGreaterThan(1);
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).toContainText("Lea Müller");
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).toContainText(
      "lea.mueller@example.ch",
    );
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).not.toContainText(
      "+41 79 123 45 67",
    );
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).not.toContainText(
      "Dorfstrasse 12",
    );
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).toContainText(
      "Lea Müller",
    );
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).toContainText(
      "lea.mueller@example.ch",
    );
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).not.toContainText(
      "+41 79 123 45 67",
    );

    roots = await seedStandalone(
      page,
      letterPayload({ text: longPlainBody(18) }),
      chromeState({ headerMode: "contact", headerDifferentFirstPage: false }),
    );
    pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).toHaveCount(0);
    await expect(pages.nth(1).locator("[data-letter-integrated-contact]")).toContainText("Dorfstrasse 12");
    await expect(pages.nth(1).locator("[data-letter-integrated-contact]")).toContainText(
      "+41 79 123 45 67",
    );

    roots = await seedStandalone(
      page,
      letterPayload({ text: longPlainBody(18) }),
      chromeState({ headerMode: "compact" }),
    );
    pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(pages.nth(1)).toHaveAttribute("data-letter-header-mode", "compact");
    await expect(pages.nth(1).locator("[data-dossier-compact-header]")).toHaveCount(1);
    await expect(pages.nth(1).locator("[data-letter-integrated-contact]")).toHaveCount(0);
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).toHaveCount(0);
  });

  test("E details attachments exist exactly once on final page and never on intermediate pages", async ({
    page,
  }) => {
    const { preview, hidden } = await seedStandalone(
      page,
      letterPayload({ text: longPlainBody(42), designPatch: { footerMode: "attachments" } }),
      chromeState({ footerMode: "details" }),
    );
    const pages = preview.locator("[data-letter-document-pages] [data-letter-page]");
    const count = await pages.count();
    expect(count).toBeGreaterThan(2);

    for (let index = 0; index < count - 1; index += 1) {
      await expect(pages.nth(index).locator('[data-letter-footer="details"]')).toHaveCount(0);
      await expect(pages.nth(index).locator("[data-letter-footer-attachments]")).toHaveCount(0);
      await expect(
        pages.nth(index).locator('[data-letter-pdf-text="attachments-heading"]'),
      ).toBeHidden();
    }
    const finalPage = pages.nth(count - 1);
    await expect(finalPage.locator('[data-letter-footer="details"]')).toHaveCount(1);
    await expect(finalPage.locator("[data-letter-footer-attachments]")).toContainText("Lebenslauf");
    await expect(finalPage.locator("[data-letter-footer-attachments]")).toContainText("Zeugnis");
    expect(await preview.locator("[data-letter-footer-attachments]").count()).toBe(1);
    expect(await hidden.locator("[data-letter-footer-attachments]").count()).toBe(1);

    await pages.nth(0).screenshot({ path: `${ARTIFACT_DIR}/details-page-1.png` });
    await pages.nth(1).screenshot({ path: `${ARTIFACT_DIR}/details-page-intermediate.png` });
    await finalPage.screenshot({ path: `${ARTIFACT_DIR}/details-page-final.png` });
  });

  test("F Warm template keeps template-owned compact masthead but explicit contact/none win", async ({
    page,
  }) => {
    let roots = await seedStandalone(
      page,
      letterPayload({ template: "freundlich", text: longPlainBody(18) }),
    );
    let pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    expect(await pages.count()).toBeGreaterThan(1);
    await expect(pages.nth(0).locator("[data-letter-warm-sender]")).toBeVisible();
    await expect(pages.nth(0)).toHaveAttribute("data-letter-header-mode", "compact");
    await expect(pages.nth(1).locator("[data-dossier-compact-header]")).toHaveCount(1);
    await expect(pages.nth(1).locator("[data-letter-warm-sender]")).toHaveCount(0);

    roots = await seedStandalone(
      page,
      letterPayload({ template: "freundlich", text: longPlainBody(18) }),
      chromeState({ headerMode: "contact" }),
    );
    pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(pages.nth(0).locator("[data-letter-warm-sender]")).toHaveCount(0);
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).toBeVisible();
    await expect(pages.nth(1).locator("[data-dossier-continuation-contact-header]")).toBeVisible();

    roots = await seedStandalone(
      page,
      letterPayload({ template: "freundlich", text: longPlainBody(18) }),
      chromeState({ headerMode: "none" }),
    );
    pages = roots.preview.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(pages.nth(0).locator("[data-letter-warm-sender]")).toHaveCount(0);
    await expect(pages.nth(0).locator("[data-letter-integrated-contact]")).toHaveCount(0);
    await expect(pages.nth(1).locator("[data-dossier-compact-header]")).toHaveCount(0);
  });

  test("G rich paragraphs/lists/HR/table rows split without clipping, loss or duplication", async ({
    page,
  }) => {
    const giantWords = Array.from({ length: 760 }, (_, index) => `GIANT_${index + 1}`).join(" ");
    const listHtml = Array.from(
      { length: 14 },
      (_, index) =>
        `<div data-align="left" data-list="bullet">LIST_ITEM_${index + 1}: belastbarer Listeninhalt</div>`,
    ).join("");
    const rows = Array.from(
      { length: 38 },
      (_, index) => `<tr><td>TABLE_ROW_${index + 1}</td><td>Wert ${index + 1}</td></tr>`,
    ).join("");
    const richTextHtml = [
      `<div data-align="justify">GIANT_START ${giantWords} GIANT_END</div>`,
      listHtml,
      "<hr>",
      `<table data-letter-table><tbody>${rows}</tbody></table>`,
      '<div data-align="justify">RICH_FINAL_PARAGRAPH</div>',
    ].join("");

    const { preview } = await seedStandalone(
      page,
      letterPayload({ text: "", richTextHtml, template: "brief" }),
    );
    await expect(preview).not.toHaveAttribute("data-letter-pagination-error");
    const pages = preview.locator("[data-letter-document-pages] [data-letter-page]");
    expect(await pages.count()).toBeGreaterThan(2);

    const bodyText = await pages
      .locator("[data-letter-pdf-richtext='body']")
      .allInnerTexts()
      .then((values) => values.join(" "));
    for (const token of ["GIANT_START", "GIANT_END", "RICH_FINAL_PARAGRAPH", "LIST_ITEM_14", "TABLE_ROW_38"]) {
      expect(occurrences(bodyText, token), `${token} must survive exactly once`).toBe(1);
    }
    expect(await pages.locator("[data-list]").count()).toBe(14);
    expect(await pages.locator("[data-letter-pdf-richtext='body'] hr").count()).toBe(1);
    expect(await pages.locator("table[data-letter-table] tr").count()).toBe(38);

    const rowPageIndexes = await pages.locator("table[data-letter-table] tr").evaluateAll((nodes) =>
      Array.from(
        new Set(
          nodes
            .map((node) => node.closest<HTMLElement>("[data-letter-page]")?.dataset.letterPageIndex)
            .filter(Boolean),
        ),
      ),
    );
    expect(rowPageIndexes.length).toBeGreaterThan(1);

    const overflows = await pages.locator("[data-letter-text-layer]").evaluateAll((layers) =>
      layers.map((layer) => layer.scrollHeight > layer.clientHeight + 1),
    );
    expect(overflows.every((value) => value === false)).toBe(true);
  });

  test("K one oversized indivisible table row yields a precise error and disables PDF", async ({
    page,
  }) => {
    const tallCell = `TOO_TALL_ROW${"<br>Zeile".repeat(220)}`;
    const richTextHtml = `<table data-letter-table><tbody><tr><td>${tallCell}</td><td>Wert</td></tr></tbody></table>`;
    const { preview } = await seedStandalone(
      page,
      letterPayload({ text: "", richTextHtml, template: "brief" }),
    );
    await expect(preview).toHaveAttribute("data-letter-pagination-error", "indivisible-block-too-tall");
    await expect(preview).toHaveAttribute(
      "data-letter-pagination-error-message",
      /Tabellenzeile ist höher als der nutzbare Seitenbereich/,
    );
    await expect(page.locator('[data-letter-pagination-issue="indivisible-block-too-tall"]')).toContainText(
      "Tabellenzeile",
    );

    await page.getByRole("button", { name: "Download", exact: true }).click();
    await expect(page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/i })).toBeDisabled();
  });

  test("H combined PDF is cover -> every letter page -> every CV page and long DOCX still exports", async ({
    page,
  }) => {
    const body = longPlainBody(24);
    await seedWholeDossier(page, body);
    let dialog = await openDossierReview(page);

    const letterRoot = page.locator("[data-dossier-document='letter'] [data-letter-document-root]");
    await waitForPagination(letterRoot);
    const letterPages = letterRoot.locator("[data-letter-document-pages] [data-letter-page]");
    const letterCount = await letterPages.count();
    expect(letterCount).toBeGreaterThan(1);
    const cvPages = page.locator("[data-cv-page]");
    await expect.poll(() => cvPages.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    const cvCount = await cvPages.count();

    const secondLetterText = await letterPages.nth(1).innerText();
    const secondLetterMarker = secondLetterText.match(/LETTER_PARAGRAPH_\d+/)?.[0];
    expect(secondLetterMarker).toBeTruthy();

    const pdfButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(pdfButton).toBeEnabled({ timeout: 20_000 });
    const pdfPromise = page.waitForEvent("download", { timeout: 120_000 });
    await pdfButton.click();
    const pdfDownload = await pdfPromise;
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).not.toBeNull();
    await pdfDownload.saveAs(`${ARTIFACT_DIR}/combined-multipage-dossier.pdf`);
    const pdfPages = await extractPdfPages(pdfPath ?? "");
    expect(pdfPages).toHaveLength(1 + letterCount + cvCount);
    expect(pdfPages[2]).toContain(secondLetterMarker ?? "__missing_letter_marker__");
    expect(pdfPages.slice(1, 1 + letterCount).join(" ")).not.toContain("CV_FIRST_PAGE_MARKER");
    expect(pdfPages[1 + letterCount]).toContain("CV_FIRST_PAGE_MARKER");

    dialog = await openDossierReview(page);
    const docxOption = dialog.getByRole("radio", { name: /Bearbeitbares Dossier \(DOCX\)/ });
    await expect(docxOption).toBeEnabled({ timeout: 20_000 });
    await docxOption.click();
    const docxButton = dialog.getByRole("button", { name: "DOCX herunterladen" });
    await expect(docxButton).toBeEnabled();
    const docxPromise = page.waitForEvent("download", { timeout: 120_000 });
    await docxButton.click();
    const docxDownload = await docxPromise;
    const docxPath = `${ARTIFACT_DIR}/combined-long-letter.docx`;
    await docxDownload.saveAs(docxPath);
    expect((await stat(docxPath)).size).toBeGreaterThan(2_000);
    const header = await readFile(docxPath);
    expect([...header.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const { stdout: documentXml } = await execFileAsync("unzip", ["-p", docxPath, "word/document.xml"], {
      maxBuffer: 20 * 1024 * 1024,
    });
    expect(documentXml).toContain("LETTER_PARAGRAPH_01");
    expect(documentXml).toContain("LETTER_PARAGRAPH_24");
    expect(documentXml).toContain("Freundliche Grüsse");
  });
});
'''


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


# Native PDF text must ignore page-one fields hidden by continuation CSS.
replace_once(
    "src/lib/dossier-pdf.ts",
    "    const text = letterText(element);\n    if (!text) continue;\n    const rect = element.getBoundingClientRect();\n    const style = window.getComputedStyle(element);\n",
    "    const text = letterText(element);\n    if (!text) continue;\n    const rect = element.getBoundingClientRect();\n    if (rect.width <= 0 || rect.height <= 0) continue;\n    const style = window.getComputedStyle(element);\n",
)

Path("tests/e2e/letter-pagination.spec.ts").write_text(SPEC, encoding="utf-8")

# Put the new pagination regression into the normal browser matrix.
replace_once(
    ".github/workflows/dossier-regression.yml",
    "              tests/e2e/letter-header-modes.spec.ts\n              tests/e2e/letter-final-qa.spec.ts\n",
    "              tests/e2e/letter-header-modes.spec.ts\n              tests/e2e/letter-final-qa.spec.ts\n              tests/e2e/letter-pagination.spec.ts\n",
)
replace_once(
    ".github/workflows/dossier-regression.yml",
    "          name: letter-m5-visual-gallery\n          path: artifacts/letter-final-qa\n",
    "          name: letter-m5-visual-gallery\n          path: |\n            artifacts/letter-final-qa\n            artifacts/letter-pagination\n",
)

# Release formatting must include the new shared pagination implementation and regression.
replace_once(
    "package.json",
    'src/components/letter/LetterCanvas.tsx src/components/letter/LetterLayoutControls.tsx',
    'src/components/letter/LetterCanvas.tsx src/components/letter/LetterDocument.tsx src/components/letter/letter-page-context.ts src/components/letter/letter-pagination.ts src/components/letter/letter-pagination.css src/components/letter/LetterLayoutControls.tsx',
)
replace_once(
    "package.json",
    'tests/e2e/letter-header-modes.spec.ts tests/e2e/dossier-letter-preflight.spec.ts',
    'tests/e2e/letter-header-modes.spec.ts tests/e2e/letter-pagination.spec.ts tests/e2e/dossier-letter-preflight.spec.ts',
)

print("letter pagination QA patch applied")
