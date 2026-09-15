import { describe, expect, test } from "bun:test";
import { TEMPLATES } from "../../src/components/cover/types";
import {
  DOSSIER_FAMILIES,
  familyForTemplate,
  templatesForFamily,
} from "../../src/lib/dossier-family";
import { dossierNameScale, dossierThemeForFamily } from "../../src/lib/dossier-theme";
import {
  DOSSIER_PHOTO_SHAPES,
  dossierPhotoCropStyle,
  dossierPhotoPatchToBlockStyle,
  dossierPhotoRatio,
  normalizeDossierPhotoStyle,
  shapeFromBlockStyle,
} from "../../src/lib/dossier-photo";
import { coverDraftFingerprint, emptyCoverDraft, readCoverPhoto } from "../../src/lib/dossier";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
  cvPdfHasContent,
} from "../../src/lib/dossier-pdf-document";
import { emptyCv } from "../../src/components/cv/types";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  DOSSIER_PROJECT_KIND,
  LETTER_STORAGE_KEY,
  createDossierProject,
  parseDossierProject,
  storeDossierProject,
} from "../../src/lib/dossier-project";

describe("dossier families", () => {
  test("every cover template belongs to exactly one premium family", () => {
    const knownFamilies = new Set(DOSSIER_FAMILIES.map((family) => family.id));

    for (const template of TEMPLATES) {
      expect(knownFamilies.has(familyForTemplate(template.id))).toBe(true);
    }
  });

  test("each family exposes templates and its curated default belongs to that family", () => {
    for (const family of DOSSIER_FAMILIES) {
      const templates = templatesForFamily(family.id);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContain(family.coverTemplate);
    }
  });

  test("family themes expose distinct, production-safe design tokens", () => {
    const themes = DOSSIER_FAMILIES.map((family) => dossierThemeForFamily(family.id));

    for (const theme of themes) {
      expect(theme.typography.fontStack.length).toBeGreaterThan(10);
      expect(theme.typography.bodyLineHeight).toBeGreaterThanOrEqual(1.3);
      expect(theme.lineThicknessMm).toBeGreaterThan(0);
      expect(theme.lineThicknessMm).toBeLessThan(1);
      expect(theme.spacingDensity).toBeGreaterThan(0.8);
      expect(theme.spacingDensity).toBeLessThan(1.25);
      expect(theme.photoTreatment.contrast).toBeGreaterThan(0.8);
      expect(theme.backgroundIntensity).toBeGreaterThan(0);
      expect(theme.backgroundIntensity).toBeLessThanOrEqual(1);
    }

    expect(new Set(themes.map((theme) => theme.lineThicknessMm)).size).toBeGreaterThan(1);
  });
});

describe("responsive dossier typography", () => {
  test("long names scale down monotonically without becoming unreadably small", () => {
    const short = dossierNameScale("Lea Müller");
    const medium = dossierNameScale("Lea Sophie Müller-Winterberger");
    const long = dossierNameScale("Lea Sophie Alexandra Müller-Winterberger-Schneider");

    expect(short).toBe(1);
    expect(medium).toBeLessThanOrEqual(short);
    expect(long).toBeLessThan(medium);
    expect(long).toBeGreaterThanOrEqual(0.7);
  });
});

describe("unified photo model", () => {
  test("all four dossier photo shapes stay available", () => {
    expect(DOSSIER_PHOTO_SHAPES.map((shape) => shape.id)).toEqual([
      "rect",
      "square",
      "portrait",
      "circle",
    ]);
  });

  test("normalization clamps unsafe values but preserves real zero positions", () => {
    expect(
      normalizeDossierPhotoStyle({
        shape: "circle",
        zoom: 9,
        x: 0,
        y: 0,
        borderWidth: -4,
      }),
    ).toEqual({
      shape: "circle",
      zoom: 3,
      x: 0,
      y: 0,
      borderWidth: 0,
    });
  });

  test("shape geometry round-trips through title-page BlockStyle", () => {
    for (const shape of DOSSIER_PHOTO_SHAPES.map((item) => item.id)) {
      const patch = dossierPhotoPatchToBlockStyle({ shape });
      expect(shapeFromBlockStyle(patch)).toBe(shape);
      expect(patch.ratio).toBe(dossierPhotoRatio(shape));
    }
  });

  test("crop math is deterministic for title page and CV", () => {
    const style = normalizeDossierPhotoStyle({ zoom: 1.6, x: 25, y: 75 });
    const crop = dossierPhotoCropStyle(style);

    expect(Number.parseFloat(String(crop.width))).toBeCloseTo(160, 6);
    expect(Number.parseFloat(String(crop.height))).toBeCloseTo(160, 6);
    expect(Number.parseFloat(String(crop.left))).toBeCloseTo(-15, 6);
    expect(Number.parseFloat(String(crop.top))).toBeCloseTo(-45, 6);
  });

  test("cover photo reader restores current title-page crop and shape", () => {
    const cover = JSON.stringify({
      version: 6,
      template: "modern",
      layout: {
        modern: {
          foto: {
            ratio: 1,
            radius: 999,
            imgZoom: 1.8,
            imgX: 20,
            imgY: 65,
            borderWidth: 0.7,
          },
        },
      },
      data: {
        foto: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
      },
    });
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => (key === "titelblatt:v3" ? cover : null),
        },
      },
    });

    try {
      expect(readCoverPhoto()).toEqual({
        foto: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
        photoStyle: {
          shape: "circle",
          zoom: 1.8,
          x: 20,
          y: 65,
          borderWidth: 0.7,
        },
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});

describe("title-page change detection", () => {
  test("transferable changes produce a new stable fingerprint", () => {
    const draft = emptyCoverDraft();
    const original = coverDraftFingerprint(draft);

    expect(coverDraftFingerprint({ ...draft })).toBe(original);
    expect(
      coverDraftFingerprint({
        ...draft,
        person: { ...draft.person, vorname: "Lea" },
      }),
    ).not.toBe(original);
    expect(
      coverDraftFingerprint({
        ...draft,
        colors: { ...draft.colors, accent: "#123456" },
      }),
    ).not.toBe(original);
  });
});

describe("combined dossier project", () => {
  test("keeps title page and CV in one versioned file", () => {
    const project = createDossierProject({
      cover: { version: 7, data: { vorname: "Lea" } },
      cv: { version: 6, data: { title: "Lebenslauf" } },
    });

    expect(project.kind).toBe(DOSSIER_PROJECT_KIND);
    expect(parseDossierProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });

  test("round-trips title page, motivation letter and CV without losing document-local state", () => {
    const cover = {
      version: 8,
      template: "edge",
      data: { vorname: "Lea", nachname: "Müller" },
      customs: [{ id: "cover-only", kind: "text", text: "Titelblatt-Notiz" }],
    };
    const letter = {
      version: 1,
      data: {
        absenderName: "Lea Müller",
        betreff: "Bewerbung Informatik",
        images: [{ id: "letter-only", src: "data:image/svg+xml,%3Csvg/%3E" }],
      },
      design: { template: "glow", headerMode: "contact", footerMode: "attachments" },
    };
    const cv = {
      version: 2,
      data: { titel: "Lebenslauf", person: { vorname: "Lea", nachname: "Müller" } },
      design: { template: "edge" },
      elements: [{ id: "cv-only", kind: "text", text: "CV-Notiz" }],
    };

    const project = createDossierProject({ cover, letter, cv });
    const parsed = parseDossierProject(JSON.parse(JSON.stringify(project)));

    expect(parsed).not.toBeNull();
    expect(parsed?.cover).toEqual(cover);
    expect(parsed?.letter).toEqual(letter);
    expect(parsed?.cv).toEqual(cv);
  });

  test("stores all three parts and legacy cover+cv projects leave an existing letter untouched", () => {
    const previousWindow = globalThis.window;
    const storage = new Map<string, string>([
      [LETTER_STORAGE_KEY, JSON.stringify({ version: 1, data: { betreff: "Bestehender Brief" } })],
    ]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    try {
      const fullProject = createDossierProject({
        cover: { version: 8, data: { vorname: "Lea" } },
        letter: { version: 1, data: { betreff: "Neuer Brief" } },
        cv: { version: 2, data: { titel: "Lebenslauf" } },
      });
      expect(storeDossierProject(fullProject)).toEqual({ cover: true, letter: true, cv: true });
      expect(JSON.parse(storage.get(COVER_STORAGE_KEY) ?? "null")?.data?.vorname).toBe("Lea");
      expect(JSON.parse(storage.get(LETTER_STORAGE_KEY) ?? "null")?.data?.betreff).toBe("Neuer Brief");
      expect(JSON.parse(storage.get(CV_STORAGE_KEY) ?? "null")?.data?.titel).toBe("Lebenslauf");

      storage.set(
        LETTER_STORAGE_KEY,
        JSON.stringify({ version: 1, data: { betreff: "Brief behalten" } }),
      );
      const legacy = parseDossierProject({
        kind: DOSSIER_PROJECT_KIND,
        version: 1,
        savedAt: "2026-08-31T12:00:00.000Z",
        cover: { version: 7, data: { vorname: "Alt" } },
        cv: { version: 2, data: { titel: "Alter Lebenslauf" } },
      });
      expect(legacy).not.toBeNull();
      expect(storeDossierProject(legacy!)).toEqual({ cover: true, letter: false, cv: true });
      expect(JSON.parse(storage.get(LETTER_STORAGE_KEY) ?? "null")?.data?.betreff).toBe(
        "Brief behalten",
      );
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });

  test("rejects unrelated JSON but accepts empty project snapshots", () => {
    expect(parseDossierProject({ data: {} })).toBeNull();
    expect(
      parseDossierProject({ kind: DOSSIER_PROJECT_KIND, version: 1, savedAt: "now" }),
    ).toEqual({
      kind: DOSSIER_PROJECT_KIND,
      version: 1,
      savedAt: "now",
    });
    expect(
      parseDossierProject({
        kind: DOSSIER_PROJECT_KIND,
        version: 1,
        savedAt: "now",
        cover: { version: 7 },
      }),
    ).toEqual({
      kind: DOSSIER_PROJECT_KIND,
      version: 1,
      savedAt: "now",
    });
  });
});

describe("combined dossier PDF availability", () => {
  test("requires meaningful content in both document parts", () => {
    const emptyCover = coverPdfDocumentFromSaved({
      template: "modern",
      data: { datum: "23.08.2026", ort: "Hubersdorf" },
    });
    const filledCover = coverPdfDocumentFromSaved({
      template: "modern",
      data: { vorname: "Lea", nachname: "Müller" },
    });
    const filledCv = cvPdfDocumentFromSaved({
      data: {
        ...emptyCv,
        schule: [
          { id: "schule-1", zeit: "2023 – heute", titel: "Sek B", ort: "Olten", beschreibung: "" },
        ],
      },
    });

    expect(emptyCover && coverPdfHasContent(emptyCover.data)).toBe(false);
    expect(filledCover && coverPdfHasContent(filledCover.data)).toBe(true);
    expect(cvPdfHasContent(emptyCv)).toBe(false);
    expect(filledCv && cvPdfHasContent(filledCv.data)).toBe(true);
  });
});
