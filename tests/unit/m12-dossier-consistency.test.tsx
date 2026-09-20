import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FRESH_TEMPLATE_IDS,
  type FreshTemplateId,
} from "../../src/components/cover/fresh-template-registry";
import { TEMPLATES, type TemplateId } from "../../src/components/cover/types";
import { DossierHeaderFooterChrome } from "../../src/components/dossier/DossierHeaderFooterChrome";
import { freshLetterSpec } from "../../src/components/letter/fresh-letter-system";
import {
  defaultLetterColors,
  type LetterTemplateId,
} from "../../src/components/letter/types";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  type DossierChromeOptions,
} from "../../src/lib/dossier-chrome";
import {
  FRESH_DOSSIER_IDENTITIES,
  freshDossierIdentity,
} from "../../src/lib/fresh-dossier-contract";
import { effectiveDossierFont } from "../../src/lib/dossier-theme";

const contact = {
  name: "Lea Müller",
  address: "Dorfstrasse 12",
  place: "4535 Hubersdorf",
  phone: "079 123 45 67",
  email: "lea.mueller@example.ch",
};

function chromeMarkup(
  scope: "cv" | "letter",
  template: FreshTemplateId,
  options: DossierChromeOptions,
  pageIndex = 0,
) {
  const identity = freshDossierIdentity(template);
  return renderToStaticMarkup(
    createElement(DossierHeaderFooterChrome, {
      scope,
      template,
      colors: identity.palette,
      contact,
      pageIndex,
      options,
      footerHeightMm: options.footerMode === "details" ? 12 : undefined,
      footerLabel: scope === "letter" ? "Beilagen:" : undefined,
      footerDetails: scope === "letter" ? ["Lebenslauf", "Zeugnis"] : [],
      footerLeft: scope === "cv" ? contact.name : undefined,
      footerRight: scope === "cv" ? `Seite ${pageIndex + 1}` : undefined,
    }),
  );
}

function options(
  headerMode: DossierChromeOptions["headerMode"],
  footerMode: DossierChromeOptions["footerMode"],
): DossierChromeOptions {
  return { ...DEFAULT_DOSSIER_CHROME_OPTIONS, headerMode, footerMode };
}

describe("M12 Fresh dossier consistency", () => {
  test("all 21 active Fresh templates have one cross-document identity contract", () => {
    expect(FRESH_TEMPLATE_IDS).toHaveLength(21);
    expect(Object.keys(FRESH_DOSSIER_IDENTITIES)).toHaveLength(21);

    for (const id of FRESH_TEMPLATE_IDS) {
      const identity = freshDossierIdentity(id);
      const definition = TEMPLATES.find((template) => template.id === id);
      const templateId = id as unknown as TemplateId;
      const letterTemplate = id as unknown as LetterTemplateId;

      expect(definition, id).toBeDefined();
      expect(identity.name).toBe(definition?.name);
      expect(identity.palette).toEqual(defaultLetterColors(letterTemplate));
      expect(identity.fontStack).toBe(effectiveDossierFont(templateId));
      expect(identity.coverRole).toBe("expressive");
      expect(identity.letterRole).toBe("restrained");
      expect(identity.cvRole).toBe("information");
      expect(identity.letterArchetype).toBe(freshLetterSpec(id)?.archetype);
    }
  });

  test("compact, contact and no-header mean the same thing in CV and letter for every Fresh template", () => {
    for (const id of FRESH_TEMPLATE_IDS) {
      for (const scope of ["cv", "letter"] as const) {
        const compact = chromeMarkup(scope, id, options("compact", "compact"));
        expect(compact, `${id}/${scope}/compact`).toContain("data-dossier-compact-header");
        expect(compact).not.toContain("data-dossier-integrated-contact");
        expect(compact).not.toContain(contact.name);

        const contactHeader = chromeMarkup(scope, id, options("contact", "compact"));
        expect(contactHeader, `${id}/${scope}/contact`).toContain(
          "data-dossier-integrated-contact",
        );
        expect(contactHeader).toContain(contact.name);
        expect(contactHeader).toContain(contact.address);
        expect(contactHeader).toContain(contact.place);
        expect(contactHeader).toContain(contact.email);
        expect(contactHeader).toContain(contact.phone);

        const none = chromeMarkup(scope, id, options("none", "compact"));
        expect(none, `${id}/${scope}/none`).not.toContain("data-dossier-compact-header");
        expect(none).not.toContain("data-dossier-integrated-contact");
        expect(none).not.toContain("data-dossier-continuation-contact-header");
      }
    }
  });

  test("compact, detailed and no-footer stay synchronized while document-specific details remain appropriate", () => {
    for (const id of FRESH_TEMPLATE_IDS) {
      for (const scope of ["cv", "letter"] as const) {
        const compact = chromeMarkup(scope, id, options("compact", "compact"));
        expect(compact, `${id}/${scope}/compact-footer`).toContain(
          'data-dossier-footer="compact"',
        );

        const none = chromeMarkup(scope, id, options("compact", "none"));
        expect(none, `${id}/${scope}/no-footer`).not.toContain("data-dossier-footer=");
      }

      const cvDetails = chromeMarkup("cv", id, options("compact", "details"), 1);
      expect(cvDetails, `${id}/cv/details`).toContain('data-dossier-footer="details"');
      expect(cvDetails).toContain(contact.name);
      expect(cvDetails).not.toContain("Seite 2");

      const letterDetails = chromeMarkup("letter", id, options("compact", "details"));
      expect(letterDetails, `${id}/letter/details`).toContain('data-dossier-footer="details"');
      expect(letterDetails).toContain("Beilagen:");
      expect(letterDetails).toContain("Lebenslauf");
      expect(letterDetails).toContain("Zeugnis");
    }
  });

  test("default contact repeats the full shared header and CV never falls back to Seite N", () => {
    for (const id of FRESH_TEMPLATE_IDS) {
      for (const scope of ["cv", "letter"] as const) {
        const html = chromeMarkup(scope, id, options("contact", "compact"), 1);
        expect(html, `${id}/${scope}/continuation`).toContain("data-dossier-integrated-contact");
        expect(html).not.toContain("data-dossier-continuation-contact-header");
        expect(html).toContain(contact.name);
        expect(html).toContain(contact.email);
        expect(html).toContain(contact.phone);
        expect(html).toContain(contact.address);
        expect(html).toContain(contact.place);
      }

      const cv = chromeMarkup("cv", id, options("contact", "details"), 1);
      expect(cv).not.toContain("Seite 2");
    }
  });
});
