import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const read = (path: string) => readFileSync(path, "utf8");

describe("dossier chrome renderer boundary", () => {
  test("renderers consume explicit snapshots and never subscribe to the global chrome store", () => {
    const renderers = [
      "src/components/dossier/DossierHeaderFooterChrome.tsx",
      "src/components/dossier/DossierPdfCanvas.tsx",
      "src/components/letter/LetterCanvas.tsx",
      "src/components/cv/CvCanvas.tsx",
      "src/components/cv/CvCanvasBase.tsx",
    ];
    for (const path of renderers) {
      const source = read(path);
      expect(source).not.toContain("subscribeDossierChrome");
      expect(source).not.toContain("getDossierChromeState");
    }
  });

  test("shared chrome is presentational and receives options explicitly", () => {
    const source = read("src/components/dossier/DossierHeaderFooterChrome.tsx");
    expect(source).toContain("options: DossierChromeOptions");
    expect(source).not.toContain("optionsOverride");
    expect(source).not.toContain("useSyncExternalStore");
  });

  test("CV geometry and visual chrome use the same explicit snapshot", () => {
    const source = read("src/components/cv/CvCanvasBase.tsx");
    expect(source).toContain("chromeOptions: DossierChromeOptions");
    expect(source).toContain("cvContentBox(frame, i, layout, sidebarPct, chromeOptions)");
    expect(source).toContain("options={chromeOptions}");
  });

  test("chrome controls derive every field from their subscribed state snapshot", () => {
    const source = read("src/components/dossier/DossierChromeControls.tsx");
    expect(source).toContain("const options = state.sync ? state.shared : state[scope]");
    expect(source).toContain("const headerControlValue");
    expect(source).toContain("value={headerControlValue}");
    expect(source).toContain("value={headerInlineSeparator}");
    expect(source).toContain('options.headerMode === "contact"');
    expect(source).not.toContain("getDossierChromeOptions");
    expect(source).not.toContain("selected.headerMode");
    expect(source).not.toContain("selected.footerMode");
  });
});
