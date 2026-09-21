import { useEffect, useSyncExternalStore } from "react";
import {
  CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX,
  CV_DOC_TITLE_MARGIN_TOP_MAX_PX,
  getCvDocumentTitleMarginTopPx,
  setCvDocumentTitleMarginTopPx,
  subscribeCvDocumentTitleMarginTop,
} from "@/lib/cv-document-title-spacing";

const HYPHENATION_CSS = `
[data-letter-pdf-richtext="body"],
[data-cv-entry] [data-cv-body] {
  -webkit-hyphens: none;
  hyphens: none;
  word-break: normal;
  overflow-wrap: normal;
}
`;

/** Keep preview and PDF DOM on one deterministic no-hyphenation policy. */
export function DossierHyphenationBridge() {
  return <style data-dossier-hyphenation-style>{HYPHENATION_CSS}</style>;
}

/**
 * Automatic hyphenation was retired. This former control slot now hosts the
 * one global document-title top-spacing control used by every CV template.
 * Header mode/height stay geometry-owned by the shared dossier chrome; this
 * slider only adds deliberate whitespace inside the already-safe content box.
 */
export function DossierHyphenationControl() {
  const marginTopPx = useSyncExternalStore(
    subscribeCvDocumentTitleMarginTop,
    getCvDocumentTitleMarginTopPx,
    () => CV_DOC_TITLE_MARGIN_TOP_DEFAULT_PX,
  );

  useEffect(() => {
    document.documentElement.style.setProperty("--cv-doc-title-margin-top", `${marginTopPx}px`);
  }, [marginTopPx]);

  return (
    <label
      data-cv-doc-title-margin-top-control
      className="flex flex-col gap-1 rounded-md border bg-muted/20 p-2.5 text-xs"
    >
      <span className="flex items-center justify-between gap-3 text-muted-foreground">
        <span>Dokumenttitel – Abstand nach oben</span>
        <span className="tabular-nums">{marginTopPx} px</span>
      </span>
      <input
        aria-label="Dokumenttitel Abstand nach oben"
        type="range"
        min={0}
        max={CV_DOC_TITLE_MARGIN_TOP_MAX_PX}
        step={1}
        value={marginTopPx}
        onChange={(event) => setCvDocumentTitleMarginTopPx(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}
