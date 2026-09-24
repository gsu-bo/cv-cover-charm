import { Fragment, useId, type ReactNode } from "react";
import "./Section.css";
import "./SectionMicroPolish.css";

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  /**
   * Legacy call-site compatibility only.
   *
   * The editor form deliberately keeps its own stable DOM order. CV/PDF rubric
   * order is a document-layout concern and must not reorder the form itself.
   */
  order?: number;
  /** Kurzinfo rechts im Kopf, z. B. "5 / 7 ausgefüllt". */
  hint?: string;
  /** Markiert eine inhaltliche CV-Rubrik für die wechselnde Orientierungstönung. */
  rubricTone?: number;
  action?: ReactNode;
  children: ReactNode;
};

type FormGroup = "content" | "design" | "advanced";
type HintKind = "empty" | "ready" | "neutral";

const DESIGN_SECTIONS = new Set([
  "Vorlage",
  "Farben",
  "Schrift",
  "Schrift und Layout",
  "Header & Footer",
]);
const ADVANCED_SECTIONS = new Set(["Layout", "PDF-Angaben", "Rubriken anordnen"]);

function formGroup(title: string): FormGroup {
  if (DESIGN_SECTIONS.has(title)) return "design";
  if (ADVANCED_SECTIONS.has(title)) return "advanced";
  return "content";
}

function groupMarker(title: string): string | null {
  if (title === "Bewerbung" || title === "Vom Dossier übernehmen") return "Inhalt";
  if (title === "Vorlage") return "Gestaltung";
  if (title === "Layout" || title === "PDF-Angaben" || title === "Rubriken anordnen") {
    return "Erweitert";
  }
  return null;
}

function hintKind(hint: string | undefined): HintKind | undefined {
  if (!hint) return undefined;
  const normalized = hint.trim().toLocaleLowerCase("de-CH");
  if (/^(leer|fehlt|nicht gesetzt|keine daten)$/.test(normalized)) return "empty";
  if (/^(gesetzt|bereit|aktiv|vorhanden|gespeichert)$/.test(normalized)) return "ready";
  return "neutral";
}

/** Aufklappbarer Abschnitt für die gemeinsame Dossier-Seitenleiste. */
export function Section({
  title,
  open,
  onToggle,
  hint,
  rubricTone,
  action,
  children,
}: Props) {
  const id = useId();
  const group = formGroup(title);
  const marker = groupMarker(title);
  const isRubric = rubricTone !== undefined;
  const resolvedHintKind = hintKind(hint);

  return (
    <Fragment>
      {marker ? (
        <div data-form-group-divider={group} className="flex items-center gap-2 px-1 pt-1">
          <span
            data-form-group-marker
            className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {marker}
          </span>
          <span data-form-group-divider-line className="h-px min-w-4 flex-1 bg-border/70" />
        </div>
      ) : null}

      <section
        data-editor-section
        data-editor-section-title={title}
        data-editor-section-open={open ? "true" : "false"}
        data-form-group={group}
        data-editor-rubric-tone={isRubric ? "auto" : undefined}
        className="relative overflow-hidden rounded-xl border bg-background transition-[border-color,box-shadow,background-color] duration-200"
      >
        <div data-editor-section-header className="flex items-center gap-2 pr-2 sm:pr-3">
          <button
            type="button"
            data-editor-section-toggle
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={id}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/35 sm:px-4 sm:py-3"
          >
            <svg
              data-editor-section-chevron
              width="11"
              height="11"
              viewBox="0 0 12 12"
              aria-hidden="true"
              className={`shrink-0 text-muted-foreground transition-[transform,color] duration-200 ${open ? "rotate-90" : ""}`}
            >
              <path
                d="M4 2.5l4 3.5-4 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-tight tracking-tight text-foreground/90">
              {title}
            </span>
            {hint && (
              <span
                data-editor-section-hint
                data-hint-kind={resolvedHintKind}
                className="ml-auto shrink-0 rounded-full border border-border/60 bg-muted/55 px-2 py-0.5 text-[10px] font-medium normal-case text-muted-foreground sm:text-[11px]"
              >
                {hint}
              </span>
            )}
          </button>
          {action}
        </div>
        {open && (
          <div
            id={id}
            data-editor-section-body
            className="border-t border-border/70 px-3 py-3 sm:px-4 sm:py-4"
          >
            {children}
          </div>
        )}
      </section>
    </Fragment>
  );
}
