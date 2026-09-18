import { expect, test, type Locator, type Page } from "@playwright/test";
import { stat } from "node:fs/promises";

const BASE_URL = "http://127.0.0.1:4173";
const STORAGE_KEY = "anschreiben:v1";
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9WlY4AAAAASUVORK5CYII=";

function letterPayload(images: Array<Record<string, unknown>>) {
  return {
    version: 1,
    data: {
      absenderName: "Lea Müller",
      absenderAdresse: "Dorfstrasse 12",
      absenderPlzOrt: "4535 Hubersdorf",
      absenderTelefon: "079 123 45 67",
      absenderEmail: "lea@example.ch",
      empfaengerFirma: "Beispiel AG",
      empfaengerName: "Herr Thomas Weber",
      empfaengerAdresse: "Industriestrasse 8",
      empfaengerPlzOrt: "4500 Solothurn",
      ort: "Hubersdorf",
      datum: "15.11.2026",
      betreff: "Bewerbung um eine Lehrstelle",
      anrede: "Guten Tag Herr Weber",
      text: "Ich interessiere mich sehr für die Lehrstelle. Gerne möchte ich mein Interesse und meine Motivation persönlich zeigen.",
      richTextHtml: "",
      gruss: "Freundliche Grüsse",
      unterschrift: "Lea Müller",
      images,
      showBeilagen: true,
      beilagen: ["Lebenslauf", "Zeugnis"],
    },
    design: {
      template: "brief",
      colors: {
        bg: "#ffffff",
        ink: "#111111",
        primary: "#111111",
        secondary: "#111111",
        accent: "#111111",
      },
      font: "freundlich",
      headerMode: "none",
      footerMode: "none",
    },
  };
}

async function seed(page: Page, images: Array<Record<string, unknown>>) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.clear();
      localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: STORAGE_KEY, payload: letterPayload(images) },
  );
  await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
    "data-editor-ready",
    "true",
    { timeout: 15_000 },
  );
  const root = page.locator("main [data-letter-document-root]");
  await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });
  return root.locator("[data-letter-page]").first();
}

async function numericAttribute(locator: Locator, name: string) {
  const value = Number(await locator.getAttribute(name));
  expect(Number.isFinite(value), `${name} should contain a finite number`).toBe(true);
  return value;
}

async function assertFreeUsesContentBox(image: Locator) {
  const result = await image.evaluate((element) => {
    const imageRect = element.getBoundingClientRect();
    const textLayer = element.closest<HTMLElement>("[data-letter-text-layer]");
    if (!textLayer) return null;
    const textRect = textLayer.getBoundingClientRect();
    const box = (textLayer.dataset.letterContentBox ?? "")
      .split(",")
      .map((value) => Number(value));
    if (box.length !== 4 || box.some((value) => !Number.isFinite(value))) return null;
    const contentWidthMm = 210 - box[0] - box[2];
    const scale = textRect.width / contentWidthMm;
    const xMm = Number((element as HTMLElement).dataset.xMm);
    const topMm = Number((element as HTMLElement).dataset.topMm);
    return {
      xError: Math.abs(imageRect.left - (textRect.left + xMm * scale)),
      topError: Math.abs(imageRect.top - (textRect.top + topMm * scale)),
    };
  });
  expect(result).not.toBeNull();
  expect(result?.xError ?? 999).toBeLessThanOrEqual(2);
  expect(result?.topError ?? 999).toBeLessThanOrEqual(2);
}

test.describe("letter image placement hardening", () => {
  test.setTimeout(120_000);

  test("left/right/free switching, drag, resize, persistence and PDF share content-box geometry", async ({
    page,
  }) => {
    const preview = await seed(page, [
      {
        id: "image-left",
        src: PNG_1X1,
        side: "left",
        placement: "left",
        topMm: 4,
        widthMm: 28,
        gapMm: 4,
      },
      {
        id: "image-right",
        src: PNG_1X1,
        side: "right",
        placement: "right",
        topMm: 6,
        widthMm: 30,
        gapMm: 4,
      },
    ]);

    const left = preview.locator('[data-letter-flow-image="image-left"]');
    const right = preview.locator('[data-letter-flow-image="image-right"]');
    await expect(left).toHaveAttribute("data-letter-image-placement", "left");
    await expect(right).toHaveAttribute("data-letter-image-placement", "right");
    expect(await numericAttribute(left, "data-x-mm")).toBe(0);
    const rightXBefore = await numericAttribute(right, "data-x-mm");
    expect(rightXBefore).toBeGreaterThan(0);
    const rightWidthBefore = await numericAttribute(right, "data-width-mm");

    await left.getByRole("button", { name: "Frei positionieren" }).click();
    await expect(left).toHaveAttribute("data-letter-image-placement", "free");

    const box = await left.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("free image has no browser box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 45, {
      steps: 5,
    });
    await page.mouse.up();

    const draggedX = await numericAttribute(left, "data-x-mm");
    const draggedTop = await numericAttribute(left, "data-top-mm");
    expect(draggedX).toBeGreaterThan(0);
    expect(draggedTop).toBeGreaterThan(4);
    await assertFreeUsesContentBox(left);

    const widthBeforeResize = await numericAttribute(left, "data-width-mm");
    const resize = left.locator("[data-letter-flow-resize]");
    const resizeBox = await resize.boundingBox();
    expect(resizeBox).not.toBeNull();
    if (!resizeBox) throw new Error("resize handle has no browser box");
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 35, resizeBox.y + resizeBox.height / 2, {
      steps: 4,
    });
    await page.mouse.up();
    expect(await numericAttribute(left, "data-width-mm")).toBeGreaterThan(widthBeforeResize);
    await assertFreeUsesContentBox(left);

    // The other image must not inherit geometry from the one being manipulated.
    await expect(right).toHaveAttribute("data-letter-image-placement", "right");
    expect(await numericAttribute(right, "data-x-mm")).toBe(rightXBefore);
    expect(await numericAttribute(right, "data-width-mm")).toBe(rightWidthBefore);

    await left.getByRole("button", { name: "Rechts mit Textfluss" }).click();
    await expect(left).toHaveAttribute("data-letter-image-placement", "right");
    await left.getByRole("button", { name: "Frei positionieren" }).click();
    await expect(left).toHaveAttribute("data-letter-image-placement", "free");
    await left.getByRole("button", { name: "Links mit Textfluss" }).click();
    await expect(left).toHaveAttribute("data-letter-image-placement", "left");

    await right.getByRole("button", { name: "Frei positionieren" }).click();
    await expect(right).toHaveAttribute("data-letter-image-placement", "free");
    await right.getByRole("button", { name: "Links mit Textfluss" }).click();
    await expect(right).toHaveAttribute("data-letter-image-placement", "left");
    await right.getByRole("button", { name: "Rechts mit Textfluss" }).click();
    await expect(right).toHaveAttribute("data-letter-image-placement", "right");

    // Leave the first image in a known free state for autosave/JSON/reload checks.
    await left.getByRole("button", { name: "Frei positionieren" }).click();
    const freeBox = await left.boundingBox();
    if (!freeBox) throw new Error("free image has no browser box after placement switch");
    await page.mouse.move(freeBox.x + freeBox.width / 2, freeBox.y + freeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(freeBox.x + freeBox.width / 2 + 45, freeBox.y + freeBox.height / 2 + 25, {
      steps: 4,
    });
    await page.mouse.up();
    const savedX = await numericAttribute(left, "data-x-mm");
    const savedTop = await numericAttribute(left, "data-top-mm");
    const savedWidth = await numericAttribute(left, "data-width-mm");

    await expect
      .poll(() =>
        page.evaluate((key) => {
          const saved = JSON.parse(localStorage.getItem(key) ?? "{}") as {
            data?: { images?: Array<Record<string, unknown>> };
          };
          return saved.data?.images?.find((image) => image.id === "image-left") ?? null;
        }, STORAGE_KEY),
      )
      .toMatchObject({ placement: "free" });

    // A literal JSON stringify/parse roundtrip must keep the explicit free signal.
    await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) throw new Error("missing letter autosave");
      localStorage.setItem(key, JSON.stringify(JSON.parse(raw)));
    }, STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );
    const restored = page.locator(
      'main [data-letter-document-root] [data-letter-flow-image="image-left"]',
    );
    await expect(restored).toHaveAttribute("data-letter-image-placement", "free");
    expect(await numericAttribute(restored, "data-x-mm")).toBe(savedX);
    expect(await numericAttribute(restored, "data-top-mm")).toBe(savedTop);
    expect(await numericAttribute(restored, "data-width-mm")).toBe(savedWidth);
    await assertFreeUsesContentBox(restored);

    // Responsive scaling and scrolling must not reinterpret stored millimetres.
    await page.setViewportSize({ width: 900, height: 700 });
    await restored.scrollIntoViewIfNeeded();
    expect(await numericAttribute(restored, "data-x-mm")).toBe(savedX);
    expect(await numericAttribute(restored, "data-top-mm")).toBe(savedTop);
    await assertFreeUsesContentBox(restored);

    await page.getByRole("button", { name: "Download", exact: true }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await page.getByRole("button", { name: /Nur Motivationsschreiben als PDF/i }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();
    expect((await stat(path ?? "")).size).toBeGreaterThan(5_000);
  });

  test("legacy JSON keeps side authoritative when xMm exists without explicit free placement", async ({
    page,
  }) => {
    const preview = await seed(page, [
      {
        id: "legacy-right",
        src: PNG_1X1,
        side: "right",
        xMm: 42,
        topMm: 7,
        widthMm: 30,
        gapMm: 4,
      },
    ]);
    const image = preview.locator('[data-letter-flow-image="legacy-right"]');
    await expect(image).toHaveAttribute("data-letter-image-placement", "right");
    expect(await numericAttribute(image, "data-x-mm")).toBeGreaterThan(42);
  });
});
