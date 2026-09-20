import { describe, expect, test } from "bun:test";
import { FRESH_TEMPLATE_REGISTRY } from "../../src/components/cover/fresh-template-registry";
import { buildBlocks } from "../../src/components/cover/layouts";
import { DEMO_DATA, TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { familyForTemplate } from "../../src/lib/dossier-family";
import { dossierDefaultFontKey, effectiveDossierFont } from "../../src/lib/dossier-theme";

function fresh(id: string) {
  const template = FRESH_TEMPLATE_REGISTRY.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Missing Fresh template: ${id}`);
  return template;
}

function editorialBlocks(overrides = {}) {
  const template = TEMPLATES.find((candidate) => candidate.id === "klassisch");
  if (!template) throw new Error("Missing Editorial template");
  return buildBlocks(template.id, DEMO_DATA, [], overrides, template.slots);
}

function blockStyle(id: string) {
  const block = editorialBlocks().find((candidate) => candidate.id === id);
  if (!block) throw new Error(`Missing Editorial block: ${id}`);
  return block.style;
}

describe("template typography contracts", () => {
  test.each([
    ["forestFlow", "executive", "serif", "Palatino"],
    ["monoLuxe", "editorial", "serif", "Georgia"],
    ["edge", "modern", "sans", "Helvetica"],
  ] as const)("Fresh %s resolves through its real dossier family", (id, family, key, stack) => {
    const template = id as TemplateId;
    expect(familyForTemplate(template)).toBe(family);
    expect(dossierDefaultFontKey(template)).toBe(key);
    expect(effectiveDossierFont(template)).toContain(stack);

    const definition = fresh(id);
    const blocks = buildBlocks(template, DEMO_DATA, [], {}, definition.slots.map((slot) => ({ ...slot })));
    const dossierText = blocks.filter(
      (block) => block.kind === "text" && ["eyebrow", "beruf", "name", "kontakt"].includes(block.id),
    );
    expect(dossierText.length).toBeGreaterThan(0);
    expect(new Set(dossierText.map((block) => block.style.font))).toEqual(new Set([key]));
  });

  test("02 Editorial uses one restrained serif hierarchy", () => {
    expect(blockStyle("eyebrow")).toMatchObject({
      font: "serif",
      uppercase: false,
      weight: 600,
      tracking: 0.04,
    });
    expect(blockStyle("kicker")).toMatchObject({
      font: "serif",
      uppercase: false,
      weight: 600,
      tracking: 0.04,
    });
    expect(blockStyle("beruf")).toMatchObject({
      font: "serif",
      italic: true,
      weight: 600,
      tracking: 0,
    });
    expect(blockStyle("name")).toMatchObject({ font: "serif", weight: 700, tracking: -0.01 });
    expect(blockStyle("ortDatum")).toMatchObject({ font: "serif", italic: false, tracking: 0 });
    expect(blockStyle("lehrbeginn")).toMatchObject({ font: "serif", italic: false, tracking: 0 });
    expect(blockStyle("kontaktTitel")).toMatchObject({
      font: "serif",
      uppercase: false,
      weight: 600,
      tracking: 0.04,
    });
  });

  test("explicit Editorial element typography still wins over the new defaults", () => {
    const blocks = editorialBlocks({
      kicker: { uppercase: true, tracking: 0.2, weight: 400 },
      lehrbeginn: { italic: true },
    });
    const kicker = blocks.find((block) => block.id === "kicker")?.style;
    const lehrbeginn = blocks.find((block) => block.id === "lehrbeginn")?.style;

    expect(kicker).toMatchObject({ uppercase: true, tracking: 0.2, weight: 400 });
    expect(lehrbeginn).toMatchObject({ italic: true });
  });
});
