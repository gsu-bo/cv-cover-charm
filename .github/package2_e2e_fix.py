from pathlib import Path

path = Path("tests/e2e/dossier-motif-parity.spec.ts")
text = path.read_text(encoding="utf-8")
old_helper = '''async function openSection(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true }).first();
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
}
'''
new_helper = '''async function openSection(page: Page, name: string) {
  const section = page.locator(`[data-editor-section-title="${name}"]`);
  await expect(section).toHaveCount(1);
  const button = section.locator("[data-editor-section-toggle]");
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  return section;
}
'''
if text.count(old_helper) != 1:
    raise SystemExit("expected old motif section helper exactly once")
text = text.replace(old_helper, new_helper, 1)
old_cv = '''    await openSection(page, "Vorlage");
    const cvControl = page.locator("input[type=range]").filter({
      has: page.locator("xpath=..", { hasText: "Hintergrund-Motiv" }),
    });
    await expect(page.getByText(/Hintergrund-Motiv 25 % sichtbar/).first()).toBeVisible();
    expect(await page.locator('input[type="range"]').evaluateAll((nodes) =>
      nodes.some((node) => node.getAttribute("min") === "0" && node.getAttribute("max") === "100"),
    )).toBe(true);
    void cvControl;
'''
new_cv = '''    const cvTemplate = await openSection(page, "Vorlage");
    await expect(cvTemplate.getByText(/Hintergrund-Motiv/).first()).toBeVisible();
    const cvControl = cvTemplate.locator('input[type="range"]');
    await expect(cvControl).toHaveCount(1);
    await expect(cvControl).toHaveValue("25");
    expect(
      await cvControl.evaluate((node) => {
        const input = node as HTMLInputElement;
        return { min: input.min, max: input.max };
      }),
    ).toEqual({ min: "0", max: "100" });
'''
if text.count(old_cv) != 1:
    raise SystemExit("expected old CV motif browser assertion exactly once")
text = text.replace(old_cv, new_cv, 1)
old_warm = '''    const slider = await openLetterMotifControl(page);
    await page.getByRole("button", { name: "Warm", exact: true }).click();
    const visiblePage = page.locator('[data-letter-document-root]:not([data-letter-pagination-measurements]) [data-letter-page]').first();
'''
new_warm = '''    const slider = await openLetterMotifControl(page);
    await page.getByRole("button", { name: "Warm", exact: true }).click();
    await openSection(page, "Header & Footer");
    await page
      .locator('[data-dossier-chrome-controls="letter"] [data-dossier-header-mode-control]')
      .selectOption("compact");
    const visiblePage = page.locator('[data-letter-document-root]:not([data-letter-pagination-measurements]) [data-letter-page]').first();
'''
if text.count(old_warm) != 1:
    raise SystemExit("expected old Warm browser setup exactly once")
text = text.replace(old_warm, new_warm, 1)
path.write_text(text, encoding="utf-8")
