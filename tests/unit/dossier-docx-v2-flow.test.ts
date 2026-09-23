import { describe, expect, test } from "bun:test";
import { DEFAULT_CV_PHOTO_PLACEMENT } from "../../src/components/cv/photo-place";
import { DEFAULT_CV_PLACEMENTS, DEMO_CV, type CvDesign } from "../../src/components/cv/types";
import { emptyLetterDesign, DEMO_LETTER } from "../../src/components/letter/types";
import { DEFAULT_DOSSIER_PHOTO_STYLE } from "../../src/lib/dossier-photo";
import { writeStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import { applyDossierDocxV2FlowToDocx } from "../../src/lib/dossier-docx-v2-flow-package";
import { auditDossierDocxV2Flow } from "../../src/lib/dossier-docx-v2-flow-qa";
import { patchDossierDocxV2CorePropertiesXml } from "../../src/lib/dossier-docx-v2-metadata";
import {
  calibrateDossierDocxV2CvFlowScene,
  calibrateDossierDocxV2LetterFlowScene,
} from "../../src/lib/dossier-docx-v2-flow-calibration";
import type {
  DossierDocxV2MeasuredCv,
  DossierDocxV2MeasuredLetter,
} from "../../src/lib/dossier-docx-v2-flow-browser";
import {
  buildDossierDocxV2CvFlowScene,
  buildDossierDocxV2LetterFlowScene,
  type DossierDocxV2CvFlowOptions,
} from "../../src/lib/dossier-docx-v2-flow-scene";
import type { CvPdfDocument, LetterPdfDocument } from "../../src/lib/dossier-pdf-document";

const encoder = new TextEncoder();

function letter(): LetterPdfDocument {
  return {
    data: { ...DEMO_LETTER },
    design: {
      ...emptyLetterDesign(),
      template: "brief",
      colors: { bg: "#ffffff", ink: "#111111", primary: "#111111", accent: "#111111" },
      font: "freundlich",
      footerMode: "compact",
    },
  };
}

function cvDesign(): CvDesign {
  return {
    template: "brief",
    colors: { bg: "#ffffff", ink: "#111111", primary: "#1d4ed8", accent: "#1d4ed8" },
    bgOpacity: 0.25,
    useElements: false,
  };
}

function cv(data = DEMO_CV): CvPdfDocument {
  return {
    data: structuredClone(data),
    design: cvDesign(),
    elements: [],
    elementStyles: {},
    coverFingerprint: null,
  };
}

const cvOptions: DossierDocxV2CvFlowOptions = {
  layout: "classic",
  placements: { ...DEFAULT_CV_PLACEMENTS },
  infoPosition: "standard",
  sectionGapMm: null,
  photoStyle: { ...DEFAULT_DOSSIER_PHOTO_STYLE },
  photoPlacement: { ...DEFAULT_CV_PHOTO_PLACEMENT },
};

function minimalPackage(documentXml: string) {
  const entries = [
    { name: "[Content_Types].xml", bytes: encoder.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>') },
    { name: "word/document.xml", bytes: encoder.encode(documentXml) },
    { name: "word/_rels/document.xml.rels", bytes: encoder.encode('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>') },
  ];
  return new Blob([writeStoredDocxEntries(entries)]);
}

function syntheticDocumentXml() {
  return '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml"><w:body>' +
    '<w:p><w:r><w:t>COVER OLD</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>' +
    '<w:p><w:r><w:t>LETTER OLD</w:t></w:r></w:p>' +
    '<w:p><w:r><w:pict><v:rect style="position:absolute;z-index:-251658240" fillcolor="#eeeeee"/></w:pict></w:r></w:p>' +
    '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr></w:p>' +
    '<w:p><w:r><w:t>CV OLD</w:t></w:r></w:p>' +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>' +
    '</w:body></w:document>';
}

describe("DOCX V2 semantic Letter/CV flow foundation", () => {
  test("builds the letter from semantic content instead of a Warm text skeleton", () => {
    const scene = buildDossierDocxV2LetterFlowScene(letter());
    const ids = scene.blocks.flatMap((block) => (block.kind === "paragraph" && block.id ? [block.id] : []));
    expect(ids).toContain("sender");
    expect(ids).toContain("date");
    expect(ids).toContain("subject");
    expect(ids).toContain("salutation");
    expect(ids).toContain("closing");
    expect(ids).toContain("signature");
    expect(scene.issues.filter((issue) => issue.severity === "blocker")).toHaveLength(0);
  });

  test("honours explicit CV page assignment and half-width flow grouping", () => {
    const data = structuredClone(DEMO_CV);
    data.sectionLayouts = {
      schule: { page: 2 },
      hobbys: { width: "half" },
      staerken: { width: "half" },
    };
    const scene = buildDossierDocxV2CvFlowScene(cv(data), cvOptions);
    expect(scene.blocks.some((block) => block.kind === "page-break" && block.id === "cv-page-2")).toBe(true);
    expect(
      scene.blocks.some(
        (block) => block.kind === "table" && block.id?.startsWith("half-pair-hobbys-staerken"),
      ),
    ).toBe(true);
  });

  test("fails closed for user-owned CV geometry that V2 cannot preserve yet", () => {
    const data = structuredClone(DEMO_CV);
    data.sectionLayouts = { schule: { positioning: "free", x: 30, y: 80 } };
    const cvScene = buildDossierDocxV2CvFlowScene(cv(data), cvOptions);
    const report = auditDossierDocxV2Flow(buildDossierDocxV2LetterFlowScene(letter()), cvScene);
    expect(report.accepted).toBe(false);
    expect(report.blockers.some((issue) => issue.code === "cv-free-section-unsupported")).toBe(true);
  });

  test("replaces only semantic letter/CV bodies while preserving section boundaries and skin", async () => {
    const letterScene = buildDossierDocxV2LetterFlowScene(letter());
    const cvScene = buildDossierDocxV2CvFlowScene(cv(), cvOptions);
    const result = await applyDossierDocxV2FlowToDocx(minimalPackage(syntheticDocumentXml()), {
      letter: letterScene,
      cv: cvScene,
    });
    const bytes = new Uint8Array(await result.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("COVER OLD");
    expect(text).not.toContain("LETTER OLD");
    expect(text).not.toContain("CV OLD");
    expect(text).toContain("Bewerbung um eine Lehrstelle als Informatiker");
    expect(text).toContain("Lea");
    expect(text).toContain('z-index:-251658240');
  });

  test("removes Warm metadata identity from non-Warm V2 packages", () => {
    const core =
      '<?xml version="1.0"?><cp:coreProperties xmlns:cp="urn:cp" xmlns:dc="urn:dc"><dc:title>Bewerbungsdossier – Warm</dc:title><dc:subject>Lehrstellenbewerbung</dc:subject></cp:coreProperties>';
    const patched = patchDossierDocxV2CorePropertiesXml(core, { template: "neon" } as never);
    expect(patched).toContain("Bewerbungsdossier – Neon");
    expect(patched).not.toContain("Bewerbungsdossier – Warm");
  });

  test("keeps V2 flow strictly behind the shadow preview entry point", async () => {
    const productionSource = await Bun.file("src/lib/dossier-docx-export.ts").text();
    const previewSource = await Bun.file("src/lib/dossier-docx-v2-preview.ts").text();
    expect(productionSource).not.toContain("dossier-docx-v2-flow");
    expect(previewSource).toContain("createDossierDocxV2FlowPreviewBlob");
  });
});

function measuredLetter(pageCount = 2): DossierDocxV2MeasuredLetter {
  return {
    measuredInBrowser: true,
    pageCount,
    issues: [],
    pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
      pageIndex,
      finalPage: pageIndex === pageCount - 1,
      contentBox: null,
      bodyBlocks: [
        {
          kind: "paragraph" as const,
          id: `body-measured-p${pageIndex + 1}-1`,
          runs: [
            {
              text: pageIndex === 0 ? "Browser Absatz A" : "Browser Absatz B",
              font: "Arial",
              fontSizePt: 10.5,
              color: "#111111",
              bold: false,
              italic: false,
              underline: false,
            },
          ],
          align: "both" as const,
          beforeMm: 0,
          afterMm: 1,
          lineHeight: 1.55,
        },
      ],
      text:
        pageIndex === 0
          ? [
              {
                semantic: "subject",
                text: DEMO_LETTER.betreff,
                style: {
                  font: "Arial",
                  fontSizePt: 13,
                  color: "#123456",
                  bold: true,
                  italic: false,
                  underline: false,
                },
                align: "right" as const,
                lineHeight: 1.08,
              },
            ]
          : [],
    })),
  };
}

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7WZsAAAAASUVORK5CYII=";

function measuredCv(
  pageCount = 1,
  layout: "classic" | "modern" = "classic",
  page2Boundary = "",
): DossierDocxV2MeasuredCv {
  return {
    measuredInBrowser: true,
    pageCount,
    layout,
    pages: Array.from({ length: pageCount }, (_, pageIndex) => ({
      pageIndex,
      mainRows: pageIndex === 1 && page2Boundary ? [page2Boundary] : [],
      overlays:
        layout === "modern"
          ? [
              {
                id: `cv-sidebar-p${pageIndex + 1}`,
                pageIndex,
                role: "sidebar" as const,
                x: 0,
                y: 34,
                width: 58,
                height: 245,
                background: "#eef2ff",
                insetMm: { top: 9, right: 7, bottom: 10, left: 8 },
                blocks: [
                  {
                    kind: "paragraph" as const,
                    id: `cv-sidebar-p${pageIndex + 1}-1`,
                    runs: [
                      {
                        text: pageIndex === 0 ? "Kontakt" : "Sprachen",
                        font: "Arial",
                        fontSizePt: 9.5,
                        color: "#1d4ed8",
                        bold: true,
                        italic: false,
                        underline: false,
                      },
                    ],
                    align: "left" as const,
                    beforeMm: 0,
                    afterMm: 0,
                    lineHeight: 1.2,
                  },
                ],
              },
              {
                id: `cv-main-p${pageIndex + 1}`,
                pageIndex,
                role: "main" as const,
                x: 67,
                y: 34,
                width: 123,
                height: 245,
                background: null,
                insetMm: { top: 0, right: 0, bottom: 0, left: 0 },
                blocks: [
                  {
                    kind: "paragraph" as const,
                    id: `cv-main-p${pageIndex + 1}-1`,
                    runs: [
                      {
                        text: pageIndex === 0 ? "Lea Müller" : "Schulbildung",
                        font: "Arial",
                        fontSizePt: 12,
                        color: "#111111",
                        bold: true,
                        italic: false,
                        underline: false,
                      },
                    ],
                    align: "left" as const,
                    beforeMm: 0,
                    afterMm: 0,
                    lineHeight: 1.1,
                  },
                ],
              },
            ]
          : [],
    })),
    artwork: Array.from({ length: pageCount }, (_, pageIndex) => ({
      pageIndex,
      dataUrl: ONE_PIXEL_PNG,
      x: 0,
      y: 0,
      width: 210,
      height: 297,
    })),
    layoutWarnings: [],
    issues: [],
    photo: {
      pageIndex: 0,
      x: 151.25,
      y: 27.5,
      width: 31.75,
      height: 39.7,
      borderWidth: 0.4,
      borderColor: "#234567",
    },
  };
}

describe("DOCX V2 browser-measured flow calibration", () => {
  test("replaces heuristic letter body pagination with measured LetterDocument fragments", () => {
    const baseline = buildDossierDocxV2LetterFlowScene(letter());
    const calibrated = calibrateDossierDocxV2LetterFlowScene(baseline, measuredLetter(2));
    const bodyIds = calibrated.blocks.flatMap((block) => (block.id?.startsWith("body-") ? [block.id] : []));
    expect(bodyIds).toEqual(["body-measured-p1-1", "body-measured-p2-1"]);
    expect(
      calibrated.blocks.some(
        (block) => block.kind === "page-break" && block.id === "letter-browser-page-2",
      ),
    ).toBe(true);
    const subject = calibrated.blocks.find(
      (block) => block.kind === "paragraph" && block.id === "subject",
    );
    expect(subject).toMatchObject({ align: "right", lineHeight: 1.08 });
    if (!subject || subject.kind !== "paragraph") throw new Error("subject missing");
    expect(subject.runs[0]).toMatchObject({ fontSizePt: 13, color: "#123456", font: "Arial" });
  });

  test("uses the real CvCanvas photo rectangle instead of the auto-placement approximation", () => {
    const data = structuredClone(DEMO_CV);
    data.person.foto = "data:image/png;base64,iVBORw0KGgo=";
    const baseline = buildDossierDocxV2CvFlowScene(cv(data), {
      ...cvOptions,
      photoPlacement: { ...cvOptions.photoPlacement, mode: "auto" },
    });
    expect(baseline.issues.some((issue) => issue.code === "cv-photo-auto-placement-approximate")).toBe(true);
    const calibrated = calibrateDossierDocxV2CvFlowScene(baseline, measuredCv(1));
    expect(calibrated.issues.some((issue) => issue.code === "cv-photo-auto-placement-approximate")).toBe(false);
    expect(calibrated.photo).toMatchObject({
      x: 151.25,
      y: 27.5,
      width: 31.75,
      height: 39.7,
      borderWidth: 0.4,
      borderColor: "#234567",
    });
  });

  test("moves a classic CV page break to the browser-measured row boundary", () => {
    const baseline = buildDossierDocxV2CvFlowScene(cv(), cvOptions);
    const calibrated = calibrateDossierDocxV2CvFlowScene(
      baseline,
      measuredCv(2, "classic", "Schulbildung"),
    );
    expect(
      calibrated.blocks.some(
        (block) => block.kind === "page-break" && block.id === "cv-browser-page-2",
      ),
    ).toBe(true);
    expect(calibrated.issues.some((issue) => issue.code === "cv-browser-pagination-mismatch")).toBe(
      false,
    );
  });

  test("replaces Modern/sidebar heuristics with page-bound browser overlays", () => {
    const baseline = buildDossierDocxV2CvFlowScene(cv(), {
      ...cvOptions,
      layout: "modern",
    });
    const calibrated = calibrateDossierDocxV2CvFlowScene(baseline, measuredCv(2, "modern"));
    expect(calibrated.issues.some((issue) => issue.code === "cv-browser-pagination-mismatch")).toBe(false);
    expect(calibrated.overlays).toHaveLength(4);
    expect(calibrated.artwork).toHaveLength(2);
    expect(calibrated.artwork[1]).toMatchObject({ pageIndex: 1, width: 210, height: 297 });
    expect(calibrated.overlays[0]).toMatchObject({
      role: "sidebar",
      pageIndex: 0,
      x: 0,
      y: 34,
      width: 58,
      background: "#eef2ff",
    });
    expect(
      calibrated.blocks.some(
        (block) => block.kind === "page-break" && block.id === "cv-browser-page-2",
      ),
    ).toBe(true);
  });

  test("renders browser-measured Modern overlays on their physical Word pages", async () => {
    const letterScene = buildDossierDocxV2LetterFlowScene(letter());
    const cvScene = calibrateDossierDocxV2CvFlowScene(
      buildDossierDocxV2CvFlowScene(cv(), { ...cvOptions, layout: "modern" }),
      measuredCv(2, "modern"),
    );
    const result = await applyDossierDocxV2FlowToDocx(minimalPackage(syntheticDocumentXml()), {
      letter: letterScene,
      cv: cvScene,
    });
    const xml = new TextDecoder().decode(new Uint8Array(await result.arrayBuffer()));
    expect(xml).toContain('id="docx-v2-flow-cv-sidebar-p1"');
    expect(xml).toContain('id="docx-v2-flow-cv-main-p2"');
    expect(xml).toContain('fillcolor="#EEF2FF"');
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain("DOCX V2 CV artwork page 1");
    expect(xml).toContain("DOCX V2 CV artwork page 2");
    expect(xml).toContain('<w:br w:type="page"/>');
  });
});
