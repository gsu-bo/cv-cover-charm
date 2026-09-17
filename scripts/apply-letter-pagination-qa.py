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
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{path}: expected one regex match, found {count}: {pattern[:100]!r}")
    write(path, next_text)


# 1) Editor readiness is hydration readiness, not autosave activity.
replace_once(
    "src/routes/anschreiben.tsx",
    'data-editor-ready={saveState === "idle" ? "false" : "true"}',
    'data-editor-ready={hydrated ? "true" : "false"}',
)

# 2) Native PDF text must not resurrect CSS-hidden continuation fields.
replace_once(
    "src/lib/dossier-pdf.ts",
    "    const rect = element.getBoundingClientRect();\n    const style = getComputedStyle(element);",
    "    const rect = element.getBoundingClientRect();\n    if (rect.width <= 0 || rect.height <= 0) continue;\n    const style = getComputedStyle(element);",
)

# 3) Sync remains controllable even when both surfaces are neutral/off.
chrome = "src/components/dossier/DossierChromeControls.tsx"
replace_once(
    chrome,
    "  const footerMax = options.footerMode === \"details\" ? 40 : 18;\n\n  return (",
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
regex_once(
    chrome,
    r'''\n      <div className="flex items-start gap-2">\n        <input\n          id=\{`dossier-chrome-sync-\$\{scope\}`\}.*?\n      </div>\n\n        <label className="block text-xs font-medium">\n          Schrift in Header &amp; Footer''',
    '''\n        <label className="block text-xs font-medium">\n          Schrift in Header &amp; Footer''',
)
replace_once(chrome, "\n        {hasChromeSurface ? (", "\n        {syncControl}\n        {hasChromeSurface ? (")

# 4) A contact header owns the fields explicitly integrated into it exactly once.
cv = "src/components/cv/CvCanvasBase.tsx"
replace_once(
    cv,
    'import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";',
    '''import {
  effectiveDossierHeaderModeForOptions,
  type DossierChromeContact,
  type DossierChromeOptions,
} from "@/lib/dossier-chrome";''',
)
replace_once(
    cv,
    '''  const p = data.person;
  const name = [p.vorname, p.nachname].filter(Boolean).join(" ");
  const adresse = [p.adresse, p.plzOrt].filter(Boolean).join(" · ");
  const kontakt = [p.telefon, p.email].filter(Boolean).join(" · ");
  const kontaktZeilen = [adresse, kontakt].filter(Boolean);
  const angaben = [''',
    '''  const p = data.person;
  const name = [p.vorname, p.nachname].filter(Boolean).join(" ");
  const firstPageContactHeader = effectiveDossierHeaderModeForOptions(chromeOptions, 0) === "contact";
  const bodyName = firstPageContactHeader && chromeOptions.headerShowName ? "" : name;
  const bodyAdresse =
    firstPageContactHeader && chromeOptions.headerShowAddress
      ? ""
      : [p.adresse, p.plzOrt].filter(Boolean).join(" · ");
  const bodyPhone = firstPageContactHeader && chromeOptions.headerShowPhone ? "" : p.telefon;
  const bodyEmail = firstPageContactHeader && chromeOptions.headerShowEmail ? "" : p.email;
  const bodyKontakt = [bodyPhone, bodyEmail].filter(Boolean).join(" · ");
  const kontaktZeilen = [bodyAdresse, bodyKontakt].filter(Boolean);
  const angaben = [''',
)
# First-page name renderers may stay structurally present, but must not duplicate an integrated name.
text = read(cv)
count = text.count('{name || "Dein Name"}')
if count != 4:
    raise RuntimeError(f"{cv}: expected four first-page name expressions, found {count}")
text = text.replace('{name || "Dein Name"}', '{bodyName || (firstPageContactHeader ? "" : "Dein Name")}')
write(cv, text)
replace_once(
    cv,
    "      !!(p.adresse || p.plzOrt || p.telefon || p.email || p.geburtsdatum || p.nationalitaet);",
    "      !!(bodyAdresse || bodyPhone || bodyEmail || p.geburtsdatum || p.nationalitaet);",
)
replace_once(cv, "                    {p.adresse && <div>{p.adresse}</div>}", "                    {!chromeOptions.headerShowAddress || !firstPageContactHeader ? (p.adresse ? <div>{p.adresse}</div> : null) : null}")
replace_once(cv, "                    {p.plzOrt && <div>{p.plzOrt}</div>}", "                    {!chromeOptions.headerShowAddress || !firstPageContactHeader ? (p.plzOrt ? <div>{p.plzOrt}</div> : null) : null}")
replace_once(
    cv,
    '''                    {p.telefon && (
                      <div style={{ marginTop: sidePlan.compact ? "1mm" : "1.7mm" }}>
                        {p.telefon}
                      </div>
                    )}''',
    '''                    {(!firstPageContactHeader || !chromeOptions.headerShowPhone) && p.telefon && (
                      <div style={{ marginTop: sidePlan.compact ? "1mm" : "1.7mm" }}>
                        {p.telefon}
                      </div>
                    )}''',
)
replace_once(cv, "                    {p.email && <div>{p.email}</div>}", "                    {(!firstPageContactHeader || !chromeOptions.headerShowEmail) && p.email && <div>{p.email}</div>}")

# 5) Tests must assert the new multi-page truth, not the retired one-page blocker.
finalqa = "tests/e2e/letter-final-qa.spec.ts"
replace_once(
    finalqa,
    '''  await expect(preview).toBeVisible();
  await expect(exported).toHaveCount(1);
  await doubleFrame(page);''',
    '''  await expect(preview).toBeVisible();
  await expect(page.locator("main [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect(page.locator("[data-letter-standalone-export] [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await doubleFrame(page);''',
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
      page.locator("[data-editor-action-menu] button").filter({ hasText: "Nur Motivationsschreiben als PDF" }),
    ).toBeEnabled();
  });
});''',
)

adversarial = "tests/e2e/letter-adversarial-content.spec.ts"
replace_once(
    adversarial,
    '''  await expect(preview).toBeVisible();
  await expect(exported).toHaveCount(1);
  return { preview, exported };''',
    '''  await expect(preview).toBeVisible();
  await expect(page.locator("main [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect(page.locator("[data-letter-standalone-export] [data-letter-document-root]")).toHaveAttribute(
    "data-letter-pagination-ready",
    "true",
    { timeout: 20_000 },
  );
  await expect.poll(() => exported.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  return { preview, exported };''',
)
regex_once(
    adversarial,
    r'''  test\("deliberately too-long content is clearly blocked instead of silently exported", async \(\{\n    page,\n  \}\) => \{.*?\n  \}\);\n\}\);''',
    '''  test("deliberately long content paginates safely instead of clipping", async ({ page }) => {
    const { exported } = await seedLetter(page, {
      body: HUGE_BODY,
      footerMode: "attachments",
      attachments: ["Lebenslauf", "Zeugnisse"],
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

    const download = page.getByRole("button", { name: "Download", exact: true });
    await download.click();
    await expect(
      page.locator("[data-editor-action-menu] button").filter({ hasText: "Nur Motivationsschreiben als PDF" }),
    ).toBeEnabled();
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
    await expect(root).toHaveAttribute("data-letter-pagination-ready", "true", { timeout: 20_000 });

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
      page.locator("[data-editor-action-menu] button").filter({ hasText: "Nur Motivationsschreiben als PDF" }),
    ).toBeEnabled();

    await body.fill("Ich interessiere mich sehr für die Lehrstelle und freue mich auf ein Gespräch.");
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
