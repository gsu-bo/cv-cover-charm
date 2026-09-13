import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import { TEMPLATES } from "../../src/components/cover/types";
import { DOSSIER_DOCX_TEMPLATE_PLANS } from "../../src/lib/dossier-docx-family";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";

const BASE_URL = "http://127.0.0.1:4173";
const GALLERY_DIR = process.env.DOCX_GALLERY_DIR ?? "artifacts/dossier-docx-gallery";
const GALLERY_BATCH_SIZE = 4;
const GALLERY_BATCH_COUNT = 10;
const RETIRED_TEMPLATE_IDS = new Set(["edelBlockig", "sonnig", "warm4", "warm5"]);

function paletteFromSlots(slots: readonly { key: string; default: string }[]) {
  return Object.fromEntries(slots.map(({ key, default: value }) => [key, value]));
}

const PRODUCT_TEMPLATES = [
  ...TEMPLATES.filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string)).map(
    (template) => ({
      id: template.id as string,
      name: template.name,
      colors: paletteFromSlots(template.slots),
    }),
  ),
  ...FRESH_TEMPLATE_REGISTRY.filter(
    (template) => !RETIRED_TEMPLATE_IDS.has(template.id as string),
  ).map((template) => ({
    id: template.id,
    name: template.name,
    colors: paletteFromSlots(template.slots),
  })),
  {
    id: "edelDark",
    name: "Edel Dark",
    colors: {
      bg: "#12131a",
      ink: "#f2eee6",
      primary: "#12131a",
      secondary: "#2a2d38",
      accent: "#c9a24a",
    },
  },
];

const PRODUCT_TEMPLATE_BY_ID = new Map(PRODUCT_TEMPLATES.map((template) => [template.id, template]));
const CASES = Object.entries(DOSSIER_DOCX_TEMPLATE_PLANS).map(([id, plan]) => {
  const productTemplate = PRODUCT_TEMPLATE_BY_ID.get(id);
  if (!productTemplate) throw new Error(`DOCX plan ${id} is not an active product template.`);
  return { id, label: plan.label, colors: productTemplate.colors };
});

function galleryBatchIndex(): number | null {
  const raw = process.env.DOCX_GALLERY_BATCH_INDEX;
  if (raw === undefined || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= GALLERY_BATCH_COUNT) {
    throw new Error(
      `Invalid DOCX_GALLERY_BATCH_INDEX=${raw}; expected 0-${GALLERY_BATCH_COUNT - 1}`,
    );
  }
  return value;
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedCompleteDossier(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "titelblatt:v3",
      JSON.stringify({
        version: 3,
        template: "modern",
        data: {
          vorname: "Lea",
          nachname: "Müller",
          beruf: "Informatikerin EFZ",
          lehrbeginn: "August 2027",
          adresse: "Dorfstrasse 12",
          plzOrt: "4535 Hubersdorf",
          telefon: "+41 79 123 45 67",
          email: "lea@example.ch",
          lehrbetrieb: "Beispiel AG",
          ansprechperson: "Herr Thomas Weber",
          betriebAdresse: "Industriestrasse 8",
          ort: "Hubersdorf",
          datum: "15.11.2026",
          showBeilagenOnCover: true,
          beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
        },
        colors: {},
      }),
    );
    localStorage.setItem(
      "anschreiben:v1",
      JSON.stringify({
        version: 1,
        data: {
          absenderName: "Lea Müller",
          absenderAdresse: "Dorfstrasse 12",
          absenderPlzOrt: "4535 Hubersdorf",
          absenderTelefon: "+41 79 123 45 67",
          absenderEmail: "lea@example.ch",
          empfaengerFirma: "Beispiel AG",
          empfaengerName: "Herr Thomas Weber",
          empfaengerAdresse: "Industriestrasse 8",
          empfaengerPlzOrt: "4535 Hubersdorf",
          ort: "Hubersdorf",
          datum: "15.11.2026",
          betreff: "Bewerbung um eine Lehrstelle als Informatikerin EFZ",
          anrede: "Guten Tag Herr Weber",
          text: "Die Informatik begeistert mich.\n\nIch freue mich auf Ihre Rückmeldung.",
          gruss: "Freundliche Grüsse",
          unterschrift: "Lea Müller",
          showBeilagen: true,
          beilagen: ["Lebenslauf", "Zeugnis"],
        },
        design: { template: "modern", font: "freundlich", colors: {} },
      }),
    );
    localStorage.setItem(
      "lebenslauf:v1",
      JSON.stringify({
        version: 6,
        data: {
          titel: "Lebenslauf",
          person: {
            vorname: "Lea",
            nachname: "Müller",
            adresse: "Dorfstrasse 12",
            plzOrt: "4535 Hubersdorf",
            telefon: "+41 79 123 45 67",
            email: "lea@example.ch",
            geburtsdatum: "14.03.2010",
            nationalitaet: "Schweiz",
            untertitel: "Schülerin, 3. Sek B",
            foto: null,
          },
          schule: [
            {
              id: "schule-1",
              zeit: "2023 – heute",
              titel: "Sekundarschule",
              ort: "Hubersdorf",
              beschreibung: "Sek B",
            },
          ],
          erfahrung: [],
          sprachen: [{ id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" }],
          hobbys: ["Programmieren"],
          staerken: ["Zuverlässig"],
          referenzen: [],
          labels: {},
          hidden: {},
        },
        design: { template: "modern", colors: {}, bgOpacity: 0.25, useElements: false },
      }),
    );
  });
}

async function assertCompleteDocx(path: string) {
  const bytes = await readFile(path);
  expect(bytes.length).toBeGreaterThan(2_000);
  expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);

  const entries = readStoredDocxEntries(bytes);
  expect(entries.some(({ name }) => name === "[Content_Types].xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/document.xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/styles.xml")).toBe(true);
  expect(entries.some(({ name }) => name === "word/_rels/document.xml.rels")).toBe(true);

  const documentEntry = entries.find(({ name }) => name === "word/document.xml");
  expect(documentEntry).toBeDefined();
  const documentXml = new TextDecoder().decode(documentEntry?.bytes);
  expect((documentXml.match(/<w:sectPr(?:\s|>)/g) ?? []).length).toBe(3);
}

test("real browser DOCX gallery exports all 39 active dossier templates", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await seedCompleteDossier(page);
  await mkdir(GALLERY_DIR, { recursive: true });

  const productIds = PRODUCT_TEMPLATES.map(({ id }) => id);
  const planIds = Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS);
  expect(PRODUCT_TEMPLATES).toHaveLength(39);
  expect(new Set(productIds).size).toBe(39);
  expect(CASES).toHaveLength(39);
  expect(new Set(planIds).size).toBe(39);
  expect([...productIds].sort()).toEqual([...planIds].sort());
  for (const retiredId of RETIRED_TEMPLATE_IDS) expect(productIds).not.toContain(retiredId);

  const batchIndex = galleryBatchIndex();
  const batchStart = batchIndex === null ? 0 : batchIndex * GALLERY_BATCH_SIZE;
  const batchEnd =
    batchIndex === null ? CASES.length : Math.min(batchStart + GALLERY_BATCH_SIZE, CASES.length);
  const selectedCases = CASES.slice(batchStart, batchEnd).map((item, offset) => ({
    item,
    globalIndex: batchStart + offset,
  }));

  if (batchIndex !== null) {
    const expectedBatchSize = batchIndex === GALLERY_BATCH_COUNT - 1 ? 3 : 4;
    expect(selectedCases).toHaveLength(expectedBatchSize);
  }

  const manifestEntries: string[] = [];
  for (const { item, globalIndex } of selectedCases) {
    await page.evaluate(({ id, colors }) => {
      const cover = JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null");
      const letter = JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null");
      const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      cover.template = id;
      cover.colors = colors;
      letter.design.template = id;
      letter.design.colors = colors;
      cv.design.template = id;
      cv.design.colors = colors;
      localStorage.setItem("titelblatt:v3", JSON.stringify(cover));
      localStorage.setItem("anschreiben:v1", JSON.stringify(letter));
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    }, item);
    await page.reload({ waitUntil: "domcontentloaded" });

    const button = page.getByRole("button", { name: `Dossier als DOCX · ${item.label}` });
    await expect(button).toBeEnabled({ timeout: 30_000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await button.click();
    const download = await downloadPromise;

    const fileNumber = String(globalIndex + 1).padStart(2, "0");
    const fileName = `${fileNumber}-${safeName(item.label)}.docx`;
    const target = join(GALLERY_DIR, fileName);
    await download.saveAs(target);
    await assertCompleteDocx(target);
    manifestEntries.push(`${fileName} | ${item.id} | ${item.label}`);
  }

  const part = String(batchIndex ?? 0).padStart(2, "0");
  await writeFile(join(GALLERY_DIR, `MANIFEST.part-${part}.txt`), `${manifestEntries.join("\n")}\n`);
});
