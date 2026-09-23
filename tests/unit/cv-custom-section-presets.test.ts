import { describe, expect, test } from "bun:test";
import {
  CV_CUSTOM_SECTION_PRESETS,
  DEMO_CV,
  customSectionFromPreset,
  ensureFixedFamilySection,
} from "../../src/components/cv/types";

describe("CV custom section presets", () => {
  test("offers digital skills and a blank custom section", () => {
    expect(CV_CUSTOM_SECTION_PRESETS.map((preset) => preset.key)).toEqual([
      "digitale-kenntnisse",
      "eigene-rubrik",
    ]);
  });

  test.each([
    ["familie", "Familie"],
    ["digitale-kenntnisse", "Digitale Kenntnisse"],
    ["eigene-rubrik", "Eigene Rubrik"],
  ] as const)("creates an editable %s section without fake content", (preset, title) => {
    const section = customSectionFromPreset(preset);

    expect(section.title).toBe(title);
    expect(section.preset).toBe(preset);
    expect(section.entries).toHaveLength(1);
    expect(section.entries[0]).toMatchObject({
      zeit: "",
      titel: "",
      ort: "",
      beschreibung: "",
    });
  });

  test("keeps family fixed and migrates older CV data", () => {
    const migrated = ensureFixedFamilySection({
      ...DEMO_CV,
      customSections: [],
      sectionOrder: DEMO_CV.sectionOrder?.filter((key) => key !== "custom:familie"),
    });

    expect(migrated.customSections?.find((section) => section.id === "familie")).toMatchObject({
      title: "Familie",
      preset: "familie",
    });
    expect(migrated.sectionOrder?.slice(0, 3)).toEqual(["person", "custom:familie", "schule"]);
  });

  test("inserts a missing legacy family directly after personal info without resetting custom order", () => {
    const migrated = ensureFixedFamilySection({
      ...DEMO_CV,
      sectionOrder: [
        "schule",
        "person",
        "erfahrung",
        "sprachen",
        "hobbys",
        "staerken",
        "referenzen",
      ],
    });

    expect(migrated.sectionOrder).toEqual([
      "schule",
      "person",
      "custom:familie",
      "erfahrung",
      "sprachen",
      "hobbys",
      "staerken",
      "referenzen",
    ]);
  });

  test("keeps an explicitly positioned family where the user put it", () => {
    const sectionOrder = [
      "person",
      "schule",
      "erfahrung",
      "custom:familie",
      "sprachen",
      "hobbys",
      "staerken",
      "referenzen",
    ] as const;
    const migrated = ensureFixedFamilySection({
      ...DEMO_CV,
      sectionOrder: [...sectionOrder],
    });

    expect(migrated.sectionOrder).toEqual(sectionOrder);
  });

  test("uses family as the second default rubric", () => {
    expect(DEMO_CV.sectionOrder?.slice(0, 3)).toEqual(["person", "custom:familie", "schule"]);
  });

  test("uses the requested family example in the demo CV", () => {
    const family = DEMO_CV.customSections?.find((section) => section.id === "familie");
    expect(JSON.stringify(family)).toContain("Monika Müller");
    expect(JSON.stringify(family)).toContain("Peter Müller");
    expect(JSON.stringify(family)).toContain("Aline");
    expect(JSON.stringify(family)).toContain("Jaro");
  });
});
