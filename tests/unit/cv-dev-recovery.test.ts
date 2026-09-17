import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CV_DOC_TITLE_DEFAULTS,
  CV_DOC_TITLE_MARGIN_BOTTOM_MAX,
  CV_SECTION_TITLE_DEFAULTS,
  CV_SECTION_TITLE_MARGIN_BOTTOM_MAX,
  CV_TYPE_DEFAULTS,
  DEMO_CV,
} from "../../src/components/cv/types";
import { cvDesignWithFullSectionRules } from "../../src/components/cv/CvCanvas";

const canvas = readFileSync("src/components/cv/CvCanvasBase.tsx", "utf8");
const route = readFileSync("src/routes/lebenslauf.tsx", "utf8");
const userTypographyCss = readFileSync("src/components/cv/user-typography.css", "utf8");

test("CV template state stays neutral while missing and legacy section rules render full width", () => {
  expect(CV_TYPE_DEFAULTS.headingRule).toBeUndefined();
  expect(cvDesignWithFullSectionRules({} as never).headingRule).toBe("full");
  expect(cvDesignWithFullSectionRules({ headingRule: "short" } as never).headingRule).toBe("full");
  expect(cvDesignWithFullSectionRules({ headingRule: "none" } as never).headingRule).toBe("none");
  expect(route).toContain("headingRule: CV_TYPE_DEFAULTS.headingRule");
  expect(route).not.toContain('["short", "Kurz"]');
  expect(route).toContain('["full", "Ganze Breite"]');
  expect(route).toContain('["none", "Keine"]');
});

test("document title has independent persisted style controls in preview/PDF renderer", () => {
  expect(CV_DOC_TITLE_DEFAULTS.fontSizePx).toBeGreaterThan(13);
  expect(CV_DOC_TITLE_MARGIN_BOTTOM_MAX).toBe(100);
  for (const contract of [
    "docTitleFontSizePx",
    "docTitleColor",
    "docTitleBold",
    "docTitleItalic",
    "docTitleUnderline",
    "docTitleMarginBottomPx",
  ]) {
    expect(canvas).toContain(contract);
    expect(route).toContain(contract);
  }
  expect(route).toContain("Dokumenttitel gestalten");
  expect(canvas).toContain("marginBottom: `${marginBottomPx}px`");
});

test("rubric title formatting is global and includes side/custom render paths", () => {
  expect(CV_SECTION_TITLE_DEFAULTS.fontSizePx).toBeGreaterThan(12);
  expect(CV_SECTION_TITLE_MARGIN_BOTTOM_MAX).toBe(100);
  for (const contract of [
    "sectionTitleFontSizePx",
    "sectionTitleColor",
    "sectionTitleBold",
    "sectionTitleItalic",
    "sectionTitleUnderline",
    "sectionTitleMarginBottomPx",
  ]) {
    expect(canvas).toContain(contract);
    expect(route).toContain(contract);
  }
  expect(route).toContain("Rubriktitel gestalten");
  expect(route).toContain("Referenzen und eigene Rubriken");
  expect(canvas).toContain("sectionTitleColor || pal.accent");
  expect(canvas).toContain("sectionTitleColor || side.accent");
  expect(canvas).toContain("customSectionForKey(data, key)");
});

test("explicit typography controls outrank template defaults without breaking the PDF raster mask", () => {
  for (const contract of [
    "data-cv-user-doc-color",
    "data-cv-user-doc-weight",
    "data-cv-user-doc-margin",
    "data-cv-user-section-color",
    "data-cv-user-section-weight",
    "data-cv-user-section-margin",
  ]) {
    expect(canvas).toContain(contract);
  }
  expect(userTypographyCss).toContain(
    "-webkit-text-fill-color: var(--cv-user-doc-color) !important",
  );
  expect(userTypographyCss).toContain("font-weight: var(--cv-user-section-weight) !important");
  expect(userTypographyCss).toContain(
    "margin-bottom: var(--cv-user-section-margin-bottom) !important",
  );
});

test("demo CV no longer adds a redundant subtitle below the candidate name", () => {
  expect(DEMO_CV.person.untertitel).toBe("");
});
