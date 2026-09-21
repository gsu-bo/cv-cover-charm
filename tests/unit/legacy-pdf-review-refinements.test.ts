import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildBlocks } from "../../src/components/cover/layouts";
import { DEMO_DATA, TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { defaultCvLayoutForTemplate } from "../../src/components/cv/layout";
import { familyForTemplate } from "../../src/lib/dossier-family";

const refinements = readFileSync(
  new URL("../../src/components/dossier/legacy-template-refinements.css", import.meta.url),
  "utf8",
);
const humanPolish = readFileSync(
  new URL("../../src/components/dossier/human-polish.css", import.meta.url),
  "utf8",
);

function blockigBlocks() {
  const template = TEMPLATES.find(({ id }) => id === "blockig");
  if (!template) throw new Error("Missing Blockig template");
  return buildBlocks("blockig" as TemplateId, DEMO_DATA, [], {}, template.slots);
}

describe("legacy PDF review refinements", () => {
  test("Blockig starts from a real modular grid while keeping every module editable", () => {
    const blocks = blockigBlocks();
    const byId = (id: string) => {
      const block = blocks.find((candidate) => candidate.id === id);
      if (!block) throw new Error(`Missing Blockig block ${id}`);
      return block;
    };

    expect(byId("decor-top-block").style).toMatchObject({ x: 0, y: 0, w: 72 });
    expect(byId("decor-accent-band").style).toMatchObject({ x: 72, y: 0, w: 44 });
    expect(byId("decor-top-right").style).toMatchObject({ x: 174, y: 0, w: 36 });
    expect(byId("decor-bottom-block").style).toMatchObject({ x: 0, y: 244, w: 72 });
    expect(byId("beruf").style).toMatchObject({ x: 86, y: 106, w: 108, size: 29 });
    expect(byId("kontakt").style).toMatchObject({ x: 15, w: 48, color: "bg" });
    expect(byId("trenner").style.hidden).toBe(true);
  });

  test("Blockig user geometry overrides still win over the redesigned defaults", () => {
    const template = TEMPLATES.find(({ id }) => id === "blockig");
    if (!template) throw new Error("Missing Blockig template");
    const blocks = buildBlocks(
      "blockig" as TemplateId,
      DEMO_DATA,
      [],
      { beruf: { x: 33, size: 21 }, "decor-top-block": { w: 61 } },
      template.slots,
    );
    expect(blocks.find(({ id }) => id === "beruf")?.style.x).toBe(33);
    expect(blocks.find(({ id }) => id === "beruf")?.style.size).toBe(21);
    expect(blocks.find(({ id }) => id === "decor-top-block")?.style.w).toBe(61);
  });

  test("Human CV removes the clipped lower dot but keeps the general Human motif available elsewhere", () => {
    expect(humanPolish).toContain('[data-dossier-document="cv"]');
    expect(humanPolish).toContain('> div:nth-of-type(2)');
    expect(humanPolish).toContain("display: none !important;");
  });

  test("Colorful keeps its geometric CV card without reviving the detached blue/yellow bar", () => {
    expect(refinements).toContain('data-dossier-template="colorful"');
    expect(refinements).toContain("border-left: 2.2mm solid var(--cover-secondary);");
    expect(refinements).toContain("var(--cover-tertiary)");
    expect(refinements).not.toContain('[data-cv-header]::after');
    expect(refinements).toContain("[data-dossier-integrated-contact]");
    expect(refinements).toContain("color: #fff !important;");
  });

  test("Kolumne starts as Sidebar and uses one modern heading family", () => {
    expect(defaultCvLayoutForTemplate("terracotta")).toBe("modern");
    expect(defaultCvLayoutForTemplate("colorful")).toBe("classic");
    expect(familyForTemplate("terracotta" as TemplateId)).toBe("modern");
    expect(refinements).toContain('data-dossier-template="terracotta"');
    expect(refinements).toContain('[data-cv-section-title]');
  });
});
