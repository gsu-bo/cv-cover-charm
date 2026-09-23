import { useSyncExternalStore } from "react";
import { DossierPageMarginsControl } from "@/components/dossier/DossierPageMarginsControl";
import { patchDossierChrome, type DossierChromeOptions } from "@/lib/dossier-chrome";
import {
  cvDefaultContentBox,
  cvFrameFor,
  cvSafePageMarginMinimums,
  type CvRenderLayout,
} from "./archetype";
import {
  CV_CONTINUATION_GAP_DEFAULT_MM,
  CV_CONTINUATION_GAP_MAX_MM,
  CV_CONTINUATION_GAP_MIN_MM,
  getCvContinuationGapMm,
  getCvLayout,
  setCvContinuationGapMm,
  subscribeCvContinuationGap,
  subscribeCvLayout,
} from "./layout";
import {
  getCvPageFitMode,
  getCvPageFitPageCount,
  setCvPageFitMode,
  subscribeCvPageFit,
  type CvPageFitMode,
} from "./page-fit";
import type { CvDesign } from "./types";

function pageFitStatus(mode: CvPageFitMode | null, pageCount: number): string {
  if (!pageCount) return "Die Vorschau prüft gleich, wie viele Seiten dein Lebenslauf braucht.";
  if (mode === "one") {
    return pageCount === 1
      ? "✓ Passt auf 1 Seite."
      : "Zu viel Inhalt für 1 Seite – 2 Seiten empfohlen.";
  }
  if (mode === "two") {
    if (pageCount === 2) return "✓ Inhalt ausgewogen auf 2 Seiten verteilt.";
    if (pageCount === 1) return "Sehr wenig Inhalt – 1 Seite würde ruhiger wirken.";
    return "Sehr viel Inhalt – trotz automatischer Anpassung sind mehr als 2 Seiten nötig.";
  }
  return pageCount === 1 ? "✓ Passt gut auf 1 Seite." : "2 Seiten empfohlen.";
}

/**
 * Editor-only adapter around the existing shared page-margin store and the
 * existing CV geometry helpers. It exposes controls without changing defaults,
 * clamping rules or renderer ownership.
 */
export function CvPageMarginsControl({
  design,
  chromeOptions,
}: {
  design: CvDesign;
  chromeOptions: DossierChromeOptions;
}) {
  const layout = useSyncExternalStore<CvRenderLayout>(
    subscribeCvLayout,
    getCvLayout,
    () => "classic",
  );
  const continuationGap = useSyncExternalStore(
    subscribeCvContinuationGap,
    getCvContinuationGapMm,
    () => CV_CONTINUATION_GAP_DEFAULT_MM,
  );
  const pageFitMode = useSyncExternalStore(subscribeCvPageFit, getCvPageFitMode, () => null);
  const pageCount = useSyncExternalStore(subscribeCvPageFit, getCvPageFitPageCount, () => 0);
  const frame = cvFrameFor(design.template);
  const defaultMargins = cvDefaultContentBox(frame, 0, layout, design.sidebarPct, chromeOptions);
  const minimumMargins = cvSafePageMarginMinimums(
    frame,
    0,
    layout,
    design.sidebarPct,
    chromeOptions,
  );
  const accentColor = design.colors.accent ?? design.colors.primary ?? design.colors.ink;
  const headerGap = Math.min(40, Math.max(0, chromeOptions.headerGapMm ?? 12));

  return (
    <div className="grid gap-3">
      <div data-cv-page-fit-control className="grid gap-2 rounded-md border bg-muted/20 p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold">Seitenaufteilung</div>
          {pageCount > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              aktuell {pageCount} {pageCount === 1 ? "Seite" : "Seiten"}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {([
            ["one", "1 Seite"],
            ["two", "2 Seiten"],
          ] as const).map(([mode, label]) => {
            const active = pageFitMode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-cv-page-fit-mode-control={mode}
                aria-pressed={active}
                onClick={() => setCvPageFitMode(mode)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Schriftgrössen, Abstände und Rubriken werden automatisch angepasst. Es wird kein Inhalt
          gelöscht oder gekürzt. Bei 2 Seiten verteilt die App die Rubriken möglichst ausgewogen
          und lässt mehr Weissraum.
        </p>
        <p
          aria-live="polite"
          className={`text-[11px] font-medium ${
            pageFitMode === "one" && pageCount > 1 ? "text-amber-700 dark:text-amber-300" : ""
          }`}
        >
          {pageFitStatus(pageFitMode, pageCount)}
        </p>
      </div>

      <DossierPageMarginsControl
        scope="cv"
        defaultMargins={defaultMargins}
        minimumMargins={minimumMargins}
        accentColor={accentColor}
        extraControls={
          <>
            <label className="grid gap-1 text-xs">
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>Abstand oben ab Seite 2</span>
                <span>
                  {continuationGap.toFixed(continuationGap % 1 ? 1 : 0)} mm
                </span>
              </span>
              <input
                data-cv-continuation-gap-control
                type="range"
                min={CV_CONTINUATION_GAP_MIN_MM}
                max={CV_CONTINUATION_GAP_MAX_MM}
                step={1}
                value={continuationGap}
                onChange={(event) => setCvContinuationGapMm(Number(event.target.value))}
                className="w-full accent-primary"
                aria-label="Abstand oben ab Seite 2"
              />
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Gilt nur für den Lebenslauf ab Seite 2. Ein vorhandener Fortsetzungs-Header bleibt
                geschützt.
              </span>
              {continuationGap !== CV_CONTINUATION_GAP_DEFAULT_MM ? (
                <button
                  type="button"
                  className="justify-self-start rounded border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                  onClick={() => setCvContinuationGapMm(CV_CONTINUATION_GAP_DEFAULT_MM)}
                >
                  Standardabstand (4 mm)
                </button>
              ) : null}
            </label>

            <label className="grid gap-1 text-xs">
              <span className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>Zusätzlicher Abstand nach Header</span>
                <span>{headerGap.toFixed(headerGap % 1 ? 1 : 0)} mm</span>
              </span>
              <input
                data-dossier-header-gap-control
                type="range"
                min={0}
                max={40}
                step={1}
                value={headerGap}
                onChange={(event) =>
                  patchDossierChrome("cv", { headerGapMm: Number(event.target.value) })
                }
                className="w-full accent-primary"
                aria-label="Zusätzlicher Abstand nach Header"
              />
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Wird im Lebenslauf auf Seite 1 zusätzlich zum oberen Seitenrand gerechnet. Ab Seite
                2 gilt der separate Regler oben.
              </span>
              {headerGap !== 12 ? (
                <button
                  type="button"
                  className="justify-self-start rounded border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
                  onClick={() => patchDossierChrome("cv", { headerGapMm: 12 })}
                >
                  Standardabstand (12 mm)
                </button>
              ) : null}
            </label>
          </>
        }
      />
    </div>
  );
}
