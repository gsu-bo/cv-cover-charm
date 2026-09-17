from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {path}, got {text.count(old)}")
    file.write_text(text.replace(old, new, 1))


# A — a contact header is chrome; it must never erase the semantic CV body identity.
replace_once(
    "src/lib/dossier-body-contact.ts",
    '''  const person = data.person;\n  const hasName = !!(person.vorname?.trim() || person.nachname?.trim());\n  return {\n    ...data,\n    person: {\n      ...person,\n      ...(options.headerShowName && hasName ? { vorname: "\\u200b", nachname: "" } : {}),\n      ...(options.headerShowAddress ? { adresse: "", plzOrt: "" } : {}),''',
    '''  const person = data.person;\n  return {\n    ...data,\n    person: {\n      ...person,\n      ...(options.headerShowAddress ? { adresse: "", plzOrt: "" } : {}),''',
)

# B — only the canonical neutral Brief + Standard/classic CV defaults to identity left / photo right.
base = Path("src/components/cv/CvCanvasBase.tsx")
text = base.read_text()
marker = '    const classicHeader = (withName: boolean): Row => ({'
marker_at = text.find(marker)
if marker_at < 0:
    raise SystemExit("classicHeader marker not found")
old_style = '          style={{ display: "flex", gap: "7mm", alignItems: "flex-start", marginBottom: "3.2mm" }}'
style_at = text.find(old_style, marker_at)
if style_at < 0:
    raise SystemExit("classicHeader style not found")
new_style = '''          style={{\n            display: "flex",\n            flexDirection: design.template === "brief" ? "row-reverse" : undefined,\n            gap: "7mm",\n            alignItems: "flex-start",\n            marginBottom: "3.2mm",\n          }}'''
text = text[:style_at] + new_style + text[style_at + len(old_style):]

# C — paginated rows cache React nodes. Photo mode must invalidate that cache,
# otherwise an old automatic-photo row can survive while the free photo appears.
old_shape = '  const shape = `${chromeShape}|${layoutChoice}|${layout}|${frame.id}|${design.font ?? "template"}|${placementShape}|${sectionLayoutShape}|${rows'
new_shape = '  const shape = `${chromeShape}|photo:${place.mode}|${layoutChoice}|${layout}|${frame.id}|${design.font ?? "template"}|${placementShape}|${sectionLayoutShape}|${rows'
if text.count(old_shape) != 1:
    raise SystemExit(f"expected one pagination shape match, got {text.count(old_shape)}")
text = text.replace(old_shape, new_shape, 1)
base.write_text(text)

# Preserve the existing mirror toggle relative to the new Brief default.
css = Path("src/components/cv/layout-options.css")
css_text = css.read_text()
mirror_fix = '''\n\n/* Package 1: Brief/Standard defaults to photo right; mirrored still flips that default. */\nhtml[data-cv-mirrored="true"]\n  [data-dossier-document="cv"][data-cv-template="brief"][data-cv-layout="classic"]\n  [data-cv-page="0"]\n  [data-cv-header] {\n  flex-direction: row !important;\n}\n'''
if "Package 1: Brief/Standard defaults to photo right" not in css_text:
    css.write_text(css_text.rstrip() + mirror_fix)

Path("tests/unit/cv-top-area-package1.test.ts").write_text(r'''import { describe, expect, test } from "bun:test";
import { DEMO_CV } from "../../src/components/cv/types";
import { CANONICAL_DOSSIER_CHROME_OPTIONS } from "../../src/lib/dossier-chrome";
import { cvBodyData } from "../../src/lib/dossier-body-contact";

const person = {
  ...DEMO_CV.person,
  vorname: "Lea",
  nachname: "Müller",
  untertitel: "hugubugu",
  adresse: "Dorfstrasse 12",
  plzOrt: "4535 Hubersdorf",
  telefon: "+41 79 000 00 00",
  email: "lea@example.ch",
};

const data = { ...DEMO_CV, person };

describe("Package 1 CV top-area semantics", () => {
  test("a contact header containing the name never suppresses the CV body identity", () => {
    const result = cvBodyData(data, {
      ...CANONICAL_DOSSIER_CHROME_OPTIONS,
      headerMode: "contact",
      headerShowName: true,
      headerShowAddress: true,
      headerShowPhone: true,
      headerShowEmail: true,
    });

    expect(result.person.vorname).toBe("Lea");
    expect(result.person.nachname).toBe("Müller");
    expect(result.person.untertitel).toBe("hugubugu");
    expect(result.person.adresse).toBe("");
    expect(result.person.plzOrt).toBe("");
    expect(result.person.telefon).toBe("");
    expect(result.person.email).toBe("");
  });

  test("body identity is unchanged whether the contact header shows its own name or not", () => {
    for (const headerShowName of [false, true]) {
      const result = cvBodyData(data, {
        ...CANONICAL_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerShowName,
        headerShowAddress: false,
        headerShowPhone: false,
        headerShowEmail: false,
      });
      expect(`${result.person.vorname} ${result.person.nachname}`).toBe("Lea Müller");
      expect(result.person.untertitel).toBe("hugubugu");
    }
  });

  test("an empty line-under-name does not affect the body name", () => {
    const result = cvBodyData(
      { ...data, person: { ...person, untertitel: "" } },
      {
        ...CANONICAL_DOSSIER_CHROME_OPTIONS,
        headerMode: "contact",
        headerShowName: true,
      },
    );
    expect(result.person.vorname).toBe("Lea");
    expect(result.person.nachname).toBe("Müller");
    expect(result.person.untertitel).toBe("");
  });
});
''')

Path("tests/e2e/cv-top-area-package1.spec.ts").write_text(r'''import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";

const cvPayload = {
  version: 6,
  data: {
    titel: "Lebenslauf",
    person: {
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 000 00 00",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      nationalitaet: "Schweiz",
      untertitel: "hugubugu",
      foto: PHOTO,
    },
    schule: [],
    erfahrung: [],
    sprachen: [],
    hobbys: [],
    staerken: [],
    referenzen: [],
    labels: {},
    hidden: {},
  },
  design: {
    template: "brief",
    colors: { primary: "#24364b", accent: "#d6a47d", bg: "#ffffff" },
    bgOpacity: 0.25,
    useElements: false,
  },
  elements: [],
};

async function seed(page: Page) {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ cv }) => {
    localStorage.clear();
    localStorage.setItem("lebenslauf:v1", JSON.stringify(cv));
    localStorage.setItem("lebenslauf:layout:v1", "classic");
    localStorage.setItem(
      "lebenslauf:photo-place:v1",
      JSON.stringify({ mode: "auto", xMm: 147, yMm: 23, widthMm: 41, frameColor: "#123456" }),
    );
    localStorage.setItem(
      "lebenslauf:photo:v2",
      JSON.stringify({ shape: "square", zoom: 1.15, x: 0.42, y: 0.61, borderWidth: 1.5 }),
    );
    localStorage.setItem(
      "bewerbungsdossier:chrome:v1",
      JSON.stringify({
        version: 1,
        sync: false,
        cv: {
          headerMode: "contact",
          headerShowName: true,
          headerShowAddress: true,
          headerShowPhone: true,
          headerShowEmail: true,
          footerMode: "none",
        },
        letter: { headerMode: "none", footerMode: "none" },
        shared: { headerMode: "none", footerMode: "none" },
      }),
    );
  }, { cv: cvPayload });
  await page.reload({ waitUntil: "domcontentloaded" });
}

const preview = (page: Page) =>
  page.locator('[data-dossier-document="cv"][data-export-mode="false"]').first();

async function setPhotoMode(page: Page, mode: "auto" | "frei") {
  await page.evaluate(async (nextMode) => {
    const module = await import("/src/components/cv/photo-place.ts");
    module.setCvPhotoPlacement({ mode: nextMode });
  }, mode);
}

test.describe("Package 1 CV top-area regression", () => {
  test.setTimeout(60_000);

  test("body identity survives a name-bearing header and Brief/Standard auto photo is top-right", async ({ page }) => {
    await seed(page);
    const cv = preview(page);
    await expect(cv).toBeVisible();

    const bodyName = cv.locator("[data-cv-name]").first();
    const subtitle = cv.locator("[data-cv-subtitle]").first();
    const header = cv.locator('[data-dossier-chrome="cv"]').first();
    await expect(bodyName).toHaveText("Lea Müller");
    await expect(subtitle).toHaveText("hugubugu");
    await expect(header).toContainText("Lea Müller");

    const photo = cv.locator('[data-cv-page="0"] [data-cv-photo]');
    await expect(photo).toHaveCount(1);
    const [nameBox, photoBox] = await Promise.all([bodyName.boundingBox(), photo.boundingBox()]);
    expect(nameBox).not.toBeNull();
    expect(photoBox).not.toBeNull();
    expect(photoBox!.x).toBeGreaterThan(nameBox!.x);
  });

  test("Auto/Free repeatedly renders one logical photo and preserves its configuration", async ({ page }) => {
    await seed(page);
    const cv = preview(page);
    const photos = cv.locator('[data-cv-page="0"] [data-cv-photo]');

    for (const mode of ["frei", "auto", "frei", "auto", "frei", "auto"] as const) {
      await setPhotoMode(page, mode);
      await expect(photos).toHaveCount(1);
      if (mode === "frei") await expect(cv.locator("[data-cv-photo-free]")).toHaveCount(1);
      else await expect(cv.locator("[data-cv-photo-free]")).toHaveCount(0);
    }

    const placement = await page.evaluate(async () => {
      const module = await import("/src/components/cv/photo-place.ts");
      return module.getCvPhotoPlacement();
    });
    expect(placement).toMatchObject({
      mode: "auto",
      xMm: 147,
      yMm: 23,
      widthMm: 41,
      frameColor: "#123456",
    });
  });

  test("all supported photo shapes stay single-instance across positioning modes", async ({ page }) => {
    await seed(page);
    const cv = preview(page);
    const photos = cv.locator('[data-cv-page="0"] [data-cv-photo]');

    for (const shape of ["rect", "square", "portrait", "circle"] as const) {
      await page.evaluate(async (nextShape) => {
        const module = await import("/src/components/cv/photo.ts");
        module.setCvPhotoStyle({ shape: nextShape });
      }, shape);
      await setPhotoMode(page, "frei");
      await expect(photos).toHaveCount(1);
      await setPhotoMode(page, "auto");
      await expect(photos).toHaveCount(1);
    }
  });
});
''')
