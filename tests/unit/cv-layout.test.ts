import { describe, expect, test } from "bun:test";
import {
  CV_LAYOUT_PICKER_OPTIONS,
  CV_SECTION_GAP_MAX_MM,
  CV_SECTION_GAP_MIN_MM,
  normalizeCvSectionGapMm,
  resolveCvLayoutChoice,
} from "../../src/components/cv/layout";
import {
  CV_LAYOUT_SECTION_ORDER,
  customSectionKey,
  cvSectionOrder,
  emptyCv,
  hasCustomizedCvSectionLayout,
  normalizeCvSectionLayout,
  type CvData,
} from "../../src/components/cv/types";

describe("CV rubric layout", () => {
  test("legacy documents receive the historic rubric order", () => {
    const legacy = {
      ...emptyCv,
      customSections: undefined,
      sectionOrder: undefined,
    } satisfies CvData;

    expect(cvSectionOrder(legacy)).toEqual(CV_LAYOUT_SECTION_ORDER);
    expect(hasCustomizedCvSectionLayout(legacy)).toBe(false);
  });

  test("custom rubrics are appended once and stale persisted keys are ignored", () => {
    const custom = { id: "projects", title: "Projekte", entries: [] };
    const key = customSectionKey(custom.id);
    const data: CvData = {
      ...emptyCv,
      customSections: [custom],
      sectionOrder: ["person", key, key, "custom:deleted", "schule"],
    };

    const order = cvSectionOrder(data);
    expect(order.filter((candidate) => candidate === key)).toHaveLength(1);
    expect(order).not.toContain("custom:deleted");
    expect(order).toContain("referenzen");
  });

  test("reordering is recognized without changing page, width or positioning", () => {
    const data: CvData = {
      ...emptyCv,
      sectionOrder: [
        "person",
        "erfahrung",
        "schule",
        "sprachen",
        "hobbys",
        "staerken",
        "referenzen",
      ],
    };

    expect(hasCustomizedCvSectionLayout(data)).toBe(true);
  });

  test("unsafe saved geometry is clamped while independent choices survive", () => {
    expect(
      normalizeCvSectionLayout({
        page: 2,
        width: "half",
        positioning: "free",
        x: 21,
        y: 35,
        widthMm: 999,
        heightMm: -5,
      }),
    ).toEqual({
      page: 2,
      width: "half",
      positioning: "free",
      x: 21,
      y: 35,
      widthMm: 190,
      heightMm: 10,
    });
  });

  test("global vertical rubric spacing keeps template default optional and clamps custom values", () => {
    expect(normalizeCvSectionGapMm(null)).toBeNull();
    expect(normalizeCvSectionGapMm("")).toBeNull();
    expect(normalizeCvSectionGapMm("4.5")).toBe(4.5);
    expect(normalizeCvSectionGapMm(-3)).toBe(CV_SECTION_GAP_MIN_MM);
    expect(normalizeCvSectionGapMm(99)).toBe(CV_SECTION_GAP_MAX_MM);
  });

  test("exposes Sidebar links and Sidebar rechts as explicit picker choices", () => {
    const sidebarOptions = CV_LAYOUT_PICKER_OPTIONS.filter((option) => option.layout === "modern");
    expect(
      sidebarOptions.map(({ key, name, infoPosition }) => ({ key, name, infoPosition })),
    ).toEqual([
      { key: "sidebar-left", name: "Sidebar links", infoPosition: "standard" },
      { key: "sidebar-right", name: "Sidebar rechts", infoPosition: "mirrored" },
    ]);
    expect(new Set(CV_LAYOUT_PICKER_OPTIONS.map((option) => option.key)).size).toBe(
      CV_LAYOUT_PICKER_OPTIONS.length,
    );
  });

  test("Kolumne defaults to Sidebar and preserves explicit saved layouts", () => {
    expect(resolveCvLayoutChoice("terracotta", null)).toBe("modern");
    expect(resolveCvLayoutChoice("terracotta", "classic")).toBe("classic");
    expect(resolveCvLayoutChoice("terracotta", "editorial")).toBe("editorial");
    expect(resolveCvLayoutChoice("modern", "editorial")).toBe("editorial");
  });
});
