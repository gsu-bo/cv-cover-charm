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
    expect(migrated.sectionOrder).toContain("custom:familie");
  });

  test("uses the requested family example in the demo CV", () => {
    const family = DEMO_CV.customSections?.find((section) => section.id === "familie");
    expect(JSON.stringify(family)).toContain("Monika Müller");
    expect(JSON.stringify(family)).toContain("Peter Müller");
    expect(JSON.stringify(family)).toContain("Aline");
    expect(JSON.stringify(family)).toContain("Jaro");
  });
});
