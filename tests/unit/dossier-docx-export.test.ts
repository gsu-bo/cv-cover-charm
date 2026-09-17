import { describe, expect, test } from "bun:test";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
  type CoverPdfDocument,
  type CvPdfDocument,
  type LetterPdfDocument,
} from "../../src/lib/dossier-pdf-document";
import {
  DOSSIER_DOCX_PROFILES,
  createDossierDocxBlob,
  resolveDossierDocxProfile,
} from "../../src/lib/dossier-docx-export";
import {
  DOCX_MIME_TYPE,
  readStoredDocxEntries,
  transformStoredDocxDocumentXml,
  writeStoredDocxEntries,
} from "../../src/lib/dossier-docx-package";
import {
  DOSSIER_DOCX_TEMPLATE_PLANS,
  dossierDocxTemplatesForFamily,
} from "../../src/lib/dossier-docx-family";

function documents(template: string) {
  const palettes: Record<string, Record<string, string>> = {
    brief: {},
    freundlich: {
      primary: "#0f766e",
      secondary: "#f59e0b",
      ink: "#0b1f24",
      bg: "#fff9ef",
    },
    studio3: {
      primary: "#173d3a",
      secondary: "#5ec6b6",
      accent: "#e2a94b",
      ink: "#18302d",
      bg: "#f7fbfa",
    },
  };
  const colors = palettes[template] ?? {
    primary: "#243447",
    secondary: "#c08457",
    accent: "#4da3ff",
    ink: "#1b232c",
    bg: "#fbf8f4",
  };

  const cover = coverPdfDocumentFromSaved({
    version: 3,
    template,
    data: {
      vorname: "Lea",
      nachname: "Müller",
      beruf: "Informatikerin EFZ",
      lehrbeginn: "August 2027",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea@example.ch",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      showBeilagenOnCover: true,
      beilagen: ["Motivationsschreiben", "Lebenslauf", "Zeugnis"],
    },
    colors,
  });
  const letter = letterPdfDocumentFromSaved({
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
    design: { template, font: "freundlich", colors },
  });
  const cv = cvPdfDocumentFromSaved({
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
    design: { template, colors, bgOpacity: 0.25, useElements: false },
  });

  if (!cover || !letter || !cv) throw new Error(`DOCX-Testdokumente fehlen für ${template}.`);
  return { cover, letter, cv };
}

function documentsAs(template: string) {
  const base = documents("modern");
  return {
    cover: { ...base.cover, template } as CoverPdfDocument,
    letter: {
      ...base.letter,
      design: { ...base.letter.design, template },
    } as LetterPdfDocument,
    cv: {
      ...base.cv,
      design: { ...base.cv.design, template },
    } as CvPdfDocument,
  };
}

describe("generic DOCX export profiles", () => {
  test("registry exposes the three reviewed visual models", () => {
    expect(
      DOSSIER_DOCX_PROFILES.map(({ templateId, label, architecture, visualModel }) => ({
        templateId,
        label,
        architecture,
        visualModel,
      })),
    ).toEqual([
      {
        templateId: "brief",
        label: "Brief",
        architecture: "native",
        visualModel: { cover: "plain", letter: "edge-bars", cv: "edge-bars" },
      },
      {
        templateId: "freundlich",
        label: "Warm",
        architecture: "native+polish",
        visualModel: {
          cover: "organic-hero",
          letter: "organic-masthead",
          cv: "banded",
        },
      },
      {
        templateId: "studio3",
        label: "Studio 3",
        architecture: "native+transform+polish",
        visualModel: {
          cover: "editorial-split",
          letter: "two-tone-masthead",
          cv: "two-tone-masthead",
        },
      },
    ]);
  });

  for (const [template, label] of [
    ["brief", "Brief"],
    ["freundlich", "Warm"],
    ["studio3", "Studio 3"],
  ] as const) {
    test(`${label} resolves through the shared registry and creates a real DOCX`, async () => {
      const { cover, letter, cv } = documents(template);
      expect(resolveDossierDocxProfile(cover, letter, cv)?.label).toBe(label);
      const blob = await createDossierDocxBlob(cover, letter, cv);
      expect(blob.type).toBe(DOCX_MIME_TYPE);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      expect(readStoredDocxEntries(bytes).some((entry) => entry.name === "word/document.xml")).toBe(
        true,
      );
    });
  }

  test("mixed template families remain unsupported", () => {
    const brief = documents("brief");
    const warm = documents("freundlich");
    expect(resolveDossierDocxProfile(brief.cover, warm.letter, brief.cv)).toBeNull();
  });
});

describe("DOCX family fallback coverage", () => {
  test("classifies all 39 selectable templates with an individual safety valve", () => {
    expect(Object.keys(DOSSIER_DOCX_TEMPLATE_PLANS)).toHaveLength(39);
    expect(
      Object.values(DOSSIER_DOCX_TEMPLATE_PLANS).every((plan) => plan.fallback === "individual"),
    ).toBe(true);
    expect(DOSSIER_DOCX_TEMPLATE_PLANS.warm4).toBeUndefined();
    expect(DOSSIER_DOCX_TEMPLATE_PLANS.warm5).toBeUndefined();
  });

  test("keeps every geometry family populated", () => {
    for (const family of [
      "plain",
      "editorial-frame",
      "side-rail",
      "masthead",
      "banded",
      "geometric",
      "gradient",
    ] as const) {
      expect(dossierDocxTemplatesForFamily(family).length).toBeGreaterThan(0);
    }
  });

  test("all 39 template plans resolve and produce structurally valid DOCX packages", async () => {
    for (const [templateId, plan] of Object.entries(DOSSIER_DOCX_TEMPLATE_PLANS)) {
      const docs = documentsAs(templateId);
      const profile = resolveDossierDocxProfile(docs.cover, docs.letter, docs.cv);
      expect(profile?.label).toBe(plan.label);
      const blob = await createDossierDocxBlob(docs.cover, docs.letter, docs.cv);
      expect(blob.type).toBe(DOCX_MIME_TYPE);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
      const entries = readStoredDocxEntries(bytes);
      expect(entries.some((entry) => entry.name === "word/document.xml")).toBe(true);
      expect(entries.some((entry) => entry.name === "word/styles.xml")).toBe(true);
    }
  });
});

describe("shared stored-DOCX transform core", () => {
  test("round-trips package entries while replacing editable document XML", async () => {
    const original = new Blob(
      [
        writeStoredDocxEntries([
          {
            name: "word/document.xml",
            bytes: new TextEncoder().encode("<w:document>ALT</w:document>"),
          },
          {
            name: "word/styles.xml",
            bytes: new TextEncoder().encode("<w:styles/>"),
          },
        ]),
      ],
      { type: DOCX_MIME_TYPE },
    );

    const transformed = await transformStoredDocxDocumentXml(
      original,
      (xml) => xml.replace("ALT", "NEU"),
      "Test-DOCX",
    );
    const entries = readStoredDocxEntries(new Uint8Array(await transformed.arrayBuffer()));
    const document = entries.find((entry) => entry.name === "word/document.xml");
    const styles = entries.find((entry) => entry.name === "word/styles.xml");

    expect(new TextDecoder().decode(document?.bytes)).toBe("<w:document>NEU</w:document>");
    expect(new TextDecoder().decode(styles?.bytes)).toBe("<w:styles/>");
  });
});

describe("resolved Word section chrome", () => {
  test("explicit modes preserve contact visibility, neutral borders and attachments", async () => {
    const { applyDossierChromeToDocx } = await import("../../src/lib/dossier-docx-chrome");
    const { resolveDossierChromeSnapshot } = await import("../../src/lib/dossier-resolved-chrome");
    const { DEFAULT_DOSSIER_CHROME_STATE } = await import("../../src/lib/dossier-chrome");
    const docs = documents("brief");
    const source = await resolveDossierDocxProfile(docs.cover, docs.letter, docs.cv)!.createBlob(
      docs,
    );
    for (const mode of ["none", "compact", "contact"] as const) {
      const state = structuredClone(DEFAULT_DOSSIER_CHROME_STATE);
      for (const scope of ["shared", "letter", "cv"] as const) {
        Object.assign(state[scope], {
          headerMode: mode,
          headerShowName: false,
          headerShowAddress: false,
          footerMode: mode === "contact" ? "details" : mode,
        });
      }
      const output = await applyDossierChromeToDocx(
        source,
        docs,
        resolveDossierChromeSnapshot(docs, state),
      );
      const entries = readStoredDocxEntries(new Uint8Array(await output.arrayBuffer()));
      const xml = (name: string) =>
        new TextDecoder().decode(entries.find((entry) => entry.name === name)!.bytes);
      const header = xml("word/header-letter-first.xml");
      expect(header.includes("<v:rect")).toBe(mode !== "none");
      expect(header.includes("lea@example.ch")).toBe(mode === "contact");
      expect(header).not.toContain("Lea Müller");
      expect(header).not.toContain("Dorfstrasse");
      expect(xml("word/footer-letter-first.xml")).not.toContain("Beilagen");
      expect(xml("word/document.xml").includes("semantic-footer-final")).toBe(mode === "contact");
      expect(xml("word/document.xml")).toContain("Beilagen");
      expect(xml("word/document.xml")).not.toContain("<w:pgBorders");
      if (process.env.DOCX_CHROME_QA_DIR)
        await Bun.write(`${process.env.DOCX_CHROME_QA_DIR}/brief-${mode}.docx`, output);
    }
  });

  test("Warm recipe surfaces follow resolved modes while native continuation chrome remains", async () => {
    const { applyDossierChromeToDocx } = await import("../../src/lib/dossier-docx-chrome");
    const { resolveDossierChromeSnapshot } = await import("../../src/lib/dossier-resolved-chrome");
    const { DEFAULT_DOSSIER_CHROME_STATE } = await import("../../src/lib/dossier-chrome");
    const docs = documents("freundlich");
    const source = await resolveDossierDocxProfile(docs.cover, docs.letter, docs.cv)!.createBlob(
      docs,
    );
    for (const mode of ["none", "compact", "contact"] as const) {
      const state = structuredClone(DEFAULT_DOSSIER_CHROME_STATE);
      for (const scope of ["shared", "letter", "cv"] as const) {
        Object.assign(state[scope], { headerMode: mode, footerMode: "none" });
      }
      const output = await applyDossierChromeToDocx(
        source,
        docs,
        resolveDossierChromeSnapshot(docs, state),
      );
      const entries = readStoredDocxEntries(new Uint8Array(await output.arrayBuffer()));
      const xml = (name: string) =>
        new TextDecoder().decode(entries.find((entry) => entry.name === name)!.bytes);
      const documentXml = xml("word/document.xml");
      expect(documentXml.includes('id="warm-letter-masthead"')).toBe(mode !== "none");
      expect(documentXml.includes('id="warm-cv-top-band"')).toBe(mode !== "none");
      expect(documentXml).not.toContain('id="warm-letter-footer"');
      expect(documentXml).not.toContain('id="warm-cv-bottom-band"');
      expect(xml("word/header-letter-first.xml").includes("<v:rect")).toBe(mode === "contact");
      expect(xml("word/header-letter-default.xml").includes("<v:rect")).toBe(mode !== "none");
      if (process.env.DOCX_WARM_CHROME_QA_DIR) {
        await Bun.write(`${process.env.DOCX_WARM_CHROME_QA_DIR}/warm-${mode}.docx`, output);
      }
    }
  });
});

test("Word Sidebar preserves editable content while populating the side column", async () => {
  const { applyDossierDocxSidebar } = await import("../../src/lib/dossier-docx-layout");
  const { DEFAULT_CV_PLACEMENTS } = await import("../../src/components/cv/types");
  const docs = documents("terracotta");
  const source = await resolveDossierDocxProfile(docs.cover, docs.letter, docs.cv)!.createBlob(
    docs,
  );
  const output = await applyDossierDocxSidebar(source, docs.cv, DEFAULT_CV_PLACEMENTS);
  const documentXml = async (blob: Blob) =>
    new TextDecoder().decode(
      readStoredDocxEntries(new Uint8Array(await blob.arrayBuffer())).find(
        (entry) => entry.name === "word/document.xml",
      )!.bytes,
    );
  const before = await documentXml(source),
    after = await documentXml(output);
  const words = (xml: string) =>
    [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).sort();
  expect(words(after)).toEqual(words(before));
  const cv = after.slice(after.indexOf('id="terracotta-cv-column"'));
  expect(cv.indexOf("SPRACHEN")).toBeLessThan(cv.indexOf("SCHULBILDUNG"));
  expect(cv).toContain("Dorfstrasse 12");
  if (process.env.DOCX_SIDEBAR_QA_DIR)
    await Bun.write(`${process.env.DOCX_SIDEBAR_QA_DIR}/kolumne.docx`, output);
});

test("Word details footer keeps attachments on the final flowed letter page", async () => {
  const { applyDossierChromeToDocx } = await import("../../src/lib/dossier-docx-chrome");
  const { resolveDossierChromeSnapshot } = await import("../../src/lib/dossier-resolved-chrome");
  const { DEFAULT_DOSSIER_CHROME_STATE } = await import("../../src/lib/dossier-chrome");
  const docs = documents("brief");
  docs.letter.data.text = Array.from(
    { length: 35 },
    (_, index) =>
      `Abschnitt ${index + 1}. Die Informatik begeistert mich. Ich arbeite gerne im Team und freue mich auf Ihre Rückmeldung.`,
  ).join("\n\n");
  docs.letter.data.beilagen = ["QA-FINAL-ATTACHMENT"];
  const state = structuredClone(DEFAULT_DOSSIER_CHROME_STATE);
  for (const scope of ["shared", "letter", "cv"] as const) {
    Object.assign(state[scope], { headerMode: "contact", footerMode: "details" });
  }
  const source = await resolveDossierDocxProfile(docs.cover, docs.letter, docs.cv)!.createBlob(
    docs,
  );
  const output = await applyDossierChromeToDocx(
    source,
    docs,
    resolveDossierChromeSnapshot(docs, state),
  );
  const entries = readStoredDocxEntries(new Uint8Array(await output.arrayBuffer()));
  const xml = (name: string) =>
    new TextDecoder().decode(entries.find((entry) => entry.name === name)!.bytes);
  expect(xml("word/document.xml")).toContain("QA-FINAL-ATTACHMENT");
  expect(xml("word/footer-letter-first.xml")).not.toContain("QA-FINAL-ATTACHMENT");
  expect(xml("word/footer-letter-default.xml")).not.toContain("QA-FINAL-ATTACHMENT");
  expect(xml("word/footer-letter-default.xml")).toContain("semantic-footer");
  if (process.env.DOCX_CONTINUATION_QA_DIR) {
    await Bun.write(`${process.env.DOCX_CONTINUATION_QA_DIR}/brief-long.docx`, output);
  }
});
