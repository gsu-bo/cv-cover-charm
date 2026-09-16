import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TextAlignmentControl } from "@/components/dossier/TextAlignmentControl";
import {
  getCvTextAlignment,
  setCvTextAlignment,
  subscribeCvTextAlignment,
} from "@/components/cv/text-alignment";
import type { TextAlignment } from "@/lib/text-alignment";

const TARGET_SELECTOR =
  '[data-editor-section-title="Schrift und Layout"] [data-editor-section-body]';

export function CvTextAlignmentPortal() {
  const alignment = useSyncExternalStore<TextAlignment>(
    subscribeCvTextAlignment,
    getCvTextAlignment,
    () => "left",
  );
  const [target, setTarget] = useState<HTMLElement | null>(null);

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
    </div>,
    target,
  );
}
