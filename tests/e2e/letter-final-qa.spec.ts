import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TEMPLATES } from "../../src/components/cover/types";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "anschreiben:v1";
const ARTIFACT_DIR = "artifacts/letter-final-qa";

// Fresh templates register in the browser through LetterTemplatePicker. Keep the
// Node test process CSS-free and enumerate the same runtime ids here.
const FRESH_TEMPLATE_IDS = [
  "edge",
  "glow",
  "frame",
  "monoLuxe",
  "horizon",
  "sunrise",
  "forestFlow",
  "violetPulse",
  "studio2",
  "studio3",
  "warm2",
  "warm3",
  "ledger",
  "prism",
  "gallery",
  "orbit",
  "ribbon",
  "cove",
] as const;

const RETIRED_TEMPLATE_IDS = new Set(["edelBlockig", "sonnig"]);
const DOSSIER_TEMPLATE_IDS = [
  ...TEMPLATES.filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string)).map(
    (template) => template.id as string,
  ),
  ...FRESH_TEMPLATE_IDS,
  "edelDark",
];
const LETTER_STYLE_IDS = DOSSIER_TEMPLATE_IDS;

const NORMAL_BODY = [
  "Die Informatik begeistert mich, weil ich gerne logisch denke, Probleme löse und Neues ausprobiere. Deshalb bewerbe ich mich mit grossem Interesse um die Lehrstelle als Informatikerin EFZ.",
  "In der Schule arbeite ich besonders gerne an Aufgaben, bei denen ich selbstständig Lösungen entwickeln kann. Ich bin zuverlässig, lerne schnell und arbeite gerne im Team.",
  "Gerne möchte ich Ihr Unternehmen und den Beruf bei einem persönlichen Gespräch oder einer Schnupperlehre näher kennenlernen. Ich freue mich über Ihre Rückmeldung.",
].join("\n\n");

const LONG_FITTING_BODY = [
  "Seit mehreren Jahren interessiere ich mich für Computer, digitale Werkzeuge und die Frage, wie technische Probleme Schritt für Schritt gelöst werden können. Besonders gefällt mir, dass in der Informatik sorgfältiges Denken und kreatives Ausprobieren zusammengehören.",
  "In der Schule übernehme ich Aufgaben zuverlässig und bleibe auch dann dran, wenn eine Lösung nicht sofort funktioniert. Bei Gruppenarbeiten kann ich meine Ideen erklären, höre anderen zu und unterstütze das Team dort, wo Hilfe gebraucht wird.",
  "Während einer Schnupperlehre möchte ich den Berufsalltag genauer kennenlernen und zeigen, dass ich motiviert bin, Neues zu lernen. Ich freue mich darauf, Fragen zu stellen, praktische Aufgaben zu übernehmen und einen realistischen Einblick in Ihr Unternehmen zu erhalten.",
  "Die ausgeschriebene Lehrstelle spricht mich deshalb besonders an. Über die Gelegenheit, mich persönlich vorzustellen und mehr über die Ausbildung in Ihrem Betrieb zu erfahren, würde ich mich sehr freuen.",
].join("\n\n");

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function letterPayload({
  template,
  headerMode = "compact",
  footerMode = "compact",
  body = NORMAL_BODY,
  attachments = ["Lebenslauf", "Zeugnis"],
}: {
  template: string;
  headerMode?: "compact" | "contact" | "none";
  footerMode?: "compact" | "attachments" | "none";
  body?: string;
  attachments?: string[];
}) {
  return {
    version: 1,
    data: {
      absenderName: "Lea Sophie Müller-Winterberger",
      absenderAdresse: "Dorfstrasse 12a",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "+41 79 123 45 67",
      absenderEmail: "lea.sophie.mueller-winterberger@example.ch",
      empfaengerFirma: "Beispiel Technologie und Ausbildung AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4500 Solothurn",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ Applikationsentwicklung",
      anrede: "Guten Tag Herr Weber",
      text: body,
      richTextHtml: "",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Sophie Müller-Winterberger",
      images: [],
      showBeilagen: true,
      beilagen: attachments,
    },
    design: {
      template,
      colors: {
        bg: "#ffffff",
        ink: "#172033",
        primary: "#24364b",
        secondary: "#dbeafe",
        accent: "#2563eb",
        cvInk: "#172033",
        cvMuted: "#526072",
        cvHeading: "#172033",
      },
      font: "freundlich",
      fontOverride: null,
      senderAlign: "left",
      recipientAlign: "left",
      dateAlign: "left",
      ruleAfterSender: false,
      ruleAfterRecipient: false,
      ruleAfterSubject: false,
      headerMode,
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
      footerMode,
    },
  };
}

async function doubleFrame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function settleVisualPreview(preview: Locator) {
  await expect
    .poll(
      () =>
        preview.evaluate((element) => {
          const scaleHost = element.parentElement;
          if (!scaleHost) return 0;
          const transform = getComputedStyle(scaleHost).transform;
          if (!transform || transform === "none") return 1;
          const matrix = new DOMMatrixReadOnly(transform);
          return matrix.a;
        }),
      {
        message: "ScaledPreview should finish its ResizeObserver measurement before visual capture",
      },
    )
    .toBeGreaterThan(0.99);
}

async function screenshotExportSurface(page: Page, exported: Locator, path: string) {
  const host = page.locator("[data-letter-standalone-export]");
  await host.evaluate((element) => {
    const html = element as HTMLElement;
    html.dataset.m5OriginalStyle = html.getAttribute("style") ?? "";
    html.style.position = "absolute";
    html.style.left = "0";
    html.style.top = "0";
    html.style.zIndex = "2147483647";
    html.style.background = "white";
  });
  await doubleFrame(page);
  const shot = await exported.screenshot({ path, animations: "disabled" });
  await host.evaluate((element) => {
    const html = element as HTMLElement;
    const original = html.dataset.m5OriginalStyle ?? "";
    if (original) html.setAttribute("style", original);
    else html.removeAttribute("style");
    delete html.dataset.m5OriginalStyle;
  });
  return shot;
}

async function seedLetter(
  page: Page,
  options: Parameters<typeof letterPayload>[0],
): Promise<{ preview: Locator; exported: Locator }> {
  // Seed outside the editor route so its autosave cannot race the fixture.
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: STORAGE_KEY, payload: letterPayload(options) },
  );
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });

  const download = page.getByRole("button", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("data-editor-ready", "true", { timeout: 15_000 });
  const preview = page.locator("main [data-letter-document-root] [data-letter-page]").first();
  const exported = page.locator("[data-letter-standalone-export] [data-letter-page]");
  await expect(preview).toBeVisible();
  await expect(page.locator("main [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect(
    page.locator("[data-letter-standalone-export] [data-letter-document-root]"),
  ).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });
  await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await doubleFrame(page);
  return { preview, exported };
}

async function geometryFailures(root: Locator): Promise<string[]> {
  return root.evaluate((pageEl) => {
    const failures: string[] = [];
    const tolerance = 1.5;
    const pageRect = pageEl.getBoundingClientRect();
    const textLayer = pageEl.querySelector<HTMLElement>("[data-letter-text-layer]");
    if (!textLayer) return ["missing text layer"];
    const textRect = textLayer.getBoundingClientRect();

    if (textLayer.scrollWidth > textLayer.clientWidth + 1)
      failures.push("text layer horizontal overflow");
    if (textLayer.scrollHeight > textLayer.clientHeight + 1)
      failures.push("text layer vertical overflow");
    if (textRect.left < pageRect.left - tolerance || textRect.right > pageRect.right + tolerance) {
      failures.push("text layer outside page horizontally");
    }
    if (textRect.top < pageRect.top - tolerance || textRect.bottom > pageRect.bottom + tolerance) {
      failures.push("text layer outside page vertically");
    }

    const visibleTextNodes = Array.from(
      pageEl.querySelectorAll<HTMLElement>("[data-letter-pdf-text], [data-letter-pdf-richtext]"),
    ).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    for (const element of visibleTextNodes) {
      const rect = element.getBoundingClientRect();
      const id = element.dataset.letterPdfText ?? element.dataset.letterPdfRichtext ?? "text";
      if (rect.left < pageRect.left - tolerance || rect.right > pageRect.right + tolerance) {
        failures.push(`${id} outside page horizontally`);
      }
      if (rect.top < pageRect.top - tolerance || rect.bottom > pageRect.bottom + tolerance) {
        failures.push(`${id} outside page vertically`);
      }
    }

    const contact = pageEl.querySelector<HTMLElement>("[data-letter-integrated-contact]");
    const recipient = pageEl.querySelector<HTMLElement>('[data-letter-section="recipient"]');
    if (contact) {
      if (
        contact.scrollWidth > contact.clientWidth + 1 ||
        contact.scrollHeight > contact.clientHeight + 1
      ) {
        failures.push("contact header clipped");
      }
      const contactRect = contact.getBoundingClientRect();
      if (
        contactRect.left < pageRect.left - tolerance ||
        contactRect.right > pageRect.right + tolerance
      ) {
        failures.push("contact header outside page horizontally");
      }
      if (recipient) {
        const recipientRect = recipient.getBoundingClientRect();
        if (contactRect.bottom > recipientRect.top + tolerance)
          failures.push("contact header overlaps recipient");
      }
    }

    const footer = pageEl.querySelector<HTMLElement>("[data-letter-footer]");
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      if (
        footerRect.left < pageRect.left - tolerance ||
        footerRect.right > pageRect.right + tolerance
      ) {
        failures.push("footer outside page horizontally");
      }
      if (footerRect.bottom > pageRect.bottom + tolerance) failures.push("footer below page");
      if (
        footer.scrollWidth > footer.clientWidth + 1 ||
        footer.scrollHeight > footer.clientHeight + 1
      ) {
        failures.push("footer clipped");
      }
      if (textRect.bottom > footerRect.top + tolerance)
        failures.push("content box overlaps footer");
    }

    return [...new Set(failures)];
  });
}

async function assertHealthy(
  preview: Locator,
  exported: Locator,
  label: string,
  expected: { template: string; header: string; footer: string },
) {
  await expect(preview, `${label} template`).toHaveAttribute(
    "data-letter-template",
    expected.template,
  );
  await expect(preview, `${label} header`).toHaveAttribute(
    "data-letter-requested-header-mode",
    expected.header,
  );
  await expect(preview, `${label} footer`).toHaveAttribute(
    "data-letter-requested-footer-mode",
    expected.footer,
  );
  await expect(exported).toHaveAttribute("data-letter-template", expected.template);
  await expect(exported).toHaveAttribute("data-letter-requested-header-mode", expected.header);
  await expect(exported).toHaveAttribute("data-letter-requested-footer-mode", expected.footer);
  const previewContentBox = preview.locator("[data-letter-content-box]");
  const exportedContentBox = exported.locator("[data-letter-content-box]");
  await expect(previewContentBox).toHaveCount(1);
  await expect(exportedContentBox).toHaveCount(1);
  await expect(exportedContentBox).toHaveAttribute(
    "data-letter-content-box",
    (await previewContentBox.getAttribute("data-letter-content-box")) ?? "",
  );
  await expect
    .poll(() => geometryFailures(preview), { message: `${label} preview clipping/overlap` })
    .toEqual([]);
  await expect
    .poll(() => geometryFailures(exported), { message: `${label} export clipping/overlap` })
    .toEqual([]);
}

async function uiDefaultScreenshot(page: Page) {
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  const download = page.getByRole("button", { name: "Download", exact: true });
  await expect(download).toHaveAttribute("data-editor-ready", "true");
  await download.click();
  await page.getByRole("button", { name: "Beispieldaten übernehmen", exact: true }).click();
  await page.getByRole("button", { name: "Ja", exact: true }).click();
  const preview = page.locator("main [data-letter-document-root] [data-letter-page]").first();
  await expect(preview).toBeVisible();
  await doubleFrame(page);
  await settleVisualPreview(preview);
  const path = join(ARTIFACT_DIR, "00-UI-Default.png");
  const shot = await preview.screenshot({ path, animations: "disabled" });
  expect(shot.length).toBeGreaterThan(10_000);
  return "00-UI-Default.png | echter UI-Default über Beispieldaten";
}

test.describe("M5 final letter QA", () => {
  test.setTimeout(15 * 60_000);

  test("repo truth and 38-output visual gallery cover every selectable letter style", async ({
    page,
  }) => {
    expect(TEMPLATES).toHaveLength(20);
    expect(FRESH_TEMPLATE_IDS).toHaveLength(18);
    expect(DOSSIER_TEMPLATE_IDS).toHaveLength(37);
    expect(new Set(DOSSIER_TEMPLATE_IDS).size).toBe(37);
    expect(LETTER_STYLE_IDS).toHaveLength(37);
    expect(LETTER_STYLE_IDS).not.toContain("edelBlockig");
    expect(LETTER_STYLE_IDS).not.toContain("sonnig");

    await mkdir(ARTIFACT_DIR, { recursive: true });
    const manifest: string[] = [await uiDefaultScreenshot(page)];

    for (const [index, template] of LETTER_STYLE_IDS.entries()) {
      const { preview, exported } = await seedLetter(page, { template });
      await assertHealthy(preview, exported, `${template}/default`, {
        template,
        header: "compact",
        footer: "compact",
      });
      const number = String(index + 1).padStart(2, "0");
      const fileName = `${number}-${safeName(template)}-default.png`;
      const shot = await screenshotExportSurface(page, exported, join(ARTIFACT_DIR, fileName));
      expect(shot.length, `${template} screenshot should not be blank`).toBeGreaterThan(10_000);
      manifest.push(
        `${fileName} | export | template=${template} | header=compact | footer=compact`,
      );
    }

    expect(manifest).toHaveLength(38);
    await writeFile(join(ARTIFACT_DIR, "MANIFEST.txt"), `${manifest.join("\n")}\n`, "utf8");
  });

  test("all 37 styles keep their reviewed contact/header treatment clear of recipient content", async ({
    page,
  }) => {
    for (const template of LETTER_STYLE_IDS) {
      const { preview, exported } = await seedLetter(page, { template, headerMode: "contact" });

      await expect(preview.locator("[data-letter-integrated-contact]")).toBeVisible();
      await assertHealthy(preview, exported, `${template}/contact`, {
        template,
        header: "contact",
        footer: "compact",
      });
    }
  });

  test("all 37 styles release header space cleanly when the header is disabled", async ({
    page,
  }) => {
    for (const template of LETTER_STYLE_IDS) {
      const { preview, exported } = await seedLetter(page, { template, headerMode: "none" });
      await expect(preview.locator("[data-letter-integrated-contact]")).toHaveCount(0);
      await assertHealthy(preview, exported, `${template}/header-none`, {
        template,
        header: "none",
        footer: "compact",
      });
    }
  });

  test("all 37 styles render wrapped attachments in the footer without clipping", async ({
    page,
  }) => {
    const attachments = [
      "Lebenslauf mit vollständiger Übersicht über Schule, Schnupperlehren und persönliche Angaben",
      "Zeugnisse der letzten beiden Semester sowie zusätzliche Bestätigung der Schnupperlehre",
    ];
    for (const template of LETTER_STYLE_IDS) {
      const { preview, exported } = await seedLetter(page, {
        template,
        footerMode: "attachments",
        attachments,
      });
      await expect(preview.locator("[data-letter-footer]")).toBeVisible();
      await expect(preview.locator('[data-letter-pdf-text="attachments-body"]')).toContainText(
        "Zeugnisse der letzten beiden Semester",
      );
      await assertHealthy(preview, exported, `${template}/attachments-footer`, {
        template,
        header: "compact",
        footer: "attachments",
      });
    }
  });

  test("all 37 styles release footer space cleanly when the footer is disabled", async ({
    page,
  }) => {
    for (const template of LETTER_STYLE_IDS) {
      const { preview, exported } = await seedLetter(page, { template, footerMode: "none" });
      await expect(preview.locator("[data-letter-footer]")).toHaveCount(0);
      await assertHealthy(preview, exported, `${template}/footer-none`, {
        template,
        header: "compact",
        footer: "none",
      });
    }
  });

  test("a long but one-page letter stays unclipped and remains exportable", async ({ page }) => {
    const { preview, exported } = await seedLetter(page, {
      template: "edge",
      headerMode: "contact",
      footerMode: "attachments",
      body: LONG_FITTING_BODY,
      attachments: ["Lebenslauf", "Zeugnisse der letzten beiden Semester"],
    });
    await assertHealthy(preview, exported, "long-fitting/contact/attachments", {
      template: "edge",
      header: "contact",
      footer: "attachments",
    });
    await expect(page.getByRole("alert")).toHaveCount(0);
    const download = page.getByRole("button", { name: "Download", exact: true });
    await download.click();
    await expect(
      page
        .locator("[data-editor-action-menu] button")
        .filter({ hasText: "Nur Motivationsschreiben als PDF" }),
    ).toBeEnabled();
  });

  test("multi-page-sized content paginates without clipping and remains exportable", async ({
    page,
  }) => {
    const multiPageBody = Array.from(
      { length: 55 },
      (_, index) =>
        `Absatz ${index + 1}: Ich interessiere mich sehr für diesen Beruf und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft mit einem ausführlichen Beispiel aus Schule und Alltag zeigen.`,
    ).join("\n\n");
    const { exported } = await seedLetter(page, {
      template: "edge",
      headerMode: "contact",
      footerMode: "attachments",
      body: multiPageBody,
      attachments: ["Lebenslauf", "Zeugnis"],
    });

    await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const overflow = await exported.evaluateAll((pages) =>
      pages.some((pageEl) => {
        const textLayer = pageEl.querySelector<HTMLElement>("[data-letter-text-layer]");
        return !!textLayer && textLayer.scrollHeight > textLayer.clientHeight + 1;
      }),
    );
    expect(overflow).toBe(false);
    await expect(exported.last()).toContainText("Absatz 55:");

    const download = page.getByRole("button", { name: "Download", exact: true });
    await download.click();
    await expect(
      page.locator("[data-editor-action-menu] button").filter({
        hasText: "Nur Motivationsschreiben als PDF",
      }),
    ).toBeEnabled();
  });
});
