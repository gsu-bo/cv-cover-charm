import { useEffect, useRef, useState } from "react";
import type { CvLayoutWarning } from "@/components/cv/CvCanvas";
import { letterReadiness, letterTextLayerOverflows } from "@/components/letter/preflight";
import {
  coverPdfDocumentFromSaved,
  coverPdfHasContent,
  cvPdfDocumentFromSaved,
  cvPdfHasContent,
  letterPdfDocumentFromSaved,
  letterPdfHasContent,
} from "@/lib/dossier-pdf-document";
import {
  COVER_STORAGE_KEY,
  CV_STORAGE_KEY,
  LETTER_STORAGE_KEY,
  readStoredDossierPart,
} from "@/lib/dossier-project";

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

function joinParts(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} und ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} und ${parts.at(-1)}`;
}

function FileFormatIcon({ label }: { label: "JSON" | "PDF" | "DOCX" }) {
  const labelSize = label === "DOCX" ? 7.2 : 8.5;
  return (
    <svg
      viewBox="0 0 40 48"
      className="h-11 w-10 shrink-0 text-primary"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M7 3.5h18l8 8V43a1.5 1.5 0 0 1-1.5 1.5h-24A1.5 1.5 0 0 1 6 43V5A1.5 1.5 0 0 1 7.5 3.5Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M25 3.8V12h8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="4" y="24" width="32" height="14" rx="4" fill="currentColor" />
      <text
        x="20"
        y="33.3"
        textAnchor="middle"
        fill="var(--color-primary-foreground)"
        fontSize={labelSize}
        fontWeight="700"
        letterSpacing="0.3"
      >
        {label}
      </text>
    </svg>
  );
}

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
  const canDownloadPdf = pdfAvailable ?? true;
  const canDownloadDocx = docxAvailable ?? false;

  const cover = coverPdfDocumentFromSaved(readStoredDossierPart(COVER_STORAGE_KEY));
  const letter = letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY));
  const cv = cvPdfDocumentFromSaved(readStoredDossierPart(CV_STORAGE_KEY));
  const letterHasContent = !!letter && letterPdfHasContent(letter.data);
  const missingParts = [
    !cover || !coverPdfHasContent(cover.data) ? "Titelblatt" : null,
    !letterHasContent ? "Motivationsschreiben" : null,
    !cv || !cvPdfHasContent(cv.data) ? "Lebenslauf" : null,
  ].filter((part): part is string => part !== null);

  const letterState = letter
    ? letterReadiness(letter.data)
    : { started: false, readyToSend: false, missing: ["Motivationsschreiben"] };
  const missingLetterFields = joinParts(letterState.missing);

  useEffect(() => {
    if (!open) return;
    if (!formatSelectionEnabled) {
      setFormat("pdf");
      return;
    }
    setFormat((current) => {
      if (current === "pdf" && canDownloadPdf) return current;
      if (current === "docx" && canDownloadDocx && letterState.readyToSend) return current;
      if (current === "json") return current;
      if (canDownloadPdf) return "pdf";
      return "json";
    });
  }, [canDownloadDocx, canDownloadPdf, formatSelectionEnabled, letterState.readyToSend, open]);

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
  const docxBlocked = !canDownloadDocx || downloading || !letterState.readyToSend;
  const letterIssueCount =
    letterHasContent && !letterState.readyToSend ? letterState.missing.length : 0;
  const docxDesignIssue =
    formatSelectionEnabled &&
    missingParts.length === 0 &&
    letterState.readyToSend &&
    !canDownloadDocx;
  const pdfOverflowIssue = canDownloadPdf && letterState.readyToSend && letterOverflow === true;
  const blockingCount =
    missingParts.length + letterIssueCount + (docxDesignIssue ? 1 : 0) + (pdfOverflowIssue ? 1 : 0);
  const advisoryCount = (warnings?.length ?? 0) + (coverChanged ? 1 : 0);

  const missingPartsCompact = `${missingParts.length} Dossierteil${missingParts.length === 1 ? "" : "e"} ${
    missingParts.length === 1 ? "fehlt" : "fehlen"
  }`;
  const missingFieldsCompact = `${letterState.missing.length} Angabe${
    letterState.missing.length === 1 ? "" : "n"
  } ${letterState.missing.length === 1 ? "fehlt" : "fehlen"}`;
  const pdfCompactStatus = missingParts.length
    ? missingPartsCompact
    : !letterState.readyToSend
      ? missingFieldsCompact
      : letterOverflow === true
        ? "Brief ist zu lang"
        : layoutPending
          ? "Layout wird geprüft…"
          : "Bereit";
  const docxCompactStatus = missingParts.length
    ? missingPartsCompact
    : !letterState.readyToSend
      ? missingFieldsCompact
      : !canDownloadDocx
        ? "Design angleichen"
        : "Bereit";
  const checkSummary = blockingCount
    ? `Was fehlt noch? · ${blockingCount} Punkt${blockingCount === 1 ? "" : "e"}`
    : layoutPending && canDownloadPdf
      ? "Layout wird geprüft…"
      : advisoryCount
        ? `Bereit · ${advisoryCount} Hinweis${advisoryCount === 1 ? "" : "e"}`
        : "Alles bereit";

  const downloadBlocked =
    format === "pdf" ? pdfBlocked : format === "docx" ? docxBlocked : downloading;
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
          ? "Projekt wird gespeichert…"
          : "Projekt speichern";
  const optionClass = (selected: boolean, disabled: boolean) =>
    `min-h-[5.25rem] w-full rounded-lg border px-3 py-3 text-left transition-colors ${
      selected ? "border-primary bg-primary/5" : "border-input bg-background hover:bg-accent"
    } ${disabled ? "cursor-not-allowed opacity-50 hover:bg-background" : ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-2 backdrop-blur-[1px] sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !downloading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-export-title"
        className="max-h-[calc(100vh-1rem)] w-full max-w-3xl overflow-y-auto rounded-xl border bg-background p-4 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="dossier-export-title" className="text-base font-semibold">
            Dossier herunterladen
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatSelectionEnabled
              ? "Nur lokal auf deinem Gerät · kein Upload."
              : `Titelblatt · Motivationsschreiben · ${cvPageCount || "alle"} CV-Seite${cvPageCount === 1 ? "" : "n"}`}
          </p>
        </div>

        {formatSelectionEnabled ? (
          <div
            data-dossier-export-options
            className="mt-3 grid gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Downloadformat"
          >
            <button
              type="button"
              role="radio"
              aria-label="Projektdatei (JSON) – Projekt speichern"
              aria-checked={format === "json"}
              disabled={downloading}
              onClick={() => setFormat("json")}
              className={optionClass(format === "json", downloading)}
            >
              <span className="flex items-center gap-3">
                <FileFormatIcon label="JSON" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Projekt speichern (*.json)</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Zwischenstand</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-label="Fertiges Dossier (PDF)"
              aria-checked={format === "pdf"}
              disabled={!canDownloadPdf || downloading}
              onClick={() => setFormat("pdf")}
              className={optionClass(format === "pdf", !canDownloadPdf || downloading)}
            >
              <span className="flex items-center gap-3">
                <FileFormatIcon label="PDF" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Fertiges Dossier (PDF)</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {pdfCompactStatus}
                  </span>
                </span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-label="Bearbeitbares Dossier (DOCX)"
              aria-checked={format === "docx"}
              disabled={docxBlocked}
              onClick={() => setFormat("docx")}
              className={optionClass(format === "docx", docxBlocked)}
            >
              <span className="flex items-center gap-3">
                <FileFormatIcon label="DOCX" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    Bearbeitbares Dossier (DOCX)
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {docxCompactStatus}
                    {docxCompactStatus === "Bereit" && docxTemplateLabel
                      ? ` · Vorlage ${docxTemplateLabel}`
                      : ""}
                  </span>
                </span>
              </span>
            </button>
          </div>
        ) : null}

        <details data-dossier-export-check className="mt-3 rounded-lg border bg-muted/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>{checkSummary}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ▾
            </span>
          </summary>
          <div className="border-t px-3 py-2 text-xs leading-relaxed">
            <ul className="space-y-1.5 text-muted-foreground">
              {missingParts.map((part) => (
                <li key={part}>
                  <span className="font-medium text-foreground">{part}:</span> fehlt.
                </li>
              ))}
              {letterIssueCount ? (
                <li data-dossier-letter-readiness>
                  <span className="font-medium text-foreground">
                    Motivationsschreiben noch nicht versandbereit:
                  </span>{" "}
                  {missingLetterFields} ergänzen.
                </li>
              ) : null}
              {pdfOverflowIssue ? (
                <li data-dossier-letter-overflow>
                  <span className="font-medium text-foreground">
                    Motivationsschreiben ist zu lang.
                  </span>{" "}
                  Der Brief passt nicht auf eine A4-Seite; ein abgeschnittenes Dossier-PDF wird
                  nicht erstellt.
                </li>
              ) : null}
              {docxDesignIssue ? (
                <li data-dossier-docx-design-issue>
                  <span className="font-medium text-foreground">Word (DOCX):</span> Titelblatt,
                  Motivationsschreiben und Lebenslauf müssen dasselbe Design verwenden. Wähle bei
                  allen drei dieselbe Vorlage.
                </li>
              ) : null}
              {!blockingCount && layoutPending && canDownloadPdf ? (
                <li>PDF: Layout wird noch geprüft.</li>
              ) : null}
              {coverChanged ? (
                <li>
                  Hinweis: Das Titelblatt wurde seit der letzten Übernahme in den Lebenslauf
                  verändert.
                </li>
              ) : null}
              {warnings?.map((warning) => (
                <li key={warning.id}>Layout-Hinweis: {warning.message}</li>
              ))}
              {!blockingCount && !layoutPending ? (
                <>
                  <li>
                    <span className="font-medium text-foreground">PDF:</span> bereit.
                  </li>
                  {formatSelectionEnabled ? (
                    <li>
                      <span className="font-medium text-foreground">Word (DOCX):</span>{" "}
                      {canDownloadDocx ? "bereit." : "noch nicht verfügbar."}
                    </li>
                  ) : null}
                </>
              ) : null}
            </ul>
            <p className="mt-2 border-t pt-2 text-muted-foreground">
              Vor dem Versenden Inhalt, Rechtschreibung und Kontaktdaten selbst kontrollieren.
            </p>
          </div>
        </details>

        <div className="mt-4 flex items-center justify-end gap-2">
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
