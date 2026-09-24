import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  consumeCvPageFitMode,
  getCvPageFitMode,
  getCvPageFitRevision,
  setCvPageFitMode,
} from "../../src/components/cv/page-fit";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("CV page-fit one-shot action", () => {
  test("consumes the runtime request without persisting an active mode", () => {
    setCvPageFitMode("one");
    const revision = getCvPageFitRevision();
    expect(getCvPageFitMode()).toBe("one");
    consumeCvPageFitMode("one");
    expect(getCvPageFitMode()).toBeNull();
    expect(getCvPageFitRevision()).toBe(revision);
  });

  test("does not serialize or restore pageFitMode in portable CV state", () => {
    const portable = read("src/components/cv/portable-state.ts");
    expect(portable).not.toContain("pageFitMode");
    expect(portable).not.toContain("PAGE_FIT_KEY");
    expect(portable).toContain("setCvPageFitMode(null)");
  });

  test("persists fitted typography before consuming the request", () => {
    const canvas = read("src/components/cv/CvCanvas.tsx");
    const route = read("src/routes/lebenslauf.tsx");
    expect(canvas).toContain("props.onPageFitDesign?.({");
    expect(canvas).toContain("consumeCvPageFitMode(pageFitPlan.mode)");
    expect(canvas).toContain("[pageFitLayout, pageFitMode, props.data, props.exportMode]");
    expect(route).toContain("onPageFitDesign={applyPageFitDesign}");
  });

  test("keeps page-fit as button semantics and never writes the legacy mode", () => {
    const pageFit = read("src/components/cv/page-fit.ts");
    const portal = read("src/components/cv/CvPageFitMenuPortal.tsx");
    expect(pageFit).not.toContain("localStorage.setItem(CV_PAGE_FIT_STORAGE_KEY");
    expect(portal).not.toContain("aria-pressed");
  });
});
