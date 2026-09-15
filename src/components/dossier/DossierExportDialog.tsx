import { useEffect, useRef, useState } from "react";
import type { CvLayoutWarning } from "@/components/cv/CvCanvas";
import { letterReadiness, letterTextLayerOverflows } from "@/components/letter/preflight";
import { letterPdfDocumentFromSaved } from "@/lib/dossier-pdf-document";
import { LETTER_STORAGE_KEY, readStoredDossierPart } from "@/lib/dossier-project";

export type DossierExportFormat = "json" | "pdf" | "docx";

type Props = {
  open: boolean;
  cvPageCount: number;
  warnings: CvLayoutWarning[] | null;
  coverChanged: boolean;
  downloading: boolean;
  jsonAvailable?: boolean;
  pdfAvailable?: boolean;
  docxAvailable?: boolean;
  docxTemplateLabel?: string | null;
  onClose: () => void;
  onDownload: (format: DossierExportFormat) => void | Promise<void>;
};

/** Letzter neutraler Kontrollmoment – Exportformat wählen und nur relevante Checks zeigen. */
export function DossierExportDialog({
  open,
  cvPageCount,
  warnings,
  coverChanged,
  downloading,
  jsonAvailable,
  pdfAvailable,
  docxAvailable,
  docxTemplateLabel,
  onClose,
  onDownload,
}: Props) {
  const downloadRef = useRef<HTMLButtonElement>(null);
  const [format, setFormat] = useState<DossierExportFormat>("pdf");
  const [letterOverflow, setLetterOverflow] = useState<boolean | null>(null);
  const formatSelectionEnabled =
    jsonAvailable !== undefined || pdfAvailable !== undefined || docxAvailable !== undefined;
  const canDownloadJson = jsonAvailable ?? false;
  const canDownloadPdf = pdfAvailable ?? true;
  const canDownloadDocx = docxAvailable ?? false;
  const letter = letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY));
  const letterState = letter
    ? letterReadiness(letter.data)
    : { started: false, readyToSend: false, missing: ["Motivationsschreiben"] };

  useEffect(() => {
    if (!open) return;
    if (!formatSelectionEnabled) {
      setFormat("pdf");
      return;
    }
    setFormat((current) => {
      if (current === "pdf" && canDownloadPdf) return current;
      if (current === "docx" && canDownloadDocx) return current;
      if (current === "json" && canDownloadJson) return current;
      if (canDownloadPdf) return "pdf";
      if (canDownloadJson) return "json";
      if (canDownloadDocx) return "docx";
      return "json";
    });
  }, [canDownloadDocx, canDownloadJson, canDownloadPdf, formatSelectionEnabled, open]);

  useEffect(() => {
    if (!open) return;
    downloadRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !downloading) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [downloading, onClose, open]);

  useEffect(() => {
    if (!open || !canDownloadPdf) {
      setLetterOverflow(null);
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let innerFrame = 0;
    const measure = () => {
      const layer = document.querySelector<HTMLElement>(
        "[data-dossier-document='letter'] [data-letter-text-layer]",
      );
      if (!layer) {
        setLetterOverflow(null);
        return;
      }
      setLetterOverflow(letterTextLayerOverflows(layer));
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(layer);
      }
    };

    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
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
  }, [canDownloadPdf, open]);

  if (!open) return null;

  const layoutPending = warnings === null || letterOverflow === null;
  const pdfBlocked =
    !canDownloadPdf ||
    downloading ||
    layoutPending ||
    !letterState.readyToSend ||
    letterOverflow === true;
  const docxBlocked = !canDownloadDocx || downloading;
  const jsonBlocked = !canDownloadJson || downloading;
  const downloadBlocked =
    format === "pdf" ? pdfBlocked : format === "docx" ? docxBlocked : jsonBlocked;

  const actionLabel = !formatSelectionEnabled
    ? downloading
      ? "PDF wird erstellt…"
      : "Dossier herunterladen"
    : format === "pdf"
      ? downloading
        ? "PDF wird erstellt…"
        : "PDF herunterladen"
      : format === "docx"
        ? downloading
          ? "DOCX wird erstellt…"
          : "DOCX herunterladen"
        : downloading
          ? "JSON wird erstellt…"
          : "JSON herunterladen";

  const optionClass = (selected: boolean, disabled: boolean) =>
    `w-full rounded-lg border px-3 py-3 text-left transition-colors ${
      selected ? "border-primary bg-primary/5" : "border-input bg-background hover:bg-accent"
    } ${disabled ? "cursor-not-allowed opacity-50 hover:bg-background" : ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !downloading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-export-title"
        className="w-full max-w-md rounded-xl border bg-background p-5 shadow-2xl"
      >
        <h2 id="dossier-export-title" className="text-base font-semibold">
          Dossier herunterladen
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatSelectionEnabled ? (
            <>Wähle das gewünschte Format. Die Dateien werden lokal erstellt und nicht hochgeladen.</>
          ) : (
            <>
              Reihenfolge: Titelblatt, Motivationsschreiben und {cvPageCount || "alle"} CV-Seite
              {cvPageCount === 1 ? "" : "n"}.
            </>
          )}
        </p>

        {formatSelectionEnabled ? (
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Downloadformat">
            <button
              type="button"
              role="radio"
              aria-checked={format === "json"}
              disabled={!canDownloadJson || downloading}
              onClick={() => setFormat("json")}
              className={optionClass(format === "json", !canDownloadJson || downloading)}
            >
              <span className="block text-sm font-semibold">Projektdatei (JSON)</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                Aktuellen Stand sichern und später wieder weiterbearbeiten.
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={format === "pdf"}
              disabled={!canDownloadPdf || downloading}
              onClick={() => setFormat("pdf")}
              className={optionClass(format === "pdf", !canDownloadPdf || downloading)}
            >
              <span className="block text-sm font-semibold">Fertiges Dossier (PDF)</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {canDownloadPdf
                  ? `Titelblatt, Motivationsschreiben und ${cvPageCount || "alle"} CV-Seite${cvPageCount === 1 ? "" : "n"}.`
                  : "Benötigt Titelblatt, Motivationsschreiben und Lebenslauf."}
              </span>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={format === "docx"}
              disabled={!canDownloadDocx || downloading}
              onClick={() => setFormat("docx")}
              className={optionClass(format === "docx", !canDownloadDocx || downloading)}
            >
              <span className="block text-sm font-semibold">Bearbeitbares Dossier (DOCX)</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {canDownloadDocx
                  ? `Word-Datei${docxTemplateLabel ? ` · Vorlage ${docxTemplateLabel}` : ""}.`
                  : "Benötigt ein vollständiges Dossier mit derselben aktiven Vorlage."}
              </span>
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          {formatSelectionEnabled && format === "json" ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Diese Datei enthält deinen Projektstand zum späteren Laden – nicht das fertige
              Bewerbungsdossier.
            </div>
          ) : null}

          {formatSelectionEnabled && format === "docx" ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              DOCX ist zum Weiterbearbeiten in Microsoft Word gedacht. Für eine unveränderliche
              Bewerbung verwende PDF.
            </div>
          ) : null}

          {format === "pdf" && !letterState.readyToSend ? (
            <div
              role="alert"
              data-dossier-letter-readiness
              className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="font-semibold">Motivationsschreiben noch nicht versandbereit</div>
              <div className="mt-1">Ergänze noch:</div>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {letterState.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {format === "pdf" && letterState.readyToSend && letterOverflow === null ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Motivationsschreiben wird auf eine sichere A4-Seite geprüft…
            </div>
          ) : null}

          {format === "pdf" && letterOverflow === true ? (
            <div
              role="alert"
              data-dossier-letter-overflow
              className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="font-semibold">Motivationsschreiben ist zu lang</div>
              <div>
                Der Brief passt nicht auf eine A4-Seite. Kürze ihn im Motivationsschreiben-Editor;
                ein abgeschnittenes Dossier-PDF wird nicht erstellt.
              </div>
            </div>
          ) : null}

          {format === "pdf" && coverChanged ? (
            <div className="rounded-md border border-sky-300/70 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
              Das Titelblatt wurde seit der letzten Übernahme in den Lebenslauf verändert.
            </div>
          ) : null}

          {format === "pdf" && warnings === null && canDownloadPdf ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Lebenslauf-Layout wird geprüft…
            </div>
          ) : format === "pdf" && warnings?.length ? (
            <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="font-semibold">Layout-Hinweise</div>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={warning.id}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {format !== "json" ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Kontrolliere vor dem Versenden Inhalt, Rechtschreibung und Kontaktdaten selbst.
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            Zurück zum Bearbeiten
          </button>
          <button
            ref={downloadRef}
            type="button"
            onClick={() => void onDownload(format)}
            disabled={downloadBlocked}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
