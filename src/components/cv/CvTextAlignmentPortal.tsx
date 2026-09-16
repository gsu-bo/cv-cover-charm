import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { TemplateId } from "@/components/cover/types";
import { DossierPageMarginsControl } from "@/components/dossier/DossierPageMarginsControl";
import { TextAlignmentControl } from "@/components/dossier/TextAlignmentControl";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";
import { cvDefaultContentBox, cvFrameFor } from "@/components/cv/archetype";
import { getCvLayout, subscribeCvLayout } from "@/components/cv/layout";
import {
  getCvTextAlignment,
  setCvTextAlignment,
  subscribeCvTextAlignment,
} from "@/components/cv/text-alignment";

const TARGET_SELECTOR =
  '[data-editor-section-title="Schrift und Layout"] [data-editor-section-body]';

export function CvTextAlignmentPortal({
  template,
  sidebarPct,
  chromeOptions,
  accentColor,
}: {
  template: TemplateId;
  sidebarPct?: number;
  chromeOptions: DossierChromeOptions;
  accentColor?: string;
}) {
  const alignment = useSyncExternalStore(
    subscribeCvTextAlignment,
    getCvTextAlignment,
    (): ReturnType<typeof getCvTextAlignment> => "left",
  );
  const layout = useSyncExternalStore(subscribeCvLayout, getCvLayout, () => "classic");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const defaultMargins = useMemo(
    () => cvDefaultContentBox(cvFrameFor(template), 0, layout, sidebarPct, chromeOptions),
    [chromeOptions, layout, sidebarPct, template],
  );

  useEffect(() => {
    const findTarget = () =>
      setTarget(document.querySelector<HTMLElement>(TARGET_SELECTOR));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <>
      <div
        data-cv-text-alignment-control
        className="mt-3 grid gap-1.5 rounded-md border bg-muted/20 p-2.5"
      >
        <span className="text-xs font-semibold">Fliesstext ausrichten</span>
        <TextAlignmentControl
          value={alignment}
          onChange={setCvTextAlignment}
          ariaLabel="Ausrichtung des Lebenslauf-Fliesstexts"
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Gilt für CV-Inhalte und Beschreibungen. Name und Rubriktitel behalten ihre eigene
          Ausrichtung.
        </p>
      </div>

      <div className="mt-3">
        <DossierPageMarginsControl
          scope="cv"
          defaultMargins={defaultMargins}
          accentColor={accentColor}
        />
      </div>
    </>,
    target,
  );
}
