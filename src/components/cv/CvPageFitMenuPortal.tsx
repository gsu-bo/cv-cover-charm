import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  getCvPageFitPageCount,
  setCvPageFitMode,
  subscribeCvPageFit,
  type CvPageFitMode,
} from "./page-fit";

const HOST_ATTR = "data-cv-page-fit-menu-host";

function findOrCreateHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const menu = document.querySelector<HTMLElement>("[data-editor-action-menu]");
  if (!menu) return null;

  const existing = menu.querySelector<HTMLElement>(`[${HOST_ATTR}]`);
  if (existing) return existing;

  const resetButton = Array.from(menu.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.includes("Positionen & Grössen zurücksetzen"),
  );
  if (!resetButton) return null;

  const host = document.createElement("div");
  host.setAttribute(HOST_ATTR, "true");
  menu.insertBefore(host, resetButton);
  return host;
}

/**
 * Whole-document page-fit actions live beside the other global layout actions.
 * They are buttons, not toggles: the result is written into the CV and the
 * transient request is forgotten immediately afterwards.
 */
export function CvPageFitMenuPortal() {
  const pageCount = useSyncExternalStore(subscribeCvPageFit, getCvPageFitPageCount, () => 0);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => setHost(findOrCreateHost());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!host) return null;

  const action = (next: CvPageFitMode, label: string) => (
    <button
      type="button"
      data-cv-page-fit-mode-control={next}
      onClick={() => setCvPageFitMode(next)}
      className="rounded-md border border-input bg-background px-2 py-2 text-xs font-semibold transition hover:bg-accent"
    >
      {label}
    </button>
  );

  return createPortal(
    <div data-cv-page-fit-control className="border-t bg-muted/20 p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {action("one", "Alles auf 1 Seite")}
        {action("two", "Alles auf 2 Seiten")}
      </div>
      {pageCount > 0 ? (
        <div className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Aktuell {pageCount} {pageCount === 1 ? "Seite" : "Seiten"}
        </div>
      ) : null}
    </div>,
    host,
  );
}
