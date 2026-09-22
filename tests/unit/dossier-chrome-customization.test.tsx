import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import { onColorRoles } from "../../src/components/cv/palette";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  dossierFooterContentBottomMmForOptions,
  dossierFooterVisualHeightMmForOptions,
  dossierHeaderContentTopMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  normalizeDossierChromeState,
} from "../../src/lib/dossier-chrome";
import {
  resolveDossierChromeDocumentContent,
  withDossierChromeDocumentContent,
} from "../../src/lib/dossier-chrome-content";
import { DEMO_LETTER, emptyLetterDesign } from "../../src/components/letter/types";
import { letterPageGeometry } from "../../src/components/letter/layout-system";

const contact = {
  name: "Lea Müller",
  address: "Dorfstrasse 12",
  place: "4535 Hubersdorf",
  phone: "079 123 45 67",
  email: "lea@example.ch",
};

describe("dossier chrome customization", () => {
  test("new defaults use stacked header text, inline footer text and no automatic border", () => {
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerMode).toBe("compact");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerTextLayout).toBe("stacked");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerDifferentFirstPage).toBe(false);
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerInlineSeparator).toBe("icons");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerTextLayout).toBe("inline");
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerHeightMm).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerHeightMm).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerBackgroundColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerGradientColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerTextColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.headerFontSizePt).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerBackgroundColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerGradientColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerTextColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.footerFontSizePt).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.borderEnabled).toBe(false);
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.borderColor).toBeNull();
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.borderWidthMm).toBe(0.6);
    expect(DEFAULT_DOSSIER_CHROME_OPTIONS.textFont).toBeNull();
    expect(dossierHeaderVisualHeightMmForOptions(DEFAULT_DOSSIER_CHROME_OPTIONS)).toBe(4);
    expect(dossierFooterVisualHeightMmForOptions(DEFAULT_DOSSIER_CHROME_OPTIONS)).toBe(4);
    expect(
      dossierHeaderVisualHeightMmForOptions({
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerTextLayout: "inline",
      }),
    ).toBe(26);
    expect(
      dossierHeaderVisualHeightMmForOptions({
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerTextLayout: "stacked",
      }),
    ).toBe(32);
  });

  test("automatic header height grows for document content while explicit height wins", () => {
    const content = resolveDossierChromeDocumentContent(
      {
        headerTitleEnabled: true,
        headerTextEnabled: true,
        headerText: "Bewerbung Informatik",
      },
      "Lebenslauf",
    );
    const inline = withDossierChromeDocumentContent(
      {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerTextLayout: "inline",
        headerHeightMm: null,
      },
      content,
    );
    const stacked = withDossierChromeDocumentContent(
      { ...inline, headerTextLayout: "stacked", headerHeightMm: null },
      content,
    );
    expect(inline.headerHeightMm).toBe(35);
    expect(stacked.headerHeightMm).toBe(41);
    expect(
      withDossierChromeDocumentContent({ ...stacked, headerHeightMm: 37 }, content).headerHeightMm,
    ).toBe(37);
  });

  test("legacy persisted branches keep first-page behavior while fresh partial state is identical", () => {
    const fresh = normalizeDossierChromeState({});
    expect(fresh.shared.headerDifferentFirstPage).toBe(false);

    const legacy = normalizeDossierChromeState({
      shared: {
        headerMode: "contact",
        footerMode: "compact",
      },
    });
    expect(legacy.shared.headerDifferentFirstPage).toBe(true);
  });

  test("legacy saved state without text-color keys stays automatic", () => {
    const {
      headerTextColor: _headerTextColor,
      footerTextColor: _footerTextColor,
      ...legacyShared
    } = DEFAULT_DOSSIER_CHROME_OPTIONS;
    const state = normalizeDossierChromeState({ sync: true, shared: legacyShared });

    expect(state.shared.headerTextColor).toBeNull();
    expect(state.shared.footerTextColor).toBeNull();
  });

  test("legacy inline headers keep their historical midpoint separator", () => {
    const { headerInlineSeparator: _removed, ...legacyShared } = DEFAULT_DOSSIER_CHROME_OPTIONS;
    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        ...legacyShared,
        headerTextLayout: "inline",
      },
    });

    expect(state.shared.headerInlineSeparator).toBe("dot");
    expect(state.cv.headerInlineSeparator).toBe("dot");
    expect(state.letter.headerInlineSeparator).toBe("dot");
  });

  test("normalization keeps customization and lets old branches inherit shared border settings", () => {
    const state = normalizeDossierChromeState({
      sync: true,
      shared: {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        footerMode: "details",
        headerHeightMm: 28,
        footerHeightMm: 16,
        headerTextLayout: "inline",
        footerTextLayout: "stacked",
        headerBackgroundColor: "#123456",
        headerGradientColor: "#abcdef",
        headerTextColor: "#ABCDEF",
        headerFontSizePt: 11.2,
        footerBackgroundColor: "not-a-color",
        footerTextColor: "#654321",
        footerFontSizePt: 9.8,
        borderEnabled: false,
        borderColor: "#fedcba",
        borderWidthMm: 1.2,
        textFont: "freundlich",
      },
      cv: {
        headerMode: "compact",
        headerShowName: true,
        headerShowAddress: true,
        headerShowPhone: true,
        headerShowEmail: true,
        footerMode: "compact",
      },
    });

    expect(state.shared.headerHeightMm).toBe(28);
    expect(state.shared.headerDifferentFirstPage).toBe(false);
    expect(state.shared.footerHeightMm).toBe(16);
    expect(state.shared.headerTextLayout).toBe("inline");
    expect(state.shared.footerTextLayout).toBe("stacked");
    expect(state.shared.headerBackgroundColor).toBe("#123456");
    expect(state.shared.headerGradientColor).toBe("#abcdef");
    expect(state.shared.headerTextColor).toBe("#abcdef");
    expect(state.shared.headerFontSizePt).toBe(11);
    expect(state.shared.footerBackgroundColor).toBeNull();
    expect(state.shared.footerTextColor).toBe("#654321");
    expect(state.shared.footerFontSizePt).toBe(10);
    expect(state.shared.borderEnabled).toBe(false);
    expect(state.shared.borderColor).toBe("#fedcba");
    expect(state.shared.borderWidthMm).toBe(1.2);
    expect(state.shared.textFont).toBe("freundlich");
    expect(state.cv.borderEnabled).toBe(false);
    expect(state.cv.borderColor).toBeNull();
    expect(state.cv.borderWidthMm).toBe(1.2);
    expect(state.cv.headerTextColor).toBeNull();
    expect(state.cv.footerTextColor).toBeNull();
  });

  test("custom heights reserve matching CV content space", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      footerMode: "details" as const,
      headerHeightMm: 30,
      footerHeightMm: 18,
    };

    expect(dossierHeaderContentTopMmForOptions(options)).toBe(51);
    expect(dossierFooterContentBottomMmForOptions(options)).toBe(28);
  });

  test("letter geometry follows the same custom heights", () => {
    const design = {
      ...emptyLetterDesign(),
      headerMode: "contact" as const,
      footerMode: "attachments" as const,
      headerHeightMm: 30,
      footerHeightMm: 18,
    };
    const geometry = letterPageGeometry(DEMO_LETTER, design);

    expect(geometry.content.top).toBe(39);
    expect(geometry.footer.height).toBe(18);
    expect(geometry.content.bottom).toBe(25);
  });

  test("renderer applies font, gradients, explicit text colors and an explicitly enabled custom border", () => {
    const options = {
      ...DEFAULT_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact" as const,
      footerMode: "details" as const,
      headerTextLayout: "stacked" as const,
      footerTextLayout: "inline" as const,
      headerBackgroundColor: "#112233",
      headerGradientColor: "#445566",
      headerTextColor: "#123456",
      headerFontSizePt: 11,
      footerBackgroundColor: "#778899",
      footerGradientColor: "#aabbcc",
      footerTextColor: "#654321",
      footerFontSizePt: 10,
      borderEnabled: true,
      borderColor: "#fedcba",
      borderWidthMm: 0.9,
      textFont: "freundlich" as const,
    };
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "letter",
        template: "modern",
        colors: { primary: "#000000", accent: "#999999" },
        contact,
        options,
        footerLabel: "Beilagen:",
        footerDetails: ["Lebenslauf", "Zeugnis"],
      }),
    );

    expect(markup).toContain('data-dossier-header-text-layout="stacked"');
    expect(markup).toContain('data-dossier-footer-text-layout="inline"');
    expect(markup).toContain('data-dossier-header-text-color="#123456"');
    expect(markup).toContain('data-dossier-footer-text-color="#654321"');
    expect(markup).toContain('data-dossier-header-font-size="11"');
    expect(markup).toContain('data-dossier-footer-font-size="10"');
    expect(markup).toContain('data-dossier-border-enabled="true"');
    expect(markup).toContain('data-dossier-border-color="#fedcba"');
    expect(markup).toContain('data-dossier-border-width-mm="0.9"');
    expect(markup).toContain('data-dossier-chrome-font="freundlich"');
    expect(markup).toContain("linear-gradient(90deg, #112233, #445566)");
    expect(markup).toContain("linear-gradient(90deg, #778899, #aabbcc)");
    expect(markup).toContain("color:#123456");
    expect(markup).toContain("color:#654321");
    expect(markup).toContain("font-size:11pt");
    expect(markup).toContain("font-size:10pt");
    expect(markup).toContain("border-bottom:0.9mm solid #fedcba");
    expect(markup).toContain("border-top:0.9mm solid #fedcba");
    expect(markup).toContain("Lea Müller");
    expect(markup).toContain("Dorfstrasse 12");
    expect(markup).toContain(">Lebenslauf</div>");
    expect(markup).toContain("> · Zeugnis</div>");
  });

  test("automatic text colors still use the readable surface contrast", () => {
    const headerInk = onColorRoles("#ffffff", "#ffffff").ink;
    const footerInk = onColorRoles("#000000", "#000000").ink;
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "letter",
        template: "modern",
        colors: { primary: "#ffffff", secondary: "#ffffff", accent: "#ffffff" },
        contact,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "contact",
          footerMode: "details",
          headerBackgroundColor: "#ffffff",
          headerGradientColor: "#ffffff",
          footerBackgroundColor: "#000000",
          footerGradientColor: "#000000",
          headerTextColor: null,
          footerTextColor: null,
        },
        footerLabel: "Beilagen:",
        footerDetails: ["Lebenslauf"],
      }),
    );

    expect(markup).toContain('data-dossier-header-text-color="automatic"');
    expect(markup).toContain('data-dossier-footer-text-color="automatic"');
    expect(markup).toContain(`color:${headerInk}`);
    expect(markup).toContain(`color:${footerInk}`);
  });

  test("inline contact icons inherit the computed header contrast", () => {
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "modern",
        colors: { primary: "#ffffff", accent: "#f1f5f9" },
        contact,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "contact",
          headerTextLayout: "inline",
          headerInlineSeparator: "icons",
          headerBackgroundColor: "#ffffff",
          headerGradientColor: null,
        },
      }),
    );

    expect(markup).toContain('data-dossier-header-inline-separator="icons"');
    expect(markup).toContain("color:currentColor");
  });

  test("automatic border color avoids matching either default surface", () => {
    const markup = renderToStaticMarkup(
      createElement(DossierHeaderFooterChrome, {
        scope: "cv",
        template: "modern",
        colors: {
          primary: "#111111",
          secondary: "#222222",
          accent: "#333333",
          cvHeading: "#444444",
        },
        contact,
        options: {
          ...DEFAULT_DOSSIER_CHROME_OPTIONS,
          headerMode: "compact",
          footerMode: "compact",
        },
      }),
    );

    expect(markup).toContain('data-dossier-border-enabled="false"');
    expect(markup).toContain('data-dossier-border-color="#444444"');
    expect(markup).not.toContain('data-dossier-border-color="#111111"');
    expect(markup).not.toContain('data-dossier-border-color="#333333"');
  });
});
