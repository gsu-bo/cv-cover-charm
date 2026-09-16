import { expect, test, type Page } from "@playwright/test";

const BASE_URL = "http://127.0.0.1:4173";

const SIDE_KEYS = [
  "lebenslauf:layout:v1",
  "lebenslauf:layout-mirror:v1",
  "lebenslauf:placement:v1",
  "lebenslauf:photo:v2",
  "lebenslauf:photo-place:v1",
] as const;

type StoredSnapshot = {
  data?: {
    vorname?: string;
    absenderName?: string;
    person?: { vorname?: string };
  };
};

async function waitForStoredValue(
  page: Page,
  key: string,
  read: (saved: StoredSnapshot) => unknown,
  expected: unknown,
) {
  await expect
    .poll(() =>
      page.evaluate(
        ({ storageKey }) => {
          const raw = localStorage.getItem(storageKey);
          return raw ? JSON.parse(raw) : null;
        },
        { storageKey: key },
      ),
    )
    .not.toBeNull();

  await expect
    .poll(async () => {
      const saved = await page.evaluate(
        ({ storageKey }) => {
          const raw = localStorage.getItem(storageKey);
          return raw ? (JSON.parse(raw) as StoredSnapshot) : null;
        },
        { storageKey: key },
      );
      return saved ? read(saved) : undefined;
    })
    .toEqual(expected);
}

test.describe("M7 dossier state roundtrip", () => {
  test.setTimeout(120_000);

  test("save -> clear browser state -> load restores all three documents and CV sidecars", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });

    const download = page.getByRole("button", { name: "Download", exact: true });
    await expect(download).toHaveAttribute("data-editor-ready", "true");
    await download.click();
    const menu = page.locator("[data-editor-action-menu]");
    await menu.getByRole("button").filter({ hasText: "Beispieldaten übernehmen" }).click();
    await menu.getByRole("button", { name: "Ja", exact: true }).click();
    await waitForStoredValue(page, "titelblatt:v3", (saved) => saved.data?.vorname, "Lea");

    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    const letterDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(letterDownload).toHaveAttribute("data-editor-ready", "true");
    await letterDownload.click();
    const letterMenu = page.locator("[data-editor-action-menu]");
    await letterMenu.getByRole("button").filter({ hasText: "Beispieldaten übernehmen" }).click();
    await letterMenu.getByRole("button", { name: "Ja", exact: true }).click();
    await waitForStoredValue(
      page,
      "anschreiben:v1",
      (saved) => saved.data?.absenderName,
      "Lea Müller",
    );

    await page.goto(`${BASE_URL}/lebenslauf`, { waitUntil: "domcontentloaded" });
    const cvDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(cvDownload).toHaveAttribute("data-editor-ready", "true");
    await cvDownload.click();
    const cvMenu = page.locator("[data-editor-action-menu]");
    await cvMenu.getByRole("button").filter({ hasText: "Beispieldaten übernehmen" }).click();
    await cvMenu.getByRole("button", { name: "Ja", exact: true }).click();
    await waitForStoredValue(page, "lebenslauf:v1", (saved) => saved.data?.person?.vorname, "Lea");

    await page.evaluate(() => {
      localStorage.setItem("lebenslauf:layout:v1", "timeline");
      localStorage.setItem("lebenslauf:layout-mirror:v1", "true");
      localStorage.setItem(
        "lebenslauf:placement:v1",
        JSON.stringify({
          kontakt: "main",
          schule: "side",
          erfahrung: "main",
          sprachen: "main",
          hobbys: "side",
          staerken: "side",
          referenzen: "main",
        }),
      );
      localStorage.setItem(
        "lebenslauf:photo:v2",
        JSON.stringify({ shape: "circle", zoom: 1.6, x: 20, y: 70, borderWidth: 0.7 }),
      );
      localStorage.setItem(
        "lebenslauf:photo-place:v1",
        JSON.stringify({
          mode: "frei",
          xMm: 132,
          yMm: 26,
          widthMm: 42,
          frameColor: "#123456",
        }),
      );
    });

    await page.evaluate(() => {
      localStorage.setItem(
        "bewerbungsdossier:chrome:v1",
        JSON.stringify({
          version: 1,
          sync: false,
          shared: {
            headerMode: "compact",
            headerShowName: true,
            headerShowAddress: true,
            headerShowPhone: true,
            headerShowEmail: true,
            headerHeightMm: null,
            headerGapMm: 6,
            headerContentOffsetYMm: 0,
            letterRecipientOffsetYMm: 0,
            headerTextLayout: "stacked",
            headerBackgroundColor: null,
            headerGradientColor: null,
            footerMode: "compact",
            footerHeightMm: null,
            footerContentOffsetYMm: 0,
            footerTextLayout: "inline",
            footerBackgroundColor: null,
            footerGradientColor: null,
            borderEnabled: true,
            borderColor: null,
            borderWidthMm: 0.6,
            textFont: null,
          },
          cv: {
            headerMode: "contact",
            headerShowName: true,
            headerShowAddress: true,
            headerShowPhone: false,
            headerShowEmail: true,
            headerHeightMm: 26,
            headerGapMm: 9,
            headerContentOffsetYMm: 4,
            letterRecipientOffsetYMm: 0,
            headerTextLayout: "inline",
            headerBackgroundColor: "#123456",
            headerGradientColor: "#abcdef",
            footerMode: "details",
            footerHeightMm: 14,
            footerContentOffsetYMm: -2,
            footerTextLayout: "stacked",
            footerBackgroundColor: "#654321",
            footerGradientColor: null,
            borderEnabled: true,
            borderColor: "#fedcba",
            borderWidthMm: 1.1,
            textFont: "freundlich",
          },
          letter: {
            headerMode: "none",
            headerShowName: true,
            headerShowAddress: false,
            headerShowPhone: true,
            headerShowEmail: false,
            headerHeightMm: null,
            headerGapMm: 5,
            headerContentOffsetYMm: -3,
            letterRecipientOffsetYMm: 5,
            headerTextLayout: "stacked",
            headerBackgroundColor: null,
            headerGradientColor: null,
            footerMode: "none",
            footerHeightMm: null,
            footerContentOffsetYMm: 2,
            footerTextLayout: "inline",
            footerBackgroundColor: null,
            footerGradientColor: null,
            borderEnabled: false,
            borderColor: "#112233",
            borderWidthMm: 0.8,
            textFont: null,
          },
        }),
      );
    });

    await page.goto(`${BASE_URL}/titelblatt`, { waitUntil: "domcontentloaded" });
    const titleDownload = page.getByRole("button", { name: "Download", exact: true });
    await expect(titleDownload).toHaveAttribute("data-editor-ready", "true");
    await titleDownload.click();
    const titleMenu = page.locator("[data-editor-action-menu]");

    const [projectDownload] = await Promise.all([
      page.waitForEvent("download"),
      titleMenu.getByRole("button", { name: /Dossier speichern/ }).click(),
    ]);
    const projectPath = await projectDownload.path();
    expect(projectPath).not.toBeNull();

    const before = await page.evaluate(() => ({
      cover: JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null"),
      letter: JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null"),
      cv: JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null"),
      chrome: JSON.parse(localStorage.getItem("bewerbungsdossier:chrome:v1") ?? "null"),
    }));
    expect(before.cover?.data?.vorname).toBe("Lea");
    expect(before.letter?.data?.absenderName).toBe("Lea Müller");
    expect(before.cv?.data?.person?.vorname).toBe("Lea");
    expect(before.chrome?.sync).toBe(false);
    expect(before.chrome?.cv?.headerMode).toBe("contact");
    expect(before.chrome?.cv?.headerHeightMm).toBe(26);
    expect(before.chrome?.cv?.headerGapMm).toBe(9);
    expect(before.chrome?.cv?.headerContentOffsetYMm).toBe(4);
    expect(before.chrome?.cv?.headerBackgroundColor).toBe("#123456");
    expect(before.chrome?.cv?.headerGradientColor).toBe("#abcdef");
    expect(before.chrome?.cv?.footerHeightMm).toBe(14);
    expect(before.chrome?.cv?.footerContentOffsetYMm).toBe(-2);
    expect(before.chrome?.cv?.borderEnabled).toBe(true);
    expect(before.chrome?.cv?.borderColor).toBe("#fedcba");
    expect(before.chrome?.cv?.borderWidthMm).toBe(1.1);
    expect(before.chrome?.cv?.textFont).toBe("freundlich");
    expect(before.chrome?.letter?.headerMode).toBe("none");
    expect(before.chrome?.letter?.headerGapMm).toBe(5);
    expect(before.chrome?.letter?.headerContentOffsetYMm).toBe(-3);
    expect(before.chrome?.letter?.letterRecipientOffsetYMm).toBe(5);
    expect(before.chrome?.letter?.footerContentOffsetYMm).toBe(2);
    expect(before.chrome?.letter?.borderEnabled).toBe(false);

    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );
    await page.getByRole("button", { name: "Download", exact: true }).click();

    const fileInput = page.locator(
      '[data-editor-action-menu] input[type="file"][accept="application/json"]',
    );
    await fileInput.setInputFiles(projectPath ?? "");

    await expect
      .poll(() =>
        page.evaluate(() => ({
          cover: JSON.parse(localStorage.getItem("titelblatt:v3") ?? "null")?.data?.vorname,
          letter: JSON.parse(localStorage.getItem("anschreiben:v1") ?? "null")?.data?.absenderName,
          cv: JSON.parse(localStorage.getItem("lebenslauf:v1") ?? "null")?.data?.person?.vorname,
          layout: localStorage.getItem("lebenslauf:layout:v1"),
          mirrored: localStorage.getItem("lebenslauf:layout-mirror:v1"),
          chrome: JSON.parse(localStorage.getItem("bewerbungsdossier:chrome:v1") ?? "null"),
        })),
      )
      .toMatchObject({
        cover: "Lea",
        letter: "Lea Müller",
        cv: "Lea",
        layout: "timeline",
        mirrored: "true",
        chrome: before.chrome,
      });

    const restored = await page.evaluate((keys) => {
      const result: Record<string, string | null> = {};
      for (const key of keys) result[key] = localStorage.getItem(key);
      return result;
    }, SIDE_KEYS);

    expect(JSON.parse(restored["lebenslauf:placement:v1"] ?? "null")?.schule).toBe("side");
    expect(JSON.parse(restored["lebenslauf:photo:v2"] ?? "null")?.zoom).toBe(1.6);
    expect(JSON.parse(restored["lebenslauf:photo-place:v1"] ?? "null")?.frameColor).toBe("#123456");
  });
});
