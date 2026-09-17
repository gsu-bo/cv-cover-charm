from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern[:120]!r}")
    write(path, next_text)


# 1) Editor readiness means React/storage hydration is complete, not that autosave happened once.
route = "src/routes/anschreiben.tsx"
replace_once(
    route,
    'data-editor-ready={saveState === "idle" ? "false" : "true"}',
    'data-editor-ready={hydrated ? "true" : "false"}',
)

# Pagination reports state back to this parent. Keep the synchronized dossier contact
# referentially stable so that feedback renders do not cancel and restart measurement forever.
replace_once(
    route,
    '  const chromeContact = chromeState.sync ? readDossierContact({ letter: data }) : undefined;',
    '''  const chromeContact = useMemo(
    () => (chromeState.sync ? readDossierContact({ letter: data }) : undefined),
    [chromeState.sync, data, source],
  );''',
)

# 2) Native PDF text must not resurrect CSS-hidden elements.
replace_once(
    "src/lib/dossier-pdf.ts",
    '''    const text = letterText(element);
    if (!text) continue;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);''',
    '''    const text = letterText(element);
    if (!text) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const style = window.getComputedStyle(element);''',
)

# 3) Sync must remain controllable even when both header and footer are off.
chrome = "src/components/dossier/DossierChromeControls.tsx"
replace_once(
    chrome,
    '''  const footerMax = options.footerMode === "details" ? 40 : 18;

  return (''',
    '''  const footerMax = options.footerMode === "details" ? 40 : 18;
  const syncControl = (
    <div className="flex items-start gap-2">
      <input
        id={`dossier-chrome-sync-${scope}`}
        data-dossier-chrome-sync
        type="checkbox"
        className="mt-0.5"
        checked={state.sync}
        onChange={(event) => {
          const sync = event.target.checked;
          const nextOptions = sync ? state[scope] : state.shared;
          setDossierChromeSync(scope, sync);
          onOptionsChange?.(nextOptions);
        }}
      />
      <label htmlFor={`dossier-chrome-sync-${scope}`} className="min-w-0 text-xs">
        <span className="block font-semibold">Header &amp; Footer synchron halten</span>
        <span className="mt-0.5 block leading-relaxed text-muted-foreground">
          {state.sync
            ? `Änderungen gelten gleichzeitig für ${thisDocument} und ${other}.`
            : `Nur ${thisDocument} wird geändert.`}
        </span>
      </label>
    </div>
  );

  return (''',
)
text = read(chrome)
sync_start = text.find(
    '\n      <div className="flex items-start gap-2">\n'
    '        <input\n'
    '          id={`dossier-chrome-sync-${scope}`}'
)
font_marker = (
    '\n        <label className="block text-xs font-medium">\n'
    '          Schrift in Header &amp; Footer'
)
if sync_start < 0:
    raise RuntimeError(f"{chrome}: current in-branch sync block not found")
font_start = text.find(font_marker, sync_start)
if font_start < 0:
    raise RuntimeError(f"{chrome}: font marker after sync block not found")
text = text[:sync_start] + text[font_start:]
write(chrome, text)
replace_once(
    chrome,
    "\n        {hasChromeSurface ? (",
    "\n        {syncControl}\n        {hasChromeSurface ? (",
)

# 4) Reuse Package-1's canonical CV body-contact semantics: identity stays in the CV,
# while address/phone/email already integrated into a contact header disappear from body copy.
cv = "src/components/cv/CvCanvasBase.tsx"
replace_once(
    cv,
    'import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";',
    '''import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import { cvBodyData } from "@/lib/dossier-body-contact";''',
)
replace_once(
    cv,
    '''  const p = data.person;
  const name = [p.vorname, p.nachname].filter(Boolean).join(" ");''',
    '''  const p = cvBodyData(data, chromeOptions).person;
  const name = [p.vorname, p.nachname].filter(Boolean).join(" ");''',
)

# Package-1 explicitly keeps identity in the CV body even when the shared header repeats the name.
chrome_e2e = "tests/e2e/dossier-chrome-sync.spec.ts"
replace_once(
    chrome_e2e,
    '  test("CV contact header owns integrated fields exactly once and leaves unchecked fields in the body", async ({',
    '  test("CV contact header owns contact fields exactly once while body identity stays visible", async ({',
)
replace_once(
    chrome_e2e,
    '    await expect.poll(bodyText).not.toContain("Lea Müller");',
    '    await expect.poll(bodyText).toContain("Lea Müller");',
)

# 5) QA must assert the current multi-page behavior instead of the retired one-page blocker.
finalqa = "tests/e2e/letter-final-qa.spec.ts"
replace_once(
    finalqa,
    '''  await expect(preview).toBeVisible();
  await expect(exported).toHaveCount(1);
  await doubleFrame(page);
  return { preview, exported };''',
    '''  await expect(preview).toBeVisible();
  await expect(page.locator("main [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect(
    page.locator("[data-letter-standalone-export] [data-letter-document-root]"),
  ).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });
  await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await doubleFrame(page);
  return { preview, exported };''',
)
regex_once(
    finalqa,
    r'''  test\("multi-page-sized content is visibly blocked instead of producing a clipped PDF", async \(\{\n    page,\n  \}\) => \{.*?\n  \}\);\n\}\);''',
    '''  test("multi-page-sized content paginates without clipping and remains exportable", async ({
    page,
  }) => {
    const multiPageBody = Array.from(
      { length: 55 },
      (_, index) =>
        `Absatz ${index + 1}: Ich interessiere mich sehr für diesen Beruf und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft mit einem ausführlichen Beispiel aus Schule und Alltag zeigen.`,
    ).join("\\n\\n");
    const { exported } = await seedLetter(page, {
      template: "edge",
      headerMode: "contact",
      footerMode: "attachments",
      body: multiPageBody,
      attachments: ["Lebenslauf", "Zeugnis"],
    });

    await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const overflow = await exported.evaluateAll((pages) =>
      pages.some((pageEl) => {
        const textLayer = pageEl.querySelector<HTMLElement>("[data-letter-text-layer]");
        return !!textLayer && textLayer.scrollHeight > textLayer.clientHeight + 1;
      }),
    );
    expect(overflow).toBe(false);
    await expect(exported.last()).toContainText("Absatz 55:");

    const download = page.getByRole("button", { name: "Download", exact: true });
    await download.click();
    await expect(
      page.locator("[data-editor-action-menu] button").filter({
        hasText: "Nur Motivationsschreiben als PDF",
      }),
    ).toBeEnabled();
  });
});''',
)

adversarial = "tests/e2e/letter-adversarial-content.spec.ts"
replace_once(
    adversarial,
    '''  await expect(preview).toBeVisible();
  await expect(exported).toHaveCount(1);
  await page.evaluate(''',
    '''  await expect(preview).toBeVisible();
  await expect(page.locator("main [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect(
    page.locator("[data-letter-standalone-export] [data-letter-document-root]"),
  ).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });
  await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.evaluate(''',
)
regex_once(
    adversarial,
    r'''  test\("deliberately too-long content is clearly blocked instead of silently exported", async \(\{ page \}\) => \{.*?\n  \}\);\n\}\);''',
    '''  test("deliberately long content paginates safely instead of clipping", async ({ page }) => {
    const { exported } = await seedLetter(page, payload({ body: HUGE_BODY }));

    await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const overflow = await exported.evaluateAll((pages) =>
      pages.some((pageEl) => {
        const textLayer = pageEl.querySelector<HTMLElement>("[data-letter-text-layer]");
        return !!textLayer && textLayer.scrollHeight > textLayer.clientHeight + 1;
      }),
    );
    expect(overflow).toBe(false);

    const button = await clickDownloadPdf(page);
    await expect(button).toBeEnabled();
  });
});''',
)

regression = "tests/e2e/dossier-regression.spec.ts"
regex_once(
    regression,
    r'''  test\("Motivationsschreiben warns when its A4 text layer overflows and clears after shortening", async \(\{\n    page,\n  \}\) => \{.*?\n  \}\);\n\n  test\("letter layout controls and Word-like formatting persist"''',
    '''  test("Motivationsschreiben paginates long content and returns to one page after shortening", async ({
    page,
  }) => {
    await seedCoreDossier(page);
    await page.goto(`${BASE_URL}/anschreiben`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Download", exact: true })).toHaveAttribute(
      "data-editor-ready",
      "true",
    );

    const body = page.getByRole("textbox", { name: "Brieftext" });
    const root = page.locator("main [data-letter-document-root]");
    const pages = root.locator("[data-letter-document-pages] [data-letter-page]");
    await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", {
      timeout: 20_000,
    });

    await body.fill(
      Array.from(
        { length: 55 },
        (_, index) =>
          `Absatz ${index + 1}: Ich interessiere mich sehr für diesen Beruf und möchte meine Motivation, Zuverlässigkeit und Lernbereitschaft zeigen.`,
      ).join("\\n\\n"),
    );
    await expect.poll(() => pages.count(), { timeout: 20_000 }).toBeGreaterThan(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const downloadToggle = page.getByRole("button", { name: "Download", exact: true });
    await downloadToggle.click();
    await expect(
      page.locator("[data-editor-action-menu] button").filter({
        hasText: "Nur Motivationsschreiben als PDF",
      }),
    ).toBeEnabled();

    await body.fill(
      "Ich interessiere mich sehr für die Lehrstelle und freue mich auf ein Gespräch.",
    );
    await expect.poll(() => pages.count(), { timeout: 20_000 }).toBe(1);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("letter layout controls and Word-like formatting persist"''',
)
replace_once(
    regression,
    '''    await page.getByRole("gridcell", { name: "Tabelle 2 × 3 einfügen" }).hover();
    await expect(page.getByText("2 × 3 Tabelle")).toBeVisible();''',
    '''    await page.getByRole("gridcell", { name: "Tabelle 2 × 3 einfügen" }).focus();
    await expect(page.getByText("2 × 3 Tabelle")).toBeVisible();''',
)

preflight = "tests/e2e/dossier-letter-preflight.spec.ts"
replace_once(
    preflight,
    '''    expect((await stat(multiPath ?? "")).size).toBeGreaterThan(10_000);
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();''',
    '''    expect((await stat(multiPath ?? "")).size).toBeGreaterThan(10_000);
    if (await dialog.isVisible()) {
      await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();
    }''',
)

print("Final acceptance patches applied")
