import { describe, expect, test } from "bun:test";
import type { TemplateId } from "../../src/components/cover/types";
import { defaultCvLayoutForTemplate } from "../../src/components/cv/layout";
import { cvFrameFor } from "../../src/components/cv/archetype";
import {
  EMPTY_LETTER,
  emptyLetterDesign,
  normalizeLetterDesign,
} from "../../src/components/letter/types";
import { letterPageGeometry } from "../../src/components/letter/layout-system";
import { DEFAULTS } from "../../src/default-config";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  DEFAULT_DOSSIER_CHROME_STATE,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";
import { CANONICAL_DOSSIER_PRESENTATION } from "../../src/lib/dossier-default-presentation";
import { resolveDossierDocxProfile } from "../../src/lib/dossier-docx-export";
import {
  coverPdfDocumentFromSaved,
  cvPdfDocumentFromSaved,
  letterPdfDocumentFromSaved,
} from "../../src/lib/dossier-pdf-document";
import { normalizeActiveTemplateId } from "../../src/components/cover/fresh-templates";

describe("canonical neutral dossier fallback", () => {
  test("one contract owns the fresh template and neutral chrome", () => {
    // Compile-time release guard: Brief must stay a real TemplateId, never a cast-only pseudo-id.
    const typedDefault: TemplateId = DEFAULTS.TEMPLATE;
    expect(CANONICAL_DOSSIER_PRESENTATION.template).toBe("brief");
    expect(typedDefault).toBe("brief");
    expect(CANONICAL_DOSSIER_PRESENTATION.cv.layout).toBe("classic");
    expect(DEFAULT_DOSSIER_CHROME_STATE.shared.headerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_STATE.shared.footerMode).toBe("none");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerMode).toBe("contact");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerMode).toBe("compact");
    expect(CANONICAL_DOSSIER_PRESENTATION.letter.continuationHeaderMode).toBe("none");
    expect(CANONICAL_DOSSIER_PRESENTATION.letter.continuationFooterMode).toBe("none");
  });

  test("fresh and raw Brief designs keep page 1 and continuation pages plain", () => {
    const design = emptyLetterDesign();
    const first = letterPageGeometry(EMPTY_LETTER, design, { pageIndex: 0, finalPage: false });
    const continuation = letterPageGeometry(EMPTY_LETTER, design, {
      pageIndex: 1,
      finalPage: true,
    });

    expect(design.template).toBe("brief");
    expect(design.headerMode).toBe("none");
    expect(design.footerMode).toBe("none");
    expect(first.effectiveHeaderMode).toBe("none");
    expect(first.effectiveFooterMode).toBe("none");
    expect(continuation.effectiveHeaderMode).toBe("none");
    expect(continuation.effectiveFooterMode).toBe("none");

    const rawDesign = { ...design, headerMode: undefined, footerMode: undefined };
    const rawFirst = letterPageGeometry(EMPTY_LETTER, rawDesign, {
      pageIndex: 0,
      finalPage: false,
    });
    const rawContinuation = letterPageGeometry(EMPTY_LETTER, rawDesign, {
      pageIndex: 1,
      finalPage: true,
    });
    expect(rawFirst.effectiveHeaderMode).toBe("none");
    expect(rawFirst.effectiveFooterMode).toBe("none");
    expect(rawContinuation.effectiveHeaderMode).toBe("none");
    expect(rawContinuation.effectiveFooterMode).toBe("none");
  });

  test("partial chrome state recovers to the fresh Brief contract, not legacy chrome", () => {
    const recovered = normalizeDossierChromeState({});
    expect(recovered.shared.headerMode).toBe("none");
    expect(recovered.shared.footerMode).toBe("none");
    expect(recovered.cv.headerMode).toBe("none");
    expect(recovered.letter.headerMode).toBe("none");
  });

  test("fresh CV resolves to Brief + Standard without a sidebar frame", () => {
    expect(defaultCvLayoutForTemplate(CANONICAL_DOSSIER_PRESENTATION.template)).toBe("classic");
    const frame = cvFrameFor(DEFAULTS.TEMPLATE);
    expect(frame.id).toBe("quiet");
    expect(frame.columnMm).toBe(0);
  });

  test("PDF document fallbacks resolve all dossier parts to Brief", () => {
    const cover = coverPdfDocumentFromSaved({ data: {} });
    const letter = letterPdfDocumentFromSaved({ data: {} });
    const cv = cvPdfDocumentFromSaved({ data: {} });

    expect(String(cover?.template)).toBe("brief");
    expect(letter?.design.template).toBe("brief");
    expect(letter?.design.headerMode).toBe("none");
    expect(letter?.design.footerMode).toBe("none");
    expect(String(cv?.design.template)).toBe("brief");
    expect(resolveDossierDocxProfile(cover, letter, cv)?.templateId).toBe("brief");
  });

  test("retired Frame data has one deterministic Brief fallback through PDF and DOCX", () => {
    const cover = coverPdfDocumentFromSaved({ template: "frame", data: {} });
    const letter = letterPdfDocumentFromSaved({ data: {}, design: { template: "frame" } });
    const cv = cvPdfDocumentFromSaved({ data: {}, design: { template: "frame" } });

    expect(normalizeActiveTemplateId("frame")).toBe("brief");
    expect(String(cover?.template)).toBe("brief");
    expect(letter?.design.template).toBe("brief");
    expect(String(cv?.design.template)).toBe("brief");
    expect(resolveDossierDocxProfile(cover, letter, cv)?.templateId).toBe("brief");
  });

  test("explicit legacy choices remain authoritative", () => {
    const legacy = normalizeLetterDesign({
      template: "modern",
      colors: {},
      font: "freundlich",
      headerMode: "contact",
      footerMode: "compact",
    });
    expect(legacy.template).toBe("modern");
    expect(legacy.headerMode).toBe("contact");
    expect(legacy.footerMode).toBe("compact");
  });
});
