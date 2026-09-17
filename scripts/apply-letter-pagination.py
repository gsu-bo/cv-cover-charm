from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    text = read(path)
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"{path}: start marker not found: {start[:80]!r}")
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise RuntimeError(f"{path}: end marker not found: {end[:80]!r}")
    write(path, text[:start_index] + replacement + text[end_index:])


# ---------------------------------------------------------------------------
# Standalone motivation-letter editor: use the shared multi-page document.
# ---------------------------------------------------------------------------
route = "src/routes/anschreiben.tsx"
replace_once(route, 'import { ScaledPreview } from "@/components/cover/ScaledPreview";\n', "")
replace_once(
    route,
    'import { LetterCanvas } from "@/components/letter/LetterCanvas";\n',
    'import { LetterDocument, type LetterPaginationState } from "@/components/letter/LetterDocument";\n',
)
replace_once(
    route,
    '  const [letterOverflow, setLetterOverflow] = useState(false);\n',
    '  const [letterPagination, setLetterPagination] = useState<LetterPaginationState>({\n'
    '    ready: false,\n'
    '    pageCount: 1,\n'
    '    issue: null,\n'
    '  });\n',
)

replace_between(
    route,
    "  const downloadMotivationLetter = async () => {\n",
    "  const syncAllFromDossier = () => {",
    '''  const downloadMotivationLetter = async () => {
    if (
      pdfDownloading ||
      !letterPagination.ready ||
      letterPagination.issue ||
      !letterHasStarted(data)
    )
      return;
    setPdfError(null);
    setPdfDownloading(true);
    try {
      const root = document.querySelector<HTMLElement>(
        "[data-letter-standalone-export] [data-letter-document-root]",
      );
      if (!root) throw new Error("Exportansicht ist noch nicht bereit");
      const namePart = data.absenderName
        .trim()
        .replace(/\\s+/g, "-")
        .replace(/[^A-Za-z0-9ÄÖÜäöüß_-]/g, "");
      await downloadLetterPdf(root, `Motivationsschreiben-${namePart || "Bewerbung"}.pdf`, {
        title: data.betreff || "Motivationsschreiben",
        author: data.absenderName.trim(),
        subject: "Motivationsschreiben",
        keywords: "Bewerbung, Motivationsschreiben, Lehrstelle",
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden.");
    } finally {
      setPdfDownloading(false);
    }
  };

''',
)
replace_once(
    route,
    '                disabled={letterOverflow || !letterHasStarted(data)}\n',
    '                disabled={\n'
    '                  !letterPagination.ready ||\n'
    '                  !!letterPagination.issue ||\n'
    '                  !letterHasStarted(data)\n'
    '                }\n',
)
replace_between(
    route,
    "            {letterOverflow ? (\n",
    "            {pdfError ? (",
    '''            {letterPagination.issue ? (
              <div
                role="alert"
                data-letter-pagination-issue={letterPagination.issue.code}
                className="rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              >
                <div className="font-semibold">Inhalt kann nicht sicher umbrochen werden</div>
                <div>{letterPagination.issue.message}</div>
              </div>
            ) : null}

''',
)
replace_between(
    route,
    '        <main className="min-w-0 flex-1 overflow-auto bg-muted/40 p-3 sm:p-6">\n',
    "      </div>\n    </div>\n  );\n}\n",
    '''        <main className="min-w-0 flex-1 overflow-auto bg-muted/40 p-3 sm:p-6">
          <div className="mx-auto w-full max-w-[980px] py-2 sm:py-4">
            <LetterDocument
              data={data}
              design={design}
              chromeOptions={chromeOptions}
              chromeContact={chromeContact}
              onPaginationChange={setLetterPagination}
              onImageChange={patchLetterImage}
              onImageRemove={removeLetterImage}
              scaledPreview
            />
          </div>
        </main>

        <div
          data-letter-standalone-export
          className="pointer-events-none fixed left-[-10000px] top-0"
          aria-hidden="true"
        >
          <LetterDocument
            data={data}
            design={design}
            chromeOptions={chromeOptions}
            chromeContact={chromeContact}
            exportMode
            ariaLabel="Exportansicht Motivationsschreiben"
          />
        </div>
''',
)

# ---------------------------------------------------------------------------
# PDF: collect all letter pages in document order and rebuild native text per page.
# ---------------------------------------------------------------------------
pdf_path = "src/lib/dossier-pdf.ts"
pdf = read(pdf_path)
marker = "/** Titelblatt bleibt Raster; Anschreiben und CV erhalten echte, sichtbare PDF-Textebenen. */\n"
index = pdf.find(marker)
if index < 0:
    raise RuntimeError("dossier-pdf.ts: export marker not found")
pdf_tail = r'''/** Resolve the finished physical motivation-letter pages from the shared document paginator. */
async function resolvedLetterPages(rootOrPage: HTMLElement): Promise<HTMLElement[]> {
  if (rootOrPage.matches("[data-letter-page]")) return [rootOrPage];

  for (let frame = 0; frame < 180; frame += 1) {
    const documentRoot = rootOrPage.matches("[data-letter-document-root]")
      ? rootOrPage
      : rootOrPage.querySelector<HTMLElement>("[data-letter-document-root]");
    const issue = documentRoot?.dataset.letterPaginationErrorMessage?.trim();
    if (issue) throw new Error(issue);

    const ready = !documentRoot || documentRoot.dataset.letterPaginationReady === "true";
    const pages = Array.from(rootOrPage.querySelectorAll<HTMLElement>("[data-letter-page]"));
    if (ready && pages.length) return pages;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  throw new Error("Motivationsschreiben-Seitenumbruch ist noch nicht bereit");
}

function assertLetterPagesFit(pages: HTMLElement[]) {
  const overflowing = pages.find(letterPageOverflows);
  if (!overflowing) return;
  const pageNumber = Number(overflowing.dataset.letterPageIndex ?? "0") + 1;
  throw new Error(
    `Motivationsschreiben Seite ${pageNumber} enthält Inhalt, der nicht sicher auf die Seite passt.`,
  );
}

/** Titelblatt bleibt Raster; alle Anschreiben-Seiten und CV-Seiten erhalten echte Textlagen. */
export async function downloadCombinedDossierPdf(
  root: HTMLElement,
  fileName: string,
  meta: DossierPdfMeta,
): Promise<void> {
  await document.fonts?.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const cover = root.querySelector<HTMLElement>("[data-dossier-document='cover']");
  const letterRoot = root.querySelector<HTMLElement>("[data-dossier-document='letter']");
  const cvPages = Array.from(root.querySelectorAll<HTMLElement>("[data-cv-page]"));
  const letterPages = letterRoot ? await resolvedLetterPages(letterRoot) : [];
  if (!cover || !letterPages.length || !cvPages.length) {
    throw new Error(
      "Dossier ist noch nicht vollständig: Titelblatt, Motivationsschreiben und Lebenslauf werden benötigt",
    );
  }
  assertLetterPagesFit(letterPages);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await registerCabinPdfFonts(pdf);
  pdf.setProperties({
    title: meta.title,
    author: meta.author,
    subject: meta.subject ?? "Bewerbungsdossier",
    keywords: meta.keywords ?? "Bewerbung, Motivationsschreiben, Lebenslauf, Titelblatt",
    creator: meta.author || "Bewerbungsdossier",
  });

  await addRasterPage(pdf, html2canvas, cover);
  for (const letterPage of letterPages) {
    pdf.addPage("a4", "portrait");
    await addRasterPage(pdf, html2canvas, letterPage, true);
    addLetterTextLayer(pdf, letterPage);
  }
  for (const cvPage of cvPages) {
    pdf.addPage("a4", "portrait");
    // Keep the raster on exactly the same live CSS-zoom geometry that the native
    // CV text layer measures. The former clone normalization fixed raster glyph
    // spacing but shifted decorative rules once text became native.
    await addRasterPage(pdf, html2canvas, cvPage);
    addCvTextLayer(pdf, cvPage);
  }

  downloadBlob(pdf.output("blob"), fileName);
}

/** Exportiert sämtliche Seiten des Motivationsschreibens mit echter PDF-Textebene. */
export async function downloadLetterPdf(
  rootOrPage: HTMLElement,
  fileName: string,
  meta: DossierPdfMeta,
): Promise<void> {
  await document.fonts?.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const pages = await resolvedLetterPages(rootOrPage);
  if (!pages.length) {
    throw new Error("Motivationsschreiben konnte nicht für den PDF-Export gefunden werden");
  }
  assertLetterPagesFit(pages);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await registerCabinPdfFonts(pdf);
  pdf.setProperties({
    title: meta.title,
    author: meta.author,
    subject: meta.subject ?? "Motivationsschreiben",
    keywords: meta.keywords ?? "Bewerbung, Motivationsschreiben, Lehrstelle",
    creator: meta.author || "Motivationsschreiben",
  });

  for (const [index, page] of pages.entries()) {
    if (index) pdf.addPage("a4", "portrait");
    await addRasterPage(pdf, html2canvas, page, true);
    addLetterTextLayer(pdf, page);
  }
  downloadBlob(pdf.output("blob"), fileName);
}
'''
write(pdf_path, pdf[:index] + pdf_tail)

# ---------------------------------------------------------------------------
# Dossier preflight: normal multi-page letters are valid; only real pagination
# errors or physical page overflow block the PDF.
# ---------------------------------------------------------------------------
dialog = "src/components/dossier/DossierExportDialog.tsx"
replace_once(
    dialog,
    'import { letterReadiness, letterTextLayerOverflows } from "@/components/letter/preflight";\n',
    'import { letterPageOverflows, letterReadiness } from "@/components/letter/preflight";\n',
)
replace_once(
    dialog,
    '  const [letterOverflow, setLetterOverflow] = useState<boolean | null>(null);\n',
    '  const [letterOverflow, setLetterOverflow] = useState<boolean | null>(null);\n'
    '  const [letterPaginationError, setLetterPaginationError] = useState<string | null>(null);\n',
)
replace_between(
    dialog,
    "  useEffect(() => {\n    if (!open || !canDownloadPdf) {\n",
    "  }, [canDownloadPdf, open]);",
    '''  useEffect(() => {
    if (!open || !canDownloadPdf) {
      setLetterOverflow(null);
      setLetterPaginationError(null);
      return;
    }
    let resizeObserver: ResizeObserver | null = null;
    let innerFrame = 0;
    const measure = () => {
      const documentRoot = document.querySelector<HTMLElement>(
        "[data-dossier-document='letter'] [data-letter-document-root]",
      );
      if (!documentRoot || documentRoot.dataset.letterPaginationReady !== "true") {
        setLetterOverflow(null);
        setLetterPaginationError(null);
        return;
      }

      const paginationError = documentRoot.dataset.letterPaginationErrorMessage?.trim() || null;
      const pages = Array.from(documentRoot.querySelectorAll<HTMLElement>("[data-letter-page]"));
      setLetterPaginationError(paginationError);
      if (!pages.length) {
        setLetterOverflow(null);
        return;
      }
      setLetterOverflow(!!paginationError || pages.some(letterPageOverflows));

      if (!resizeObserver) resizeObserver = new ResizeObserver(measure);
      resizeObserver.disconnect();
      for (const page of pages) resizeObserver.observe(page);
    };
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(measure);
    });
    void document.fonts?.ready.then(measure);
    measure();
    return () => {
      cancelAnimationFrame(outerFrame);
      if (innerFrame) cancelAnimationFrame(innerFrame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
''',
)
replace_once(
    dialog,
    '      : letterOverflow === true\n        ? "Brief ist zu lang"\n',
    '      : letterOverflow === true\n        ? letterPaginationError\n          ? "Briefinhalt prüfen"\n          : "Briefseite prüfen"\n',
)
replace_once(
    dialog,
    '''              {pdfOverflowIssue ? (
                <li data-dossier-letter-overflow>
                  <span className="font-medium text-foreground">
                    Motivationsschreiben ist zu lang.
                  </span>{" "}
                  Der Brief passt nicht auf eine A4-Seite; ein abgeschnittenes Dossier-PDF wird
                  nicht erstellt.
                </li>
              ) : null}
''',
    '''              {pdfOverflowIssue ? (
                <li data-dossier-letter-overflow>
                  <span className="font-medium text-foreground">
                    Motivationsschreiben kann nicht sicher exportiert werden.
                  </span>{" "}
                  {letterPaginationError ??
                    "Mindestens eine erzeugte Briefseite läuft über den nutzbaren Seitenbereich."}
                </li>
              ) : null}
''',
)

# ---------------------------------------------------------------------------
# Regression: long valid letters paginate instead of being blocked.
# ---------------------------------------------------------------------------
preflight = "tests/e2e/dossier-letter-preflight.spec.ts"
replace_once(
    preflight,
    '  test("missing fields, overflow and fitting content share one safe dossier preflight", async ({\n',
    '  test("missing fields, multi-page and fitting content share one safe dossier preflight", async ({\n',
)
replace_between(
    preflight,
    '    dialog = await openReview(page);\n    const overflow = dialog.locator("[data-dossier-letter-overflow]");\n',
    '    await page.evaluate(\n      ({ fittingBody, letterKey }) => {',
    '''    dialog = await openReview(page);
    const documentRoot = page.locator(
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
    await dialog.getByRole("button", { name: "Zurück zum Bearbeiten" }).click();

    await page.evaluate(
      ({ fittingBody, letterKey }) => {''',
)

print("letter pagination consumer patch applied")
