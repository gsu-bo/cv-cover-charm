import { useSyncExternalStore } from "react";
import { DossierPageMarginsControl } from "@/components/dossier/DossierPageMarginsControl";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";
import {
  cvDefaultContentBox,
  cvFrameFor,
  cvSafePageMarginMinimums,
  type CvRenderLayout,
} from "./archetype";
import { getCvLayout, subscribeCvLayout } from "./layout";
import type { CvDesign } from "./types";

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

  return (
    <DossierPageMarginsControl
      scope="cv"
      defaultMargins={defaultMargins}
      minimumMargins={minimumMargins}
      accentColor={accentColor}
    />
  );
}
