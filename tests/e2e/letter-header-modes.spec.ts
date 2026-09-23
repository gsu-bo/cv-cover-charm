import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "anschreiben:v1";

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
      datum: "15.11.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
      anrede: "Guten Tag Herr Weber",
      text: "Ich bewerbe mich mit grossem Interesse um die Lehrstelle.",
      richTextHtml: "",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      images: [],
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: {
      template: "modern",
      colors: { bg: "#fafafa", primary: "#111827", accent: "#f43f5e" },
      font: "freundlich",
      fontOverride: null,
      headerMode: "compact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
      footerMode: "compact",
    },
  };
}

async function openSection(page: Page, name: RegExp) {
  const section = page
    .locator("[data-editor-section]")
    .filter({ has: page.getByRole("button", { name }) })
    .first();
  const header = section.getByRole("button", { name });
  await expect(header).toBeVisible();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
  return section;
}

async function seedLetter(page: Page, payload = letterPayload()) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, payload: seededPayload }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(seededPayload));
    },
    { key: STORAGE_KEY, payload },
  );
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Motivationsschreiben" })).toBeVisible();
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
}

async function setStoredTemplate(page: Page, template: string) {
  await page.evaluate(
    ({ key, templateId }) => {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      saved.design = {
        ...(saved.design ?? {}),
        template: templateId,
        colors: {
          bg: "#ffffff",
          primary: "#172554",
          secondary: "#2563eb",
          accent: "#38bdf8",
        },
        headerMode: "compact",
        footerMode: "compact",
      };
      localStorage.setItem(key, JSON.stringify(saved));
    },
    { key: STORAGE_KEY, templateId: template },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
  await expect(page.locator("main [data-letter-page]").first()).toHaveAttribute(
    "data-letter-template",
    template,
  );
}

test.describe("M1/M2 compact letter header", () => {
  test("header modes change real geometry, persist, and preview/export stay aligned", async ({
    page,
  }) => {
    await seedLetter(page);

    const chrome = await openSection(page, /^Header & Footer$/);
    const select = chrome.locator("[data-letter-header-mode-control]");
    const preview = page.locator("main [data-letter-page]");
    const exportPage = page.locator("[data-letter-standalone-export] [data-letter-page]");

    await expect(select).toHaveValue("compact");
    await expect(preview).toHaveAttribute("data-letter-header-mode", "compact");
    await expect(preview).toHaveAttribute("data-letter-paper-color", "#fafafa");
    await expect(exportPage).toHaveAttribute("data-letter-paper-color", "#fafafa");
    await expect(preview).toHaveCSS("background-color", "rgb(250, 250, 250)");
    await expect(preview.locator('[data-letter-section="sender"]')).toHaveCount(1);
    expect(
      await preview.locator("[data-letter-text-layer]").evaluate((node) => node.style.top),
    ).toBe("34mm");

    await select.selectOption("contact-stacked");
    await expect(preview).toHaveAttribute("data-letter-header-mode", "contact");
    await expect(exportPage).toHaveAttribute("data-letter-header-mode", "contact");
    await expect(preview.locator("[data-letter-integrated-contact]")).toContainText("Lea Müller");
    await expect(preview.locator("[data-letter-integrated-contact]")).toContainText(
      "+41 79 123 45 67",
    );
    await expect(preview.locator('[data-letter-section="sender"]')).toHaveCount(0);
    expect(
      await preview.locator("[data-letter-text-layer]").evaluate((node) => node.style.top),
    ).toBe("53mm");

    const headerBox = await preview.locator("[data-letter-integrated-contact]").boundingBox();
    const recipientBox = await preview.locator('[data-letter-section="recipient"]').boundingBox();
    expect(headerBox).not.toBeNull();
    expect(recipientBox).not.toBeNull();
    expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(recipientBox!.y);

    await chrome.getByLabel("Name integrieren").uncheck();
    await chrome.getByLabel("Telefon integrieren").uncheck();
    await expect(preview.locator("[data-letter-integrated-contact]")).not.toContainText(
      "Lea Müller",
    );
    await expect(preview.locator("[data-letter-integrated-contact]")).not.toContainText(
      "+41 79 123 45 67",
    );

    await expect
      .poll(async () => {
        return page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").design?.headerMode,
          STORAGE_KEY,
        );
      })
      .toBe("contact");
    await expect
      .poll(async () => {
        return page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").design?.headerShowName,
          STORAGE_KEY,
        );
      })
      .toBe(false);

    await select.selectOption("none");
    await expect(preview).toHaveAttribute("data-letter-header-mode", "none");
    await expect(preview.locator("[data-letter-integrated-contact]")).toHaveCount(0);
    await expect(preview.locator('[data-letter-section="sender"]')).toHaveCount(1);
    expect(
      await preview.locator("[data-letter-text-layer]").evaluate((node) => node.style.top),
    ).toBe("18mm");

    await expect
      .poll(async () => {
        return page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").design?.headerMode,
          STORAGE_KEY,
        );
      })
      .toBe("none");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    const reloadedChrome = await openSection(page, /^Header & Footer$/);
    await expect(reloadedChrome.locator("[data-letter-header-mode-control]")).toHaveValue("none");
    await expect(page.locator("main [data-letter-page]")).toHaveAttribute(
      "data-letter-header-mode",
      "none",
    );
  });

  test("long contact values wrap without horizontal clipping or touching the recipient block", async ({
    page,
  }) => {
    const payload = letterPayload();
    payload.data.absenderName = "Lea Sophie Alexandra Müller-Winterberger-Schneider";
    payload.data.absenderAdresse = "Sehrlangebeispielstrasse 123a Hinterhaus";
    payload.data.absenderEmail =
      "lea.sophie.alexandra.mueller-winterberger-schneider@example-company.ch";
    payload.design.headerMode = "contact";
    await seedLetter(page, payload);

    const preview = page.locator("main [data-letter-page]");
    const contact = preview.locator("[data-letter-integrated-contact]");
    const recipient = preview.locator('[data-letter-section="recipient"]');
    await expect(contact).toContainText("Müller-Winterberger-Schneider");
    await expect(contact).toContainText("example-company.ch");

    const dimensions = await contact.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const contactBox = await contact.boundingBox();
    const recipientBox = await recipient.boundingBox();
    expect(contactBox).not.toBeNull();
    expect(recipientBox).not.toBeNull();
    expect(contactBox!.y + contactBox!.height).toBeLessThanOrEqual(recipientBox!.y);
  });
});

test.describe("M3 compact letter footer", () => {
  test("footer modes relocate attachments, adapt geometry, persist, and match export", async ({
    page,
  }) => {
    await seedLetter(page);

    const chrome = await openSection(page, /^Header & Footer$/);
    const select = chrome.locator("[data-letter-footer-mode-control]");
    const preview = page.locator("main [data-letter-page]");
    const exportPage = page.locator("[data-letter-standalone-export] [data-letter-page]");
    const textLayer = preview.locator("[data-letter-text-layer]");

    await expect(select).toHaveValue("compact");
    await expect(preview).toHaveAttribute("data-letter-footer-mode", "compact");
    await expect(preview.locator('[data-letter-footer="compact"]')).toHaveCount(1);
    expect(await textLayer.evaluate((node) => node.style.bottom)).toBe("18.6mm");
    await expect(textLayer.locator('[data-letter-pdf-text="attachments-heading"]')).toHaveCount(1);

    await select.selectOption("attachments");
    await expect(preview).toHaveAttribute("data-letter-footer-mode", "attachments");
    await expect(exportPage).toHaveAttribute("data-letter-footer-mode", "attachments");
    await expect(preview.locator('[data-letter-footer="attachments"]')).toHaveCount(1);
    await expect(preview.locator("[data-letter-footer-attachments]")).toContainText("Lebenslauf");
    await expect(preview.locator("[data-letter-footer-attachments]")).toContainText("Zeugnis");
    await expect(textLayer.locator('[data-letter-pdf-text="attachments-heading"]')).toHaveCount(0);
    const attachmentsBottom = await textLayer.evaluate((node) => parseFloat(node.style.bottom));
    expect(attachmentsBottom).toBeGreaterThan(18.6);

    await expect
      .poll(async () => {
        return page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").design?.footerMode,
          STORAGE_KEY,
        );
      })
      .toBe("attachments");

    await select.selectOption("none");
    await expect(preview).toHaveAttribute("data-letter-footer-mode", "none");
    await expect(exportPage).toHaveAttribute("data-letter-footer-mode", "none");
    await expect(preview.locator("[data-letter-footer]")).toHaveCount(0);
    expect(await textLayer.evaluate((node) => node.style.bottom)).toBe("10mm");
    await expect(textLayer.locator('[data-letter-pdf-text="attachments-heading"]')).toHaveCount(1);

    await expect
      .poll(async () => {
        return page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "{}").design?.footerMode,
          STORAGE_KEY,
        );
      })
      .toBe("none");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
    const reloadedChrome = await openSection(page, /^Header & Footer$/);
    await expect(reloadedChrome.locator("[data-letter-footer-mode-control]")).toHaveValue("none");
    await expect(page.locator("main [data-letter-page]")).toHaveAttribute(
      "data-letter-footer-mode",
      "none",
    );
  });
});

test.describe("M4 centralized letter layout", () => {
  test("representative archetypes react to every mode with matching preview/export content boxes", async ({
    page,
  }) => {
    await seedLetter(page);

    const samples = [
      ["modern", "quiet"],
      ["freundlich", "band"],
      ["blockig", "sidebar"],
      ["neon", "frame"],
      ["glow", "fresh"],
    ] as const;

    for (const [template, archetype] of samples) {
      await setStoredTemplate(page, template);
      const chrome = await openSection(page, /^Header & Footer$/);
      const headerSelect = chrome.locator("[data-letter-header-mode-control]");
      const footerSelect = chrome.locator("[data-letter-footer-mode-control]");
      const preview = page.locator("main [data-letter-page]");
      const exportPage = page.locator("[data-letter-standalone-export] [data-letter-page]");
      const previewLayer = preview.locator("[data-letter-text-layer]");
      const exportLayer = exportPage.locator("[data-letter-text-layer]");

      await expect(preview).toHaveAttribute("data-letter-layout-archetype", archetype);
      await expect(exportPage).toHaveAttribute("data-letter-layout-archetype", archetype);

      for (const [controlValue, mode] of [
        ["compact", "compact"],
        ["contact-stacked", "contact"],
        ["none", "none"],
      ] as const) {
        await headerSelect.selectOption(controlValue);
        const effectiveMode = mode;
        await expect(preview).toHaveAttribute("data-letter-header-mode", effectiveMode);
        await expect(exportPage).toHaveAttribute("data-letter-header-mode", effectiveMode);
        const contentBox = await previewLayer.getAttribute("data-letter-content-box");
        expect(contentBox).not.toBeNull();
        await expect(exportLayer).toHaveAttribute("data-letter-content-box", contentBox!);
      }

      for (const mode of ["compact", "attachments", "none"] as const) {
        await footerSelect.selectOption(mode);
        await expect(preview).toHaveAttribute("data-letter-footer-mode", mode);
        await expect(exportPage).toHaveAttribute("data-letter-footer-mode", mode);
        const contentBox = await previewLayer.getAttribute("data-letter-content-box");
        expect(contentBox).not.toBeNull();
        await expect(exportLayer).toHaveAttribute("data-letter-content-box", contentBox!);
      }
    }
  });
});
