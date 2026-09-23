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
import type { CvDesign } from "./types";

/**
 * Editor-only adapter around the existing shared page-margin store and the
 * existing CV geometry helpers. Whole-document page-fit actions deliberately
 * live beside the other layout reset actions, not among fine geometry controls.
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
