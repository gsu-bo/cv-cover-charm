import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const SHADOW_ARTIFACT_DIR = "artifacts/dossier-docx-v2-shadow";

const COLORS = {
  freundlich: {
    primary: "#0f766e",
    secondary: "#f59e0b",
    accent: "#f59e0b",
    ink: "#0b1f24",
    bg: "#fff9ef",
  },
  neon: {
    primary: "#e11d8f",
    secondary: "#7c3aed",
    accent: "#f59e0b",
    ink: "#f8fafc",
    bg: "#0d0b2b",
  },
} as const;

type Template = keyof typeof COLORS;

type ShadowResult = {
  size: number;
  documentXml: string;
  coreXml: string;
  mediaNames: string[];
  pageBreakCount: number;
  base64: string;
};

async function seed(page: import("@playwright/test").Page, template: Template, long = false) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ template, colors, long }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem(
        "titelblatt:v3",
        JSON.stringify({
          version: 3,
          template,
          data: {
            eyebrow: "Bewerbung",
            kicker: "Bewerbung um eine Lehrstelle als",
            vorname: "Lea",
            nachname: "Müller",
            beruf: "Informatikerin EFZ",
            lehrbeginn: "August 2027",
            adresse: "Dorfstrasse 12",
            plzOrt: "4535 Hubersdorf",
            telefon: "+41 79 123 45 67",
            email: "lea@example.ch",
            geburtsdatum: "14.03.2010",
            lehrbetrieb: "Beispiel AG",
            ansprechperson: "Herr Thomas Weber",
            betriebAdresse: "Industriestrasse 8",
            ort: "Hubersdorf",
            datum: "15.11.2026",
            showBeilagenOnCover: true,
            beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
          },
          colors: { [template]: colors },
          layout: {},
          customs: [],
        }),
      );

      const longParagraphs = Array.from({ length: 22 }, (_, index) =>
        `Absatz ${index + 1}: Die Informatik begeistert mich, weil ich gerne logisch denke, Probleme löse und neue Lösungen sorgfältig umsetze.`,
      ).join("\n\n");
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
            text: long
              ? longParagraphs
              : "Die Informatik begeistert mich.\n\nIch freue mich auf Ihre Rückmeldung.",
            richTextHtml: "",
            gruss: "Freundliche Grüsse",
            unterschrift: "Lea Müller",
            images: [],
            showBeilagen: true,
            beilagen: ["Lebenslauf", "Zeugnis"],
          },
          design: {
            template,
            colors,
            font: "freundlich",
            fontOverride: null,
          },
        }),
      );

      const school = Array.from({ length: long ? 13 : 2 }, (_, index) => ({
        id: `schule-${index + 1}`,
        zeit: `${2026 - index} – ${2027 - index}`,
        titel: `Schule / Projekt ${index + 1}`,
        ort: "Hubersdorf",
        beschreibung:
          "Schwerpunkt Informatik, Mathematik und selbstständiges Arbeiten an längeren Aufgaben.",
      }));
      const experience = Array.from({ length: long ? 9 : 1 }, (_, index) => ({
        id: `praxis-${index + 1}`,
        zeit: `202${index % 7}`,
        titel: `Schnupperlehre ${index + 1}`,
        ort: "Beispiel AG",
        beschreibung: "Support, Webentwicklung und Dokumentation im Team.",
      }));
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
            schule: school,
            erfahrung: experience,
            sprachen: [
              { id: "sprache-1", name: "Deutsch", niveau: "Muttersprache" },
              { id: "sprache-2", name: "Englisch", niveau: "B1" },
            ],
            hobbys: ["Programmieren", "Volleyball"],
            staerken: ["Zuverlässig", "Teamfähig", "Lernbereit"],
            referenzen: [],
            customSections: [],
            labels: {},
            hidden: {},
            sectionLayouts: {},
          },
          design: {
            template,
            colors,
            bgOpacity: 0.25,
            useElements: false,
          },
          elements: [],
          elementStyles: {},
        }),
      );
    },
    { template, colors: COLORS[template], long },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}

async function generateShadow(page: import("@playwright/test").Page): Promise<ShadowResult> {
  return page.evaluate(async () => {
    const documentModule = await import("/src/lib/dossier-pdf-document.ts");
    const previewModule = await import("/src/lib/dossier-docx-v2-preview.ts");
    const packageModule = await import("/src/lib/dossier-docx-package.ts");

    const cover = documentModule.coverPdfDocumentFromSaved(
      JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null"),
    );
    const letter = documentModule.letterPdfDocumentFromSaved(
      JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null"),
    );
    const cv = documentModule.cvPdfDocumentFromSaved(
      JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null"),
    );
    if (!cover || !letter || !cv) throw new Error("DOCX V2 shadow fixture incomplete");

    const blob = await previewModule.createDossierDocxV2FlowPreviewBlob(cover, letter, cv);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const entries = packageModule.readStoredDocxEntries(bytes, "DOCX V2 E2E");
    const decoder = new TextDecoder();
    const text = (name: string) => {
      const entry = entries.find((candidate) => candidate.name === name);
      return entry ? decoder.decode(entry.bytes) : "";
    };
    const documentXml = text("word/document.xml");
    const coreXml = text("docProps/core.xml");
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return {
      size: blob.size,
      documentXml,
      coreXml,
      mediaNames: entries
        .map((entry) => entry.name)
        .filter((name) => name.startsWith("word/media/docx-v2-flow-cv-artwork-p")),
      pageBreakCount: (documentXml.match(/<w:br w:type="page"\/>/g) ?? []).length,
      base64: btoa(binary),
    };
  });
}

async function saveShadow(result: ShadowResult, fileName: string) {
  await mkdir(SHADOW_ARTIFACT_DIR, { recursive: true });
  await writeFile(`${SHADOW_ARTIFACT_DIR}/${fileName}`, Buffer.from(result.base64, "base64"));
}

test.describe("DOCX V2 shadow browser contract", () => {
  test.setTimeout(120_000);

  test("Warm produces a real V2 shadow DOCX artifact", async ({ page }) => {
    await seed(page, "freundlich");
    const result = await generateShadow(page);
    await saveShadow(result, "warm-shadow.docx");
    expect(result.size).toBeGreaterThan(2_000);
    expect(result.documentXml).toContain("docx-v2-");
    expect(result.documentXml).toContain("Lea");
    expect(result.coreXml).toContain("Bewerbungsdossier – Warm");
  });

  test("Neon is rebuilt by V2 without leaking Warm package identity", async ({ page }) => {
    await seed(page, "neon");
    const result = await generateShadow(page);
    await saveShadow(result, "neon-shadow.docx");
    expect(result.size).toBeGreaterThan(2_000);
    expect(result.documentXml).toContain("docx-v2-");
    expect(result.documentXml).toContain("Lea");
    expect(result.coreXml).toContain("Bewerbungsdossier – Neon");
    expect(result.coreXml).not.toContain("Bewerbungsdossier – Warm");
  });

  test("measured multi-page Letter/CV emits explicit browser-derived Word page breaks", async ({ page }) => {
    await seed(page, "freundlich", true);
    const result = await generateShadow(page);
    await saveShadow(result, "warm-long-shadow.docx");
    expect(result.size).toBeGreaterThan(2_000);
    expect(result.pageBreakCount).toBeGreaterThanOrEqual(2);
    expect(result.documentXml).toContain("Absatz 1:");
    expect(result.documentXml).toContain("Schule / Projekt 13");
  });

  test("Modern half-width CV grid stays two-column and owns its browser artwork layer", async ({ page }) => {
    await seed(page, "freundlich");
    await page.evaluate(() => {
      localStorage.setItem("lebenslauf:layout:v1", "modern");
      localStorage.setItem(
        "lebenslauf:placement:v1",
        JSON.stringify({
          kontakt: "main",
          schule: "main",
          erfahrung: "main",
          sprachen: "main",
          hobbys: "main",
          staerken: "main",
          referenzen: "main",
        }),
      );
      const cv = JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null");
      cv.data.sectionLayouts = {
        ...cv.data.sectionLayouts,
        schule: { page: 1, width: "half", positioning: "flow" },
        erfahrung: { page: 1, width: "half", positioning: "flow" },
      };
      localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const result = await generateShadow(page);
    await saveShadow(result, "modern-shadow.docx");
    expect(result.documentXml).toContain('id="docx-v2-flow-cv-main-p1"');
    expect(result.documentXml).toContain("<w:tbl>");
    expect(result.documentXml).toContain('w:tcW w:w="2500" w:type="pct"');
    expect(result.documentXml).toContain('behindDoc="1"');
    expect(result.mediaNames.length).toBeGreaterThanOrEqual(1);
  });
});