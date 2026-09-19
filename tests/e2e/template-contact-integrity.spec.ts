import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const EXPECTED_TEMPLATE_COUNT = 39;
const CONTACT_SEED =
  process.env.E2E_CONTACT_SEED?.trim() ||
  `${Date.now()}-${randomBytes(5).toString("hex")}`;

type RunContact = {
  firstName: string;
  lastName: string;
  fullName: string;
  address: string;
  place: string;
  phone: string;
  email: string;
};

function contactForSeed(seed: string): RunContact {
  const digest = createHash("sha256").update(seed).digest();
  const token = digest.subarray(0, 6).toString("hex");
  const postcode = 1000 + digest.readUInt16BE(6) % 8000;
  const streetNumber = 1 + digest[8]! % 199;
  const phoneTail = Array.from(digest.subarray(9, 13), (value) =>
    String(value % 100).padStart(2, "0"),
  ).join(" ");

  const firstName = `Run${token.slice(0, 6)}`;
  const lastName = `Kontakt${token.slice(6)}`;
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    address: `Seedweg ${streetNumber}`,
    place: `${postcode} Testort-${token.slice(0, 4)}`,
    phone: `+41 79 ${phoneTail}`,
    email: `e2e.${token}@example.test`,
  };
}

const contactChromeOptions = {
  headerMode: "contact",
  headerShowName: true,
  headerShowAddress: true,
  headerShowPhone: true,
  headerShowEmail: true,
  headerDifferentFirstPage: true,
  headerHeightMm: 44,
  headerGapMm: 4,
  headerContentOffsetYMm: 0,
  letterRecipientOffsetYMm: 0,
  headerTextLayout: "stacked",
  headerInlineSeparator: "dot",
  headerBackgroundColor: null,
  headerGradientColor: null,
  footerMode: "compact",
  footerHeightMm: null,
  footerContentOffsetYMm: 0,
  footerTextLayout: "inline",
  footerBackgroundColor: null,
  footerGradientColor: null,
  borderEnabled: false,
  borderColor: null,
  borderWidthMm: 0.6,
  textFont: null,
} as const;

function personSection(page: Page) {
  return page.locator('[data-editor-section-title="Persönliche Angaben"]');
}

async function seedStaleDossier(page: Page) {
  await page.addInitScript(
    ({ chromeOptions }) => {
      const stalePerson = {
        vorname: "Alt",
        nachname: "Titelblatt",
        adresse: "Veraltete Strasse 1",
        plzOrt: "9999 Altort",
        telefon: "+41 00 000 00 00",
        email: "stale@example.test",
      };

      localStorage.clear();
      localStorage.setItem(
        "titelblatt:v3",
        JSON.stringify({
          version: 7,
          template: "modern",
          colors: {
            modern: {
              bg: "#ffffff",
              primary: "#24364b",
              accent: "#d6a47d",
              ink: "#1f2937",
            },
          },
          layout: { modern: {} },
          customs: [],
          fontScale: 1,
          data: {
            meta: { title: "", author: "", subject: "", keywords: "" },
            kicker: "",
            eyebrow: "",
            beruf: "Informatiker/in EFZ",
            lehrbeginn: "August 2027",
            ...stalePerson,
            geburtsdatum: "",
            lehrbetrieb: "",
            ansprechperson: "",
            betriebAdresse: "",
            ort: "Altort",
            datum: "",
            labelKontakt: "",
            labelEmpfaenger: "",
            foto: null,
          },
        }),
      );
      localStorage.setItem(
        "lebenslauf:v1",
        JSON.stringify({
          version: 6,
          data: {
            person: {
              ...stalePerson,
              untertitel: "E2E Kontaktprüfung",
              geburtsdatum: "",
              nationalitaet: "",
              foto: null,
            },
            schule: [],
            erfahrung: [],
            sprachen: [],
            hobbys: [],
            staerken: [],
            referenzen: [],
            customSections: [],
            labels: {},
            hidden: {},
          },
          design: {
            template: "brief",
            colors: {
              bg: "#ffffff",
              ink: "#111111",
              primary: "#111111",
              accent: "#111111",
            },
            bgOpacity: 0.25,
            useElements: false,
          },
          elements: [],
        }),
      );
      localStorage.setItem(
        "bewerbungsdossier:chrome:v1",
        JSON.stringify({
          version: 1,
          sync: true,
          shared: chromeOptions,
          cv: chromeOptions,
          letter: chromeOptions,
        }),
      );
    },
    { chromeOptions: contactChromeOptions },
  );

  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page
    .locator('[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page="0"]')
    .waitFor({ state: "visible" });

  // The route restores localStorage in an effect after the first paint. Do not
  // race a real user edit against that hydration: first prove the seeded CV has
  // reached the controlled editor fields, then replace it with this run's data.
  const section = personSection(page);
  await expect(section).toBeVisible();
  await expect(section.getByLabel("Vorname", { exact: true })).toHaveValue("Alt");
  await expect(section.getByLabel("Nachname", { exact: true })).toHaveValue("Titelblatt");
  await expect(section.getByLabel("E-Mail", { exact: true })).toHaveValue("stale@example.test");
}

async function fillLiveContact(page: Page, contact: RunContact) {
  const section = personSection(page);
  await expect(section).toBeVisible();

  const fields = [
    ["Vorname", contact.firstName],
    ["Nachname", contact.lastName],
    ["Adresse", contact.address],
    ["PLZ und Ort", contact.place],
    ["Telefon", contact.phone],
    ["E-Mail", contact.email],
  ] as const;

  for (const [label, value] of fields) {
    await section.getByLabel(label, { exact: true }).fill(value);
  }

  // Prove that the controlled CV state accepted every live edit before we test
  // the rendered contact chrome. This makes a state reset distinguishable from
  // a header/contact-resolution bug.
  for (const [label, value] of fields) {
    await expect(
      section.getByLabel(label, { exact: true }),
      `${label}: live CV edit was reset or not accepted`,
    ).toHaveValue(value);
  }
}

async function expectCurrentContact(page: Page, contact: RunContact, templateName: string) {
  const header = page
    .locator(
      '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page="0"] [data-dossier-integrated-contact]',
    )
    .first();

  await expect(header, `${templateName}: contact header missing`).toBeVisible();
  await expect
    .poll(() => header.innerText(), {
      message: `${templateName}: contact header did not receive the live CV values`,
    })
    .toContain(contact.fullName);

  const text = await header.innerText();
  for (const value of [
    contact.fullName,
    contact.address,
    contact.place,
    contact.phone,
    contact.email,
  ]) {
    expect(text, `${templateName}: missing ${value}`).toContain(value);
  }

  expect(text, `${templateName}: stale title-page identity leaked into the CV header`).not.toContain(
    "Alt Titelblatt",
  );
  expect(text).not.toContain("stale@example.test");
}

test.describe("template contact integrity", () => {
  test.setTimeout(180_000);

  test("all 39 templates render the newly entered run-specific contact", async ({ page }) => {
    const contact = contactForSeed(CONTACT_SEED);
    test.info().annotations.push({ type: "contact-seed", description: CONTACT_SEED });
    console.info(
      `[template-contact-integrity] seed=${CONTACT_SEED} contact=${JSON.stringify(contact)}`,
    );

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await seedStaleDossier(page);
    await fillLiveContact(page, contact);
    await expectCurrentContact(page, contact, "initial render");

    const templateSection = page.locator('[data-editor-section-title="Vorlage"]');
    const toggle = templateSection.locator("[data-editor-section-toggle]");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    const templateButtons = templateSection.locator(
      "[data-editor-section-body] .grid.grid-cols-3 > button[title]",
    );
    await expect(templateButtons).toHaveCount(EXPECTED_TEMPLATE_COUNT);

    const templateNames = (await templateButtons.allTextContents()).map((name) => name.trim());
    expect(new Set(templateNames).size).toBe(EXPECTED_TEMPLATE_COUNT);

    for (const templateName of templateNames) {
      const button = templateSection.getByRole("button", { name: templateName, exact: true });
      await button.click();
      await expect(button, `${templateName}: selection did not settle`).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expectCurrentContact(page, contact, templateName);
    }

    expect(pageErrors, "browser page errors while switching templates").toEqual([]);
  });
});
