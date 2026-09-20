import { afterEach, describe, expect, test } from "bun:test";
import { cvContentBox, cvFrameFor } from "../../src/components/cv/archetype";
import { letterPageGeometry } from "../../src/components/letter/layout-system";
import { DEMO_LETTER, emptyLetterDesign } from "../../src/components/letter/types";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  type DossierChromeOptions,
} from "../../src/lib/dossier-chrome";
import { resolveDossierContentMargins } from "../../src/lib/dossier-page-geometry";
import {
  clearDossierPageMargins,
  setDossierPageMargins,
} from "../../src/lib/dossier-page-margins";
import { WARM_FIRST_PAGE_HEADER_HEIGHT_MM } from "../../src/components/letter/warm-letter-layout";

afterEach(() => clearDossierPageMargins());

const contactChrome: DossierChromeOptions = {
  ...DEFAULT_DOSSIER_CHROME_OPTIONS,
  headerMode: "contact",
  headerHeightMm: null,
  headerGapMm: 6,
  footerMode: "none",
};

describe("shared dossier page geometry foundation", () => {
  test("composes physical page margin, header reserve, header gap and footer reserve exactly once", () => {
    expect(
      resolveDossierContentMargins(
        { top: 12, right: 18, bottom: 14, left: 20 },
        { top: 5, right: 5, bottom: 5, left: 5 },
        { headerReserveMm: 20, headerGapMm: 7, footerReserveMm: 3 },
      ),
    ).toEqual({ top: 39, right: 18, bottom: 17, left: 20 });
  });

  test("a missing header reserve suppresses phantom header gap", () => {
    expect(
      resolveDossierContentMargins(
        { top: 12, right: 18, bottom: 14, left: 20 },
        { top: 5, right: 5, bottom: 5, left: 5 },
        { headerReserveMm: 0, headerGapMm: 40, footerReserveMm: 0 },
      ),
    ).toEqual({ top: 12, right: 18, bottom: 14, left: 20 });
  });

  test("CV and Letter custom margins use the same top-level composition contract", () => {
    setDossierPageMargins("cv", { top: 10, right: 20, bottom: 10, left: 20 });
    setDossierPageMargins("letter", { top: 10, right: 20, bottom: 10, left: 20 });

    const cv = cvContentBox(cvFrameFor("modern"), 0, "classic", 0.3, contactChrome);
    const letter = letterPageGeometry(DEMO_LETTER, emptyLetterDesign(), {
      chromeOptions: contactChrome,
    });

    expect(cv.top).toBe(48);
    expect(letter.content.top).toBe(48);
    expect(cv.left).toBe(20);
    expect(letter.content.left).toBe(20);
  });

  test("explicit continuation header mode drives the same reserve as rendered shared chrome", () => {
    setDossierPageMargins("letter", { top: 10, right: 20, bottom: 10, left: 20 });
    const chrome = {
      ...contactChrome,
      headerDifferentFirstPage: true,
      headerContinuationMode: "none" as const,
    };

    const first = letterPageGeometry(DEMO_LETTER, emptyLetterDesign(), {
      pageIndex: 0,
      chromeOptions: chrome,
    });
    const continuation = letterPageGeometry(DEMO_LETTER, emptyLetterDesign(), {
      pageIndex: 1,
      chromeOptions: chrome,
    });

    expect(first.effectiveHeaderMode).toBe("contact");
    expect(first.content.top).toBe(48);
    expect(continuation.effectiveHeaderMode).toBe("none");
    expect(continuation.content.top).toBe(10);
  });

  test("dynamic attachment footer reserve grows the bottom safe edge without changing page-margin storage", () => {
    setDossierPageMargins("letter", { top: 10, right: 20, bottom: 8, left: 20 });
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "none" as const,
      footerMode: "details" as const,
      footerHeightMm: null,
    };
    const short = letterPageGeometry(
      { ...DEMO_LETTER, beilagen: ["Zeugnis"] },
      emptyLetterDesign(),
      { chromeOptions: chrome },
    );
    const long = letterPageGeometry(
      { ...DEMO_LETTER, beilagen: ["Sehr lange Beilage ".repeat(30)] },
      emptyLetterDesign(),
      { chromeOptions: chrome },
    );

    expect(long.footer.height).toBeGreaterThan(short.footer.height);
    expect(long.content.bottom).toBeGreaterThan(short.content.bottom);
  });

  test("Warm keeps its structural first-page masthead reserve on top of the physical margin", () => {
    setDossierPageMargins("letter", { top: 5, right: 20, bottom: 10, left: 20 });
    const design = { ...emptyLetterDesign(), template: "freundlich" as const };
    const chrome = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "compact" as const,
      headerGapMm: 4,
      footerMode: "none" as const,
    };
    const geometry = letterPageGeometry(DEMO_LETTER, design, { chromeOptions: chrome });

    expect(geometry.content.top).toBe(5 + WARM_FIRST_PAGE_HEADER_HEIGHT_MM + 4);
  });
});