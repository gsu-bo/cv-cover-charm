import "@/components/cover/fresh-templates";
import { TEMPLATES } from "@/components/cover/types";
import { patchDossierChrome } from "@/lib/dossier-chrome";
import { defaultHeaderGapMmForTemplate, defaultHeaderModeForTemplate } from "@/lib/template-chrome";
import type { LetterTemplateId } from "./types";

const RETIRED_TEMPLATE_IDS = new Set(["warm4", "warm5"]);
const SELECTABLE_TEMPLATES = [...TEMPLATES]
  .filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string))
  .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

type Props = {
  value: LetterTemplateId;
  onChange: (id: LetterTemplateId) => void;
};

const baseClass =
  "flex min-h-10 items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-medium leading-tight transition";

export function LetterTemplatePicker({ value, onChange }: Props) {
  const chooseTemplate = (template: LetterTemplateId) => {
    patchDossierChrome("letter", {
      headerMode: defaultHeaderModeForTemplate(template),
      headerGapMm: defaultHeaderGapMmForTemplate(template),
    });
    onChange(template);
  };

  return (
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
  );
}
