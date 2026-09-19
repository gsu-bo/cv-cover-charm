import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverBackground } from "../../src/components/cover/CoverBackground";
import {
  FRESH_TEMPLATE_IDS,
  FRESH_TEMPLATE_REGISTRY,
} from "../../src/components/cover/fresh-template-registry";
import "../../src/components/cover/fresh-templates";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";

function defaultColors(template: TemplateId) {
  const definition = TEMPLATES.find(({ id }) => id === template);
  if (!definition) throw new Error(`Missing template definition for ${template}`);
  return Object.fromEntries(definition.slots.map(({ key, default: value }) => [key, value]));
}

describe("Fresh title-page background contract", () => {
  test("canonical Fresh registry remains complete after retired templates are removed", () => {
    expect(FRESH_TEMPLATE_REGISTRY).toHaveLength(21);
    expect(FRESH_TEMPLATE_IDS).toHaveLength(21);
    expect(TEMPLATES).toHaveLength(41);
    const ids = TEMPLATES.map(({ id }) => id as string);
    expect(ids).not.toContain("edelBlockig");
    expect(ids).not.toContain("sonnig");
    expect(ids).not.toContain("frame");
    expect(
      TEMPLATES.filter(({ id }) => FRESH_TEMPLATE_IDS.includes(id as never)).map(
        ({ id }) => id as string,
      ),
    ).toEqual(FRESH_TEMPLATE_IDS);
    expect((TEMPLATES.at(-1)?.id as string) ?? "").toBe("edelDark");
    expect(FRESH_TEMPLATE_REGISTRY[0]).toMatchObject({ id: "edge", name: "Edge" });
    expect(FRESH_TEMPLATE_REGISTRY.at(-1)).toMatchObject({ id: "cove", name: "Cove" });
  });

  test("every Fresh template renders the shared three-field structural scaffold", () => {
    for (const template of FRESH_TEMPLATE_IDS) {
      const templateId = template as TemplateId;
      const colors = defaultColors(templateId);
      const markup = renderToStaticMarkup(
        createElement(CoverBackground, {
          template: templateId,
          colors,
        }),
      );

      expect(markup).toContain(`data-fresh-cover-background="${template}"`);
      expect(markup).toContain('data-fresh-cover-field="primary"');
      expect(markup).toContain('data-fresh-cover-field="secondary"');
      expect(markup).toContain('data-fresh-cover-field="accent"');
      expect(markup.match(/data-fresh-cover-field=/g)?.length).toBe(3);

      const definition = TEMPLATES.find(({ id }) => id === templateId);
      const primary = definition?.slots.find(({ key }) => key === "primary")?.default;
      const secondary = definition?.slots.find(({ key }) => key === "secondary")?.default;
      const accent = definition?.slots.find(({ key }) => key === "accent")?.default;
      if (primary) expect(markup).toContain(`background-color:${primary}`);
      if (secondary) expect(markup).toContain(`background-color:${secondary}`);
      if (accent) expect(markup).toContain(`background-color:${accent}`);
    }
  });

  test("legacy title-page templates do not receive the Fresh scaffold", () => {
    const markup = renderToStaticMarkup(
      createElement(CoverBackground, {
        template: "modern",
        colors: defaultColors("modern"),
      }),
    );

    expect(markup).not.toContain("data-fresh-cover-background");
    expect(markup).not.toContain("data-fresh-cover-field");
  });
});
