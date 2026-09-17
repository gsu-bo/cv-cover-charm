import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "anschreiben:v1";
const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='180'%3E%3Crect width='240' height='180' fill='%2394a3b8'/%3E%3C/svg%3E";

const NORMAL_BODY = [
  "Die Informatik begeistert mich, weil ich gerne logisch denke, Probleme löse und Neues ausprobiere.",
  "In der Schule arbeite ich zuverlässig, lerne schnell und unterstütze mein Team, wenn Hilfe gebraucht wird.",
  "Gerne möchte ich Ihr Unternehmen bei einer Schnupperlehre näher kennenlernen und freue mich über Ihre Rückmeldung.",
].join("\n\n");

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

function payload({
  body = NORMAL_BODY,
  richTextHtml = "",
  data = {},
  design = {},
}: {
  body?: string;
  richTextHtml?: string;
  data?: Record<string, unknown>;
  design?: Record<string, unknown>;
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
      datum: "02.09.2026",
      betreff: "Bewerbung um eine Lehrstelle als Informatiker/in EFZ",
      anrede: "Guten Tag Herr Weber",
      text: body,
      richTextHtml,
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      images: [],
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
      ...data,
    },
    design: {
      template: "modern",
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
      headerMode: "compact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
      footerMode: "compact",
      ...design,
    },
  };
}

async function seedLetter(page: Page, letter: ReturnType<typeof payload>) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, saved }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(saved));
    },
    { key: STORAGE_KEY, saved: letter },
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return { preview, exported, download };
}

async function geometryProblems(root: Locator): Promise<string[]> {
  return root.evaluate((article) => {
    const page = article as HTMLElement;
    const pageRect = page.getBoundingClientRect();
    const problems: string[] = [];
    const check = (selector: string, label: string) => {
      for (const item of Array.from(page.querySelectorAll<HTMLElement>(selector))) {
        const rect = item.getBoundingClientRect();
        if (
          rect.left < pageRect.left - 1 ||
          rect.right > pageRect.right + 1 ||
          rect.top < pageRect.top - 1 ||
          rect.bottom > pageRect.bottom + 1
        ) {
          problems.push(`${label}: outside A4`);
        }
      }
    };

    check("[data-letter-text-layer]", "text");
    check("[data-letter-footer]", "footer");
    check("[data-letter-integrated-contact]", "contact");
    check("[data-letter-flow-image]", "image");

    const footer = page.querySelector<HTMLElement>("[data-letter-footer]");
    if (footer && footer.scrollHeight > footer.clientHeight + 1) problems.push("footer: clipped");
    const text = page.querySelector<HTMLElement>("[data-letter-text-layer]");
    if (text && text.scrollHeight > text.clientHeight + 1) problems.push("text: clipped");
    return problems;
  });
}

async function expectHealthy(preview: Locator, exported: Locator, label: string) {
  const previewProblems = await geometryProblems(preview);
  const exportProblems = await geometryProblems(exported);
  expect(previewProblems, `${label}: preview`).toEqual([]);
  expect(exportProblems, `${label}: export`).toEqual([]);
}

async function clickDownloadPdf(page: Page) {
  const download = page.getByRole("button", { name: "Download", exact: true });
  await download.click();
  const button = page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/ });
  await expect(button).toBeVisible();
  return button;
}

test.describe("M8 adversarial motivation-letter content", () => {
  test.setTimeout(90_000);

  test("long international identity and contact values remain visible and inside A4", async ({
    page,
  }) => {
    const { preview, exported } = await seedLetter(
      page,
      payload({
        data: {
          absenderName: "Lea Sophie Alexandra Müller-Winterberger-Schneider",
          absenderAdresse: "Sehrlangebeispielstrasse 123a Hinterhaus",
          absenderPlzOrt: "4535 Hubersdorf bei Solothurn",
          absenderTelefon: "+41 79 123 45 67 / +41 32 765 43 21",
          absenderEmail: "lea.sophie.alexandra.mueller-winterberger-schneider@example-company.ch",
          empfaengerFirma: "Beispiel Technologie und Dienstleistungen Schweiz AG",
          empfaengerName: "Frau Dr. Anna-Maria Muster-Winterberger",
          empfaengerAdresse: "Industriestrasse 123, Gebäude B, 4. Obergeschoss",
          empfaengerPlzOrt: "4500 Solothurn",
        },
        design: {
          template: "serioes",
          headerMode: "contact",
          footerMode: "compact",
          headerShowName: true,
          headerShowAddress: true,
          headerShowPhone: true,
          headerShowEmail: true,
        },
      }),
    );

    await expect(preview).toContainText("Lea Sophie Alexandra Müller-Winterberger-Schneider");
    await expect(preview).toContainText(
      "lea.sophie.alexandra.mueller-winterberger-schneider@example-company.ch",
    );
    await expectHealthy(preview, exported, "long international contact values");
  });

  test("short, normal and long valid bodies remain safe", async ({ page }) => {
    const bodies = [
      ["short", "Ich freue mich darauf, Sie persönlich kennenzulernen."],
      ["normal", NORMAL_BODY],
      ["long-valid", LONG_FITTING_BODY],
    ] as const;

    for (const [label, body] of bodies) {
      const { preview, exported } = await seedLetter(page, payload({ body }));
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expectHealthy(preview, exported, label);
    }
  });

  test("attachment counts, footer modes and individual contact toggles never lose content silently", async ({
    page,
  }) => {
    // This case validates the generic editable header/footer modes. Modern owns
    // a deliberately fixed mirrored compact cap/footer, so use a neutral
    // template whose chrome remains fully user-selectable.
    const attachmentCases = [
      {
        label: "none",
        data: { showBeilagen: false, beilagen: [] },
        design: { template: "serioes", headerMode: "none", footerMode: "attachments" },
        expectedAttachments: 0,
      },
      {
        label: "one",
        data: { showBeilagen: true, beilagen: ["Lebenslauf"] },
        design: {
          template: "serioes",
          headerMode: "contact",
          footerMode: "attachments",
          headerShowPhone: false,
        },
        expectedAttachments: 1,
      },
      {
        label: "many",
        data: {
          showBeilagen: true,
          beilagen: [
            "Lebenslauf",
            "Zeugnis 1. Semester",
            "Zeugnis 2. Semester",
            "Schnupperlehrbericht",
            "Stellwerkprofil",
            "Kursbestätigung Robotik",
            "Arbeitsprobe Informatik",
            "Referenzschreiben Schule",
          ],
        },
        design: {
          template: "serioes",
          headerMode: "contact",
          footerMode: "attachments",
          headerShowName: false,
          headerShowAddress: true,
          headerShowPhone: true,
          headerShowEmail: false,
        },
        expectedAttachments: 8,
      },
    ] as const;

    for (const scenario of attachmentCases) {
      const { preview, exported, download } = await seedLetter(
        page,
        payload({ data: scenario.data, design: scenario.design }),
      );
      await expect(preview).toHaveAttribute(
        "data-letter-requested-footer-mode",
        scenario.design.footerMode,
      );
      const footerItems = preview.locator(
        "[data-letter-footer-attachments] [data-letter-pdf-text='attachments-body'] > div > div",
      );
      await expect(footerItems).toHaveCount(scenario.expectedAttachments);

      const problems = await geometryProblems(exported);
      if (problems.length === 0) {
        await expectHealthy(preview, exported, `attachments-${scenario.label}`);
        continue;
      }

      expect(scenario.label).toBe("many");
      expect(problems.some((problem) => problem.includes("footer"))).toBe(true);
      await download.click();
      const pdfButton = page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/ });
      if (await pdfButton.isDisabled()) {
        await expect(page.getByRole("alert")).toContainText("Zu viel Text für eine Seite");
      } else {
        await pdfButton.click();
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "Motivationsschreiben passt nicht auf eine Seite" }),
        ).toBeVisible({ timeout: 15_000 });
      }
    }
  });

  test("rich text and boundary-near square-wrap images remain visible without silent clipping", async ({
    page,
  }) => {
    const richTextHtml =
      "<p><strong>Die Informatik begeistert mich</strong>, weil ich gerne logisch denke.</p><p>Ich freue mich auf ein persönliches Gespräch.</p>";
    const { preview, exported } = await seedLetter(
      page,
      payload({
        richTextHtml,
        data: {
          images: [
            {
              id: "boundary-image",
              src: IMAGE,
              widthMm: 31,
              align: "right",
              wrap: "square",
              offsetXMm: -1,
              offsetYMm: 0,
            },
          ],
        },
      }),
    );

    await expect(preview.locator("strong")).toContainText("Die Informatik begeistert mich");
    await expect(preview.locator("[data-letter-flow-image]")).toBeVisible();
    await expectHealthy(preview, exported, "rich text and square-wrap image");
  });

  test("deliberately long content paginates safely instead of clipping", async ({ page }) => {
    const { exported } = await seedLetter(page, payload({ body: HUGE_BODY }));

    await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const overflow = await exported.evaluateAll((pages) =>
      pages.some((pageEl) => {
        const textLayer = pageEl.querySelector<HTMLElement>("[data-letter-text-layer]");
        return !!textLayer && textLayer.scrollHeight > textLayer.clientHeight + 1;
      }),
    );
    expect(overflow).toBe(false);

    const button = await clickDownloadPdf(page);
    await expect(button).toBeEnabled();
  });
});
