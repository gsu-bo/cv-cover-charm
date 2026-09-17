from pathlib import Path

path = Path("tests/e2e/dossier-letter-preflight.spec.ts")
text = path.read_text(encoding="utf-8")
marker = 'test.describe("M1 dossier sending truth", () => {'
index = text.find(marker)
if index < 0:
    raise RuntimeError("dossier-letter-preflight.spec.ts: describe marker not found")

replacement = r'''test.describe("M1 dossier sending truth", () => {
  test.setTimeout(240_000);

  test("missing fields, multi-page and fitting content share one safe dossier preflight", async ({
    page,
  }) => {
    await seedDossier(page, letterPayload(LONG_FITTING_BODY, { betreff: "" }));

    let dialog = await openReview(page);
    const readiness = dialog.locator("[data-dossier-letter-readiness]");
    await expect(readiness).toContainText("noch nicht versandbereit");
    await expect(readiness).toContainText("Betreff");
    let downloadButton = dialog.getByRole("button", {
      name: "PDF herunterladen",
      exact: true,
    });
    await expect(downloadButton).toBeDisabled();
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate(
      ({ hugeBody, letterKey }) => {
        const saved = JSON.parse(localStorage.getItem(letterKey) ?? "{}");
        saved.data.betreff = "Bewerbung um eine Lehrstelle als Informatikerin EFZ";
        saved.data.text = hugeBody;
        saved.data.richTextHtml = "";
        localStorage.setItem(letterKey, JSON.stringify(saved));
      },
      { hugeBody: HUGE_BODY, letterKey: LETTER_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    dialog = await openReview(page);
    let documentRoot = page.locator(
      "[data-dossier-document='letter'] [data-letter-document-root]",
    );
    await expect(documentRoot).toHaveAttribute("data-letter-pagination-ready", "true", {
      timeout: 20_000,
    });
    await expect
      .poll(() => documentRoot.locator("[data-letter-page]").count(), { timeout: 20_000 })
      .toBeGreaterThan(1);
    await expect(dialog.locator("[data-dossier-letter-overflow]")).toHaveCount(0);
    downloadButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(downloadButton).toBeEnabled({ timeout: 20_000 });

    const [multiDownload] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      downloadButton.click(),
    ]);
    const multiPath = await multiDownload.path();
    expect(multiPath).not.toBeNull();
    expect((await stat(multiPath ?? "")).size).toBeGreaterThan(10_000);
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate(
      ({ fittingBody, letterKey }) => {
        const saved = JSON.parse(localStorage.getItem(letterKey) ?? "{}");
        saved.data.text = fittingBody;
        saved.data.richTextHtml = "";
        localStorage.setItem(letterKey, JSON.stringify(saved));
      },
      { fittingBody: LONG_FITTING_BODY, letterKey: LETTER_KEY },
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    dialog = await openReview(page);
    documentRoot = page.locator("[data-dossier-document='letter'] [data-letter-document-root]");
    await expect(documentRoot).toHaveAttribute("data-letter-pagination-ready", "true", {
      timeout: 20_000,
    });
    await expect
      .poll(() => documentRoot.locator("[data-letter-page]").count(), { timeout: 20_000 })
      .toBe(1);
    await expect(dialog.locator("[data-dossier-letter-overflow]")).toHaveCount(0);
    downloadButton = dialog.getByRole("button", { name: "PDF herunterladen", exact: true });
    await expect(downloadButton).toBeEnabled({ timeout: 20_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 90_000 }),
      downloadButton.click(),
    ]);
    const pathValue = await download.path();
    expect(pathValue).not.toBeNull();
    expect((await stat(pathValue ?? "")).size).toBeGreaterThan(10_000);
  });
});
'''

path.write_text(text[:index] + replacement, encoding="utf-8")
print("pagination preflight regression replaced")
