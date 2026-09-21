import "@/components/cover/fresh-templates";
import { TEMPLATES } from "@/components/cover/types";
import { patchDossierChrome } from "@/lib/dossier-chrome";
import { recommendedHeaderPatchForTemplate } from "@/lib/template-chrome";
import {
  DEFAULT_LETTER_MOTIF_OPACITY,
  normalizeLetterMotifOpacity,
  type LetterTemplateId,
} from "./types";

const RETIRED_TEMPLATE_IDS = new Set(["warm4", "warm5"]);
const SELECTABLE_TEMPLATES = [...TEMPLATES]
  .filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string))
  .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

type Props = {
  value: LetterTemplateId;
  onChange: (id: LetterTemplateId) => void;
  motifOpacity?: number;
  onMotifOpacityChange?: (value: number) => void;
};

const baseClass =
  "flex min-h-10 items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-medium leading-tight transition";

export function LetterTemplatePicker({
  value,
  onChange,
  motifOpacity = DEFAULT_LETTER_MOTIF_OPACITY,
  onMotifOpacityChange,
}: Props) {
  const chooseTemplate = (template: LetterTemplateId) => {
    const recommendation = recommendedHeaderPatchForTemplate(template);
    if (recommendation) patchDossierChrome("letter", recommendation);
    onChange(template);
  };
  const normalizedMotifOpacity = normalizeLetterMotifOpacity(motifOpacity);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2">
        {SELECTABLE_TEMPLATES.map((template) => {
          const active = template.id === value;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => chooseTemplate(template.id)}
              aria-pressed={active}
              title={template.description}
              className={`${baseClass} ${
                active
                  ? "border-foreground bg-accent"
                  : "border-input hover:border-foreground/40 hover:bg-accent/40"
              }`}
            >
              {template.name}
            </button>
          );
        })}
      </div>

      {onMotifOpacityChange ? (
        <div data-letter-motif-control className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Hintergrund-Motiv {Math.round(normalizedMotifOpacity * 100)} % sichtbar
            </span>
            {Math.abs(normalizedMotifOpacity - DEFAULT_LETTER_MOTIF_OPACITY) > 0.001 ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => onMotifOpacityChange(DEFAULT_LETTER_MOTIF_OPACITY)}
              >
                25 %
              </button>
            ) : null}
          </div>
          <input
            aria-label="Hintergrund-Motiv"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(normalizedMotifOpacity * 100)}
            onChange={(event) =>
              onMotifOpacityChange(normalizeLetterMotifOpacity(Number(event.target.value) / 100))
            }
            className="w-full accent-primary"
          />
        </div>
      ) : null}
    </div>
  );
}
