import { expect, test, type Locator, type Page } from "@playwright/test";
import { inflateSync } from "node:zlib";

const BASE_URL = "http://127.0.0.1:4173";

const TEMPLATES = [
  {
    id: "edge",
    colors: {
      bg: "#f7f7f4",
      primary: "#182433",
      secondary: "#4da3ff",
      accent: "#2f7de1",
      ink: "#18202a",
    },
  },
  {
    id: "glow",
    colors: {
      bg: "#f7f9ff",
      primary: "#6d5dfb",
      secondary: "#7dd3fc",
      accent: "#14b8a6",
      ink: "#172033",
    },
  },
  {
    id: "monoLuxe",
    colors: {
      bg: "#f8f6f1",
      primary: "#171717",
      secondary: "#b08d57",
      accent: "#8e6f42",
      ink: "#171717",
    },
  },
  {
    id: "horizon",
    colors: {
      bg: "#f6f9ff",
      primary: "#11233f",
      secondary: "#2f6dff",
      accent: "#6fc3ff",
      ink: "#152033",
    },
  },
  {
    id: "sunrise",
    colors: {
      bg: "#fff8f2",
      primary: "#ff7a59",
      secondary: "#ffb27a",
      accent: "#f4c76a",
      ink: "#3a2a24",
    },
  },
  {
    id: "forestFlow",
    colors: {
      bg: "#f5f8f4",
      primary: "#1f4d43",
      secondary: "#2e8b7f",
      accent: "#9abf9c",
      ink: "#1d2b27",
    },
  },
  {
    id: "violetPulse",
    colors: {
      bg: "#faf7ff",
      primary: "#4338ca",
      secondary: "#7c3aed",
      accent: "#d946ef",
      ink: "#1f1733",
    },
  },
  {
    id: "studio2",
    colors: {
      bg: "#fbfbf8",
      primary: "#202a3b",
      secondary: "#f2c84b",
      accent: "#e78a2f",
      ink: "#1b2430",
    },
  },
  {
    id: "studio3",
    colors: {
      bg: "#f7fbfa",
      primary: "#173d3a",
      secondary: "#5ec6b6",
      accent: "#e2a94b",
      ink: "#18302d",
    },
  },
  {
    id: "warm2",
    colors: {
      bg: "#fff7f0",
      primary: "#d95f4c",
      secondary: "#f6b26b",
      accent: "#7f9b76",
      ink: "#3a2521",
    },
  },
  {
    id: "warm3",
    colors: {
      bg: "#fbf7ef",
      primary: "#1e6f68",
      secondary: "#e5a84f",
      accent: "#c86648",
      ink: "#24312e",
    },
  },
] as const;

const coverData = {
  meta: { title: "", author: "", subject: "", keywords: "" },
  kicker: "Bewerbung um eine Lehrstelle als",
  eyebrow: "Bewerbungsdossier",
  beruf: "Informatiker/in EFZ",
  lehrbeginn: "August 2027",
  vorname: "Lea",
  nachname: "Müller",
  adresse: "Bahnhofstrasse 42",
  plzOrt: "8000 Zürich",
  telefon: "+41 79 123 45 67",
  email: "lea@example.ch",
  geburtsdatum: "14.03.2010",
  lehrbetrieb: "Beispiel AG",
  ansprechperson: "Frau Beispiel",
  betriebAdresse: "Musterweg 8, 8000 Zürich",
  ort: "Zürich",
  datum: "22.08.2026",
  labelKontakt: "",
  labelEmpfaenger: "",
  foto: null,
};

function cvData() {
  return {
    titel: "Lebenslauf",
    person: {
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Bahnhofstrasse 42",
      plzOrt: "8000 Zürich",
      telefon: "+41 79 123 45 67",
      email: "lea@example.ch",
      geburtsdatum: "14.03.2010",
      nationalitaet: "Schweiz",
      untertitel: "Schülerin, 3. Sekundarklasse",
      foto: null,
    },
    schule: [
      {
        id: "school-1",
        zeit: "2023 – heute",
        titel: "Sekundarschule",
        ort: "Zürich",
        beschreibung: "",
      },
    ],
    erfahrung: [
      {
        id: "work-1",
        zeit: "Sept. 2026",
        titel: "Schnuppertag",
        ort: "Beispielbetrieb",
        beschreibung: "Einblick in den Berufsalltag.",
      },
    ],
    sprachen: [{ id: "de", name: "Deutsch", niveau: "Muttersprache" }],
    hobbys: ["Volleyball", "Programmieren"],
    staerken: ["Zuverlässig", "Teamfähig"],
    referenzen: [],
    labels: {},
    hidden: {},
  };
}

async function seedCover(page: Page, template: (typeof TEMPLATES)[number]): Promise<Locator> {
  await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload }) => {
      localStorage.clear();
      localStorage.setItem("titelblatt:v3", JSON.stringify(payload));
    },
    {
      payload: {
        version: 6,
        template: template.id,
        colors: { [template.id]: template.colors },
        layout: { [template.id]: {} },
        customs: [],
        fontScale: 1,
        data: coverData,
      },
    },
  );
  await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
  const sheet = page
    .locator(
      `[data-dossier-document="cover"][data-cover-template="${template.id}"]`,
    )
    .first();
  await sheet.waitFor({ state: "visible" });
  return sheet;
}

async function seedCv(page: Page, template: (typeof TEMPLATES)[number]): Promise<Locator> {
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ payload }) => {
      localStorage.clear();
      localStorage.setItem("lebenslauf:v1", JSON.stringify(payload));
      localStorage.setItem("lebenslauf:layout:v1", "classic");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "false");
    },
    {
      payload: {
        version: 2,
        data: cvData(),
        design: {
          template: template.id,
          colors: template.colors,
          bgOpacity: 0.06,
          useElements: false,
        },
        elements: [],
      },
    },
  );
  await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
  const sheet = page
    .locator(
      `[data-dossier-document="cv"][data-cv-template="${template.id}"][data-export-mode="false"] [data-cv-page]`,
    )
    .first();
  await sheet.waitFor({ state: "visible" });
  return sheet;
}

type DecodedPng = { width: number; height: number; channels: number; pixels: Uint8Array };

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buffer: Buffer): DecodedPng {
  expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }

  expect([2, 6]).toContain(colorType);
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = new Uint8Array(width * height * channels);
  let src = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[src++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const encoded = raw[src++];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[prevStart + x - channels] : 0;
      let value = encoded;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      pixels[rowStart + x] = value & 0xff;
    }
  }

  return { width, height, channels, pixels };
}

function rgbAt(image: DecodedPng, x: number, y: number) {
  const i = (y * image.width + x) * image.channels;
  return [image.pixels[i], image.pixels[i + 1], image.pixels[i + 2]] as const;
}

const isWhite = ([r, g, b]: readonly number[]) => r >= 247 && g >= 247 && b >= 247;
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

function edgeLeak(image: DecodedPng) {
  let top = 0;
  let bottom = 0;
  let left = 0;
  let right = 0;
  const inset = 2;

  for (let x = inset; x < image.width - inset; x += 1) {
    const topEdge = rgbAt(image, x, 0);
    const topInner = rgbAt(image, x, Math.min(image.height - 1, 2));
    if (isWhite(topEdge) && !isWhite(topInner) && distance(topEdge, topInner) > 45) top += 1;

    const bottomEdge = rgbAt(image, x, image.height - 1);
    const bottomInner = rgbAt(image, x, Math.max(0, image.height - 3));
    if (isWhite(bottomEdge) && !isWhite(bottomInner) && distance(bottomEdge, bottomInner) > 45) {
      bottom += 1;
    }
  }

  for (let y = inset; y < image.height - inset; y += 1) {
    const leftEdge = rgbAt(image, 0, y);
    const leftInner = rgbAt(image, Math.min(image.width - 1, 2), y);
    if (isWhite(leftEdge) && !isWhite(leftInner) && distance(leftEdge, leftInner) > 45) left += 1;

    const rightEdge = rgbAt(image, image.width - 1, y);
    const rightInner = rgbAt(image, Math.max(0, image.width - 3), y);
    if (isWhite(rightEdge) && !isWhite(rightInner) && distance(rightEdge, rightInner) > 45) {
      right += 1;
    }
  }

  return {
    topRatio: top / Math.max(1, image.width - inset * 2),
    bottomRatio: bottom / Math.max(1, image.width - inset * 2),
    leftRatio: left / Math.max(1, image.height - inset * 2),
    rightRatio: right / Math.max(1, image.height - inset * 2),
  };
}

async function expectNoLeak(sheet: Locator, label: string) {
  const leak = edgeLeak(decodePng(await sheet.screenshot({ animations: "disabled" })));
  expect(leak.topRatio, `${label} top edge`).toBeLessThanOrEqual(0.18);
  expect(leak.bottomRatio, `${label} bottom edge`).toBeLessThanOrEqual(0.18);
  expect(leak.leftRatio, `${label} left edge`).toBeLessThanOrEqual(0.18);
  expect(leak.rightRatio, `${label} right edge`).toBeLessThanOrEqual(0.18);
}

test.describe("Fresh dossier page-edge smoke", () => {
  test.setTimeout(180_000);

  for (const template of TEMPLATES) {
    test(`${template.id} cover and CV have no white 1px seam`, async ({ page }) => {
      await page.setViewportSize({ width: 1137, height: 913 });

      const cover = await seedCover(page, template);
      await expectNoLeak(cover, `${template.id} cover`);

      const cv = await seedCv(page, template);
      await expectNoLeak(cv, `${template.id} CV`);
    });
  }
});