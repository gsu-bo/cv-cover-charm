import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readStoredDocxEntries } from "../../src/lib/dossier-docx-package";
import {
  BASE_URL,
  CHROME_STORAGE_KEY,
  GALLERY_CASES,
  applyGalleryCase,
  seedCanonicalDossier,
  waitEditorReady,
} from "./support/dossier-gallery-shared";
import type { DossierChromeOptions } from "../../src/lib/dossier-chrome";

const cases: { name: string; template: string; patch?: Partial<DossierChromeOptions> }[] = [
  { name: "brief-fresh", template: "brief" },
  { name: "brief-contact", template: "brief", patch: { headerMode: "contact" } },
  {
    name: "brief-compact",
    template: "brief",
    patch: { headerMode: "compact", footerMode: "compact" },
  },
  { name: "brief-details", template: "brief", patch: { footerMode: "details" } },
  {
    name: "brief-contact-hidden",
    template: "brief",
    patch: {
      headerMode: "contact",
      headerShowName: false,
      headerShowAddress: false,
      headerShowPhone: false,
    },
  },
  {
    name: "brief-repeat-contact",
    template: "brief",
    patch: { headerMode: "contact", headerDifferentFirstPage: false },
  },
  { name: "warm-default", template: "freundlich" },
  { name: "warm-contact", template: "freundlich", patch: { headerMode: "contact" } },
  {
    name: "warm-none",
    template: "freundlich",
    patch: { headerMode: "none", footerMode: "none" },
  },
  { name: "kolumne-default", template: "terracotta" },
  { name: "neon-default", template: "neon" },
  { name: "studio-default", template: "studio" },
  { name: "horizon-default", template: "horizon" },
  { name: "cove-default", template: "cove" },
];

// Evidence collection is not the acceptance gate: generated DOCX/PDF/PNG must
// also be rendered and inspected. The manifest deliberately does not claim parity.
test("collect representative semantic parity specimens", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  const root = process.env.SEMANTIC_AUDIT_DIR ?? "artifacts/semantic-parity-audit";
  await mkdir(root, { recursive: true });
  await page.setViewportSize({ width: 1500, height: 1400 });
  const stored = await seedCanonicalDossier(page);
  const report: unknown[] = [];
  for (const item of cases) {
    const fixture = GALLERY_CASES.find((candidate) => candidate.id === item.template);
    expect(fixture).toBeDefined();
    await applyGalleryCase(page, stored, fixture!);
    await page.evaluate(
      ({ key, patch }) => {
        const state = JSON.parse(localStorage.getItem(key)!);
        for (const scope of ["shared", "letter", "cv"]) Object.assign(state[scope], patch);
        localStorage.setItem(key, JSON.stringify(state));
      },
      { key: CHROME_STORAGE_KEY, patch: item.patch ?? {} },
    );
    const observations: Record<string, unknown> = {};
    for (const [scope, route, selector] of [
      ["letter", "/anschreiben", "main [data-letter-page]"],
      ["cv", "/lebenslauf", "main [data-dossier-document='cv']"],
    ]) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
      await waitEditorReady(page);
      await page.evaluate(() => document.fonts.ready);
      const preview = page.locator(selector).first();
      await expect(preview).toBeVisible();
      if (scope === "letter" && item.template === "freundlich") {
        const ownsCompactMasthead =
          item.patch?.headerMode !== "contact" && item.patch?.headerMode !== "none";
        await expect(preview.locator("[data-letter-warm-band]")).toHaveCount(
          ownsCompactMasthead ? 1 : 0,
        );
      }
      observations[scope] = await preview.evaluate((element) => ({
        layout: element.getAttribute("data-cv-layout"),
        chrome: [...element.querySelectorAll("[data-dossier-chrome]")].map((node) => ({
          mode: node.getAttribute("data-dossier-header-mode"),
          footer: node.getAttribute("data-dossier-footer-mode"),
          heights: [...node.querySelectorAll("[data-dossier-header-height-mm]")].map((n) =>
            n.getAttribute("data-dossier-header-height-mm"),
          ),
          text: node.textContent,
        })),
      }));
      await preview.screenshot({
        path: join(root, `${item.name}-${scope}.png`),
        animations: "disabled",
      });
    }
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    for (const format of ["PDF", "DOCX"]) {
      await page.getByRole("button", { name: /Gesamtdossier herunterladen/ }).click();
      const dialog = page.getByRole("dialog", { name: "Dossier herunterladen" });
      await dialog
        .getByRole("radio", {
          name: format === "PDF" ? "Fertiges Dossier (PDF)" : "Bearbeitbares Dossier (DOCX)",
        })
        .click();
      const button = dialog.getByRole("button", { name: `${format} herunterladen`, exact: true });
      await expect(button).toBeEnabled({ timeout: 30_000 });
      const pending = page.waitForEvent("download", { timeout: 120_000 });
      await button.click();
      const download = await pending;
      const path = join(root, `${item.name}.${format.toLowerCase()}`);
      await download.saveAs(path);
      if (format === "PDF" && item.name === "brief-details") {
        const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const task = getDocument({
          data: new Uint8Array(await readFile(path)),
          disableFontFace: true,
        });
        const pdf = await task.promise;
        const letterPage = await pdf.getPage(2);
        const text = await letterPage.getTextContent();
        const words = text.items.filter((entry) => "str" in entry).map((entry) => entry.str);
        expect(words.filter((word) => word === "Beilagen")).toHaveLength(1);
        expect(words.join(" ")).toContain("Lebenslauf");
        expect(words.join(" ")).toContain("Zeugnis");
        await task.destroy();
      }
      if (format === "DOCX") {
        const entries = readStoredDocxEntries(await readFile(path));
        const xml = new TextDecoder().decode(
          entries.find((entry) => entry.name === "word/document.xml")!.bytes,
        );
        if (item.template === "freundlich") {
          const ownsWordHeaderSurface = item.patch?.headerMode !== "none";
          expect(xml.includes('id="warm-letter-masthead"')).toBe(ownsWordHeaderSurface);
        }
        observations.docx = {
          headerParts: entries
            .filter((entry) => /^word\/header/.test(entry.name))
            .map((entry) => entry.name),
          footerParts: entries
            .filter((entry) => /^word\/footer/.test(entry.name))
            .map((entry) => entry.name),
          pageBorderCount: (xml.match(/<w:pgBorders\b/g) ?? []).length,
          differentFirstPageCount: (xml.match(/<w:titlePg\b/g) ?? []).length,
        };
      }
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
    }
    report.push({ ...item, observations, parityVerified: false });
    await writeFile(join(root, "manifest.json"), JSON.stringify(report, null, 2));
  }
});
