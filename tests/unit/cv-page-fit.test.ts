import { describe, expect, test } from "bun:test";
import { buildCvPageFitPlan, cvPageFitSectionWeight } from "../../src/components/cv/page-fit";
import { DEMO_CV, cvSectionOrder, type CvData } from "../../src/components/cv/types";
import { DEFAULT_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import {
  defaultHeaderFontSizePtForTemplate,
  resolveTemplateChromeOptions,
} from "../../src/lib/template-chrome";

describe("CV pupil page fit", () => {
  test("moves every rubric back to page 1 in one-page mode", () => {
    const plan = buildCvPageFitPlan(DEMO_CV, "one");
    for (const key of cvSectionOrder(DEMO_CV)) {
      expect(plan.pageBySection[key]).toBe(1);
    }
  });

  test("uses safe half-width pairs before shrinking one-page content", () => {
    const plan = buildCvPageFitPlan(DEMO_CV, "one", { allowHalfWidth: true });

    expect(plan.widthBySection.schule).toBe("full");
    expect(plan.widthBySection.erfahrung).toBe("full");
    expect(plan.widthBySection.referenzen).toBe("full");
    expect(plan.widthBySection.sprachen).toBe("half");
    expect(plan.widthBySection.hobbys).toBe("half");
    expect(plan.effectiveWeight).toBeLessThan(plan.totalWeight);
  });

  test("does not split an already narrow sidebar into half-width rubrics", () => {
    const plan = buildCvPageFitPlan(DEMO_CV, "one", { allowHalfWidth: false });
    for (const key of cvSectionOrder(DEMO_CV)) {
      expect(plan.widthBySection[key]).toBe("full");
    }
    expect(plan.effectiveWeight).toBe(plan.totalWeight);
  });

  test("keeps personal data on page 1 and gives real content to page 2", () => {
    const plan = buildCvPageFitPlan(DEMO_CV, "two");
    expect(plan.pageBySection.person).toBe(1);

    const pageTwoContent = cvSectionOrder(DEMO_CV).filter(
      (key) => plan.pageBySection[key] === 2 && cvPageFitSectionWeight(DEMO_CV, key) > 0,
    );
    expect(pageTwoContent.length).toBeGreaterThan(0);
    for (const key of cvSectionOrder(DEMO_CV)) {
      expect(plan.widthBySection[key]).toBe("full");
    }
  });

  test("tightens dense one-page content without crossing the safe scale floor", () => {
    const dense: CvData = {
      ...DEMO_CV,
      erfahrung: DEMO_CV.erfahrung.map((entry, index) => ({
        ...entry,
        id: `${entry.id}-${index}`,
        beschreibung: `${entry.beschreibung} ${"Langer Bewerbungstext ".repeat(20)}`,
      })),
    };
    const plan = buildCvPageFitPlan(dense, "one");
    expect(plan.bodyScaleFactor).toBeLessThan(1);
    expect(plan.bodyScaleFactor).toBeGreaterThanOrEqual(0.82);
  });
});

describe("dossier header default typography", () => {
  test("uses 14 pt by default in every template resolver", () => {
    expect(defaultHeaderFontSizePtForTemplate("brief")).toBe(14);
    expect(
      resolveTemplateChromeOptions("brief", {}, DEFAULT_DOSSIER_CHROME_OPTIONS).headerFontSizePt,
    ).toBe(14);
  });

  test("keeps an explicit user header size", () => {
    expect(
      resolveTemplateChromeOptions("brief", {}, {
        ...DEFAULT_DOSSIER_CHROME_OPTIONS,
        headerFontSizePt: 11,
      }).headerFontSizePt,
    ).toBe(11);
  });
});
