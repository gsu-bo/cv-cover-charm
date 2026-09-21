import { expect, test, type Locator, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";
const PHOTO =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='320' viewBox='0 0 240 320'%3E%3Crect width='240' height='320' fill='%23dbeafe'/%3E%3Ccircle cx='120' cy='110' r='55' fill='%2394a3b8'/%3E%3Crect x='55' y='180' width='130' height='105' rx='42' fill='%2364748b'/%3E%3C/svg%3E";

const HANDLE_DELTA: Record<string, { x: number; y: number }> = {
  n: { x: 0, y: -14 },
  ne: { x: 14, y: -14 },
  e: { x: 14, y: 0 },
  se: { x: 14, y: 14 },
  s: { x: 0, y: 14 },
  sw: { x: -14, y: 14 },
  w: { x: -14, y: 0 },
  nw: { x: -14, y: -14 },
};

function coverPayload() {
  return {
    version: 8,
    template: "modern",
    colors: {
      modern: { bg: "#ffffff", primary: "#24364b", accent: "#d6a47d" },
    },
    layout: {
      modern: {
        foto: { x: 25, y: 35, w: 42, ratio: 1.25 },
        "custom-image-ratio": { x: 105, y: 35, w: 36, ratio: 0.75 },
        "custom-shape-ratio": { x: 85, y: 175, w: 34, ratio: 0.6 },
      },
    },
    customs: [
      {
        id: "custom-image-ratio",
        label: "Ratio Bild",
        text: "",
        kind: "image",
        src: PHOTO,
      },
      {
        id: "custom-shape-ratio",
        label: "Ratio Form",
        text: "",
        kind: "shape",
        shape: "rect",
      },
    ],
    fontScale: 1,
    font: "freundlich",
    data: {
      meta: { title: "", author: "", subject: "", keywords: "" },
      kicker: "Bewerbung um eine Lehrstelle als",
      eyebrow: "Bewerbung",
      beruf: "Informatiker/in EFZ",
      lehrbeginn: "August 2027",
      vorname: "Lea",
      nachname: "Müller",
      adresse: "Dorfstrasse 12",
      plzOrt: "4535 Hubersdorf",
      telefon: "+41 79 123 45 67",
      email: "lea.mueller@example.ch",
      geburtsdatum: "14.03.2010",
      lehrbetrieb: "",
      ansprechperson: "",
      betriebAdresse: "",
      showBetriebOnCover: false,
      showBeilagenOnCover: false,
      beilagen: [],
      ort: "Hubersdorf",
      datum: "29.08.2026",
      labelKontakt: "",
      labelEmpfaenger: "",
      foto: PHOTO,
    },
  };
}

async function seed(page: Page) {
  await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
  await page.evaluate((payload) => {
    localStorage.clear();
    localStorage.setItem("titelblatt:v3", JSON.stringify(payload));
  }, coverPayload());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-dossier-document="cover"]').first().waitFor({ state: "visible" });
}

const block = (page: Page, id: string) => page.locator(`[data-block-id="${id}"]`).first();

async function selectBlock(page: Page, id: string) {
  const target = block(page, id);
  await target.click({ position: { x: 6, y: 6 } });
  await expect(target).toHaveAttribute("data-element-selected", "true");
  return target;
}

function proportionCheckbox(page: Page) {
  return page.getByRole("checkbox", { name: "Proportionen beibehalten" });
}

function slider(page: Page, label: "Breite" | "Höhe") {
  return page
    .locator("span")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .last()
    .locator("..")
    .locator('input[type="range"]');
}

/** Drive the native range input with real keyboard events so React sees every change. */
async function setSlider(target: Locator, value: number) {
  const min = Number((await target.getAttribute("min")) ?? 0);
  const max = Number((await target.getAttribute("max")) ?? 100);
  const step = Number((await target.getAttribute("step")) ?? 1);
  const clamped = Math.max(min, Math.min(max, value));

  await target.focus();
  const current = Number(await target.inputValue());
  const steps = Math.round(Math.abs(clamped - current) / step);
  const key = clamped >= current ? "ArrowRight" : "ArrowLeft";
  for (let i = 0; i < steps; i += 1) await target.press(key);

  await expect.poll(async () => Number(await target.inputValue())).toBeCloseTo(clamped, 5);
}

async function geometry(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error("Element geometry unavailable");
  return { width: box.width, height: box.height, ratio: box.height / box.width };
}

async function dragHandle(page: Page, target: Locator, direction: string) {
  const handle = target.locator(`[data-element-resize-handle="${direction}"]`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`Resize handle ${direction} unavailable`);
  const delta = HANDLE_DELTA[direction];
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta.x, y + delta.y, { steps: 5 });
  await page.mouse.up();
}

async function storedLock(page: Page, id: string) {
  return page.evaluate((blockId) => {
    const raw = localStorage.getItem("titelblatt:v3");
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as {
      layout?: Record<string, Record<string, { lockRatio?: boolean }>>;
    };
    return parsed.layout?.modern?.[blockId]?.lockRatio;
  }, id);
}

async function waitForStoredLock(page: Page, id: string, expected: boolean) {
  await expect.poll(() => storedLock(page, id)).toBe(expected);
}

/** Reset one element fully to its template defaults; useful between independent handle checks. */
async function resetSelected(page: Page) {
  await page.getByRole("button", { name: "Zurücksetzen" }).last().click();
}

/** Reset only geometry, which must preserve visual/user preferences such as lockRatio. */
async function resetGeometry(page: Page) {
  await page.getByRole("button", { name: "Download" }).click();
  await page.getByRole("button", { name: /Positionen\s*&\s*Grössen zurücksetzen/ }).click();
}

test.describe("element proportion lock behavior", () => {
  test.setTimeout(120_000);

  test("photo, image and shape honor lock across sliders, handles, reload and reset", async ({
    page,
  }) => {
    await seed(page);

    // Photo: locked by default. Width and height sliders must keep the ratio.
    let target = await selectBlock(page, "foto");
    await expect(proportionCheckbox(page)).toBeChecked();

    let before = await geometry(target);
    await setSlider(slider(page, "Breite"), 58);
    let after = await geometry(target);
    expect(after.ratio).toBeCloseTo(before.ratio, 2);
    expect(after.width).not.toBeCloseTo(before.width, 1);

    before = after;
    await setSlider(slider(page, "Höhe"), 82);
    after = await geometry(target);
    expect(after.ratio).toBeCloseTo(before.ratio, 2);
    expect(after.width).not.toBeCloseTo(before.width, 1);

    // Every direct preview handle must preserve the same visual ratio while locked.
    for (const direction of Object.keys(HANDLE_DELTA)) {
      await resetSelected(page);
      target = block(page, "foto");
      await expect(proportionCheckbox(page)).toBeChecked();
      before = await geometry(target);
      await dragHandle(page, target, direction);
      after = await geometry(target);
      expect(after.ratio, `photo handle ${direction}`).toBeCloseTo(before.ratio, 2);
    }

    // Generic image: also locked by default, but an explicit unlock must persist.
    target = await selectBlock(page, "custom-image-ratio");
    await expect(proportionCheckbox(page)).toBeChecked();
    await proportionCheckbox(page).uncheck();
    await waitForStoredLock(page, "custom-image-ratio", false);

    await page.reload({ waitUntil: "domcontentloaded" });
    target = await selectBlock(page, "custom-image-ratio");
    await expect(proportionCheckbox(page)).not.toBeChecked();
    before = await geometry(target);
    await dragHandle(page, target, "e");
    after = await geometry(target);
    expect(Math.abs(after.ratio - before.ratio)).toBeGreaterThan(0.03);

    // Geometry reset must not erase the explicit unlock preference.
    await resetGeometry(page);
    target = await selectBlock(page, "custom-image-ratio");
    await expect(proportionCheckbox(page)).not.toBeChecked();
    await waitForStoredLock(page, "custom-image-ratio", false);

    // Turning it back on makes the height slider proportional again.
    await proportionCheckbox(page).check();
    await waitForStoredLock(page, "custom-image-ratio", true);
    before = await geometry(target);
    await setSlider(slider(page, "Höhe"), 44);
    after = await geometry(target);
    expect(after.ratio).toBeCloseTo(before.ratio, 2);

    // Shapes remain free by default; an explicit lock is honored and persists.
    target = await selectBlock(page, "custom-shape-ratio");
    await expect(proportionCheckbox(page)).not.toBeChecked();
    before = await geometry(target);
    await dragHandle(page, target, "e");
    after = await geometry(target);
    expect(Math.abs(after.ratio - before.ratio)).toBeGreaterThan(0.03);

    await proportionCheckbox(page).check();
    await waitForStoredLock(page, "custom-shape-ratio", true);
    before = await geometry(target);
    await dragHandle(page, target, "se");
    after = await geometry(target);
    expect(after.ratio).toBeCloseTo(before.ratio, 2);

    await page.reload({ waitUntil: "domcontentloaded" });
    await selectBlock(page, "custom-shape-ratio");
    await expect(proportionCheckbox(page)).toBeChecked();
  });
});
