import { useId, type ReactNode } from "react";

type Props = {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Optional visual order inside an editor group. */
  order?: number;
  /** Kurzinfo rechts im Kopf, z. B. "5 / 7 ausgefüllt". */
  hint?: string;
  /** Feine wechselnde Orientierungstönung für inhaltliche CV-Rubriken. */
  rubricTone?: number;
  action?: ReactNode;
  children: ReactNode;
};

type FormGroup = "content" | "design" | "advanced";

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

/** Aufklappbarer Abschnitt für die gemeinsame Dossier-Seitenleiste. */
export function Section({
  title,
  open,
  onToggle,
  order,
  hint,
  rubricTone,
  action,
  children,
}: Props) {
  const id = useId();
  const group = formGroup(title);
  const marker = groupMarker(title);
  const tone = rubricTone === undefined ? null : Math.abs(rubricTone) % 2;
  const headerTone =
    tone === 0
      ? "bg-sky-50/80 dark:bg-sky-950/25"
      : tone === 1
        ? "bg-violet-50/75 dark:bg-violet-950/20"
        : "";
  const bodyTone =
    tone === 0
      ? "bg-sky-50/30 dark:bg-sky-950/10"
      : tone === 1
        ? "bg-violet-50/25 dark:bg-violet-950/10"
        : "";

  return (
    <section
      data-editor-section
      data-editor-section-title={title}
      data-form-group={group}
      data-editor-rubric-tone={tone === null ? undefined : tone}
      className="overflow-hidden rounded-lg border bg-background"
      style={order === undefined ? undefined : { order }}
    >
      <div className={`flex items-center gap-2 pr-2 sm:pr-3 ${headerTone}`}>
        <button
          type="button"
          data-editor-section-toggle
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left hover:bg-accent/35 sm:px-4 sm:py-3"
        >
          {marker ? (
            <span
              data-form-group-marker
              aria-hidden="true"
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {marker}
            </span>
          ) : null}
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path
              d="M4 2.5l4 3.5-4 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="min-w-0 whitespace-normal break-words text-xs font-semibold uppercase leading-tight tracking-wider text-muted-foreground sm:text-sm">
            {title}
          </span>
          {hint && (
            <span className="ml-auto shrink-0 text-[11px] font-normal normal-case text-muted-foreground/70 sm:text-xs">
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
          className={`border-t px-3 py-3 sm:px-4 sm:py-4 ${bodyTone}`}
        >
          {children}
        </div>
      )}
    </section>
  );
}
