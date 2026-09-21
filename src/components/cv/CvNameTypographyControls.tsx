import { FONT_LABELS, type FontKey } from "@/components/cover/types";
import {
  CV_NAME_FONT_SIZE_MAX,
  CV_NAME_FONT_SIZE_MIN,
  CV_NAME_STYLE_DEFAULTS,
  type CvNameStyle,
  type CvPerson,
} from "./types";

const selectClass =
  "w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring";
const smallButtonClass =
  "rounded border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent";

export function CvNameTypographyControls({
  person,
  onChange,
}: {
  person: CvPerson;
  onChange: (patch: Partial<CvPerson>) => void;
}) {
  const style = person.nameStyle ?? {};
  const patchStyle = (patch: Partial<CvNameStyle>) =>
    onChange({ nameStyle: { ...style, ...patch } });
  const fontSize = Math.max(
    CV_NAME_FONT_SIZE_MIN,
    Math.min(CV_NAME_FONT_SIZE_MAX, style.fontSizePt ?? CV_NAME_STYLE_DEFAULTS.fontSizePt),
  );

  return (
    <div
      data-cv-name-typography-controls
      className="grid gap-2 rounded-md border bg-muted/20 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold">Vorname &amp; Nachname gestalten</div>
          <div className="text-[11px] text-muted-foreground">
            Ohne eigene Auswahl bleibt die Typografie der Vorlage erhalten.
          </div>
        </div>
        {person.nameStyle ? (
          <button type="button" className={smallButtonClass} onClick={() => onChange({ nameStyle: undefined })}>
            Vorlage
          </button>
        ) : null}
      </div>

      <label className="grid gap-1 text-xs">
        <span className="text-muted-foreground">Schriftart</span>
        <select
          data-cv-name-font-control
          className={selectClass}
          value={style.font ?? "template"}
          onChange={(event) =>
            patchStyle({
              font: event.target.value === "template" ? undefined : (event.target.value as FontKey),
            })
          }
        >
          <option value="template">Wie Vorlage</option>
          {(Object.entries(FONT_LABELS) as Array<[FontKey, string]>).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs">
        <span className="flex items-center justify-between gap-2 text-muted-foreground">
          <span>Schriftgrösse</span>
          <span>{fontSize} pt</span>
        </span>
        <input
          data-cv-name-size-control
          type="range"
          min={CV_NAME_FONT_SIZE_MIN}
          max={CV_NAME_FONT_SIZE_MAX}
          step={1}
          value={fontSize}
          onChange={(event) => patchStyle({ fontSizePt: Number(event.target.value) })}
          className="w-full accent-primary"
        />
        {style.fontSizePt !== undefined ? (
          <button
            type="button"
            className={`${smallButtonClass} justify-self-start`}
            onClick={() => patchStyle({ fontSizePt: undefined })}
          >
            Vorlagengrösse
          </button>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Schriftfarbe</span>
        <input
          data-cv-name-color-control
          type="color"
          value={style.color ?? "#111111"}
          onChange={(event) => patchStyle({ color: event.target.value })}
          className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
          aria-label="Schriftfarbe Vorname und Nachname"
        />
        {style.color ? (
          <button type="button" className={smallButtonClass} onClick={() => patchStyle({ color: undefined })}>
            Standardfarbe
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Wie Vorlage</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ["bold", "Fett", CV_NAME_STYLE_DEFAULTS.bold, "font-bold"],
            ["italic", "Kursiv", CV_NAME_STYLE_DEFAULTS.italic, "italic"],
            ["underline", "Unterstrichen", CV_NAME_STYLE_DEFAULTS.underline, "underline"],
          ] as const
        ).map(([key, label, fallback, textClass]) => {
          const active = style[key] ?? fallback;
          return (
            <button
              key={key}
              type="button"
              data-cv-name-style-control={key}
              aria-pressed={active}
              onClick={() => patchStyle({ [key]: !active })}
              className={`rounded-md border px-2 py-2 text-xs ${textClass} ${
                active ? "border-foreground bg-muted text-foreground" : "border-input text-muted-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
