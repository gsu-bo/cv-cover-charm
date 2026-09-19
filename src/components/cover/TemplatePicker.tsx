import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { TemplateId } from "./types";
import { TEMPLATES } from "./types";
import { freshFamilyForTemplate } from "./fresh-templates";
import { applyDossierTheme } from "@/lib/dossier-theme";
import { familyForTemplate } from "@/lib/dossier-family";
import { DOSSIER_CHROME_STORAGE_KEY, patchDossierChrome } from "@/lib/dossier-chrome";
import {
  defaultFooterModeForTemplate,
  defaultHeaderGapMmForTemplate,
  defaultHeaderHeightMmForTemplate,
  defaultHeaderModeForTemplate,
} from "@/lib/template-chrome";
import {
  CV_LAYOUTS,
  getCvLayoutChoice,
  getCvLayoutMirror,
  setCvLayout,
  setCvLayoutMirror,
  subscribeCvLayoutChoice,
  type CvLayoutId,
} from "@/components/cv/layout";
import "../cv/layout-variants.css";
import "../cv/layout-options.css";
import "../dossier-theme.css";
import "./fresh-templates.css";

const RETIRED_TEMPLATE_IDS = new Set(["warm4", "warm5"]);
const SELECTABLE_TEMPLATES = [...TEMPLATES]
  .filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string))
  .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

const EXISTING_DOSSIER_KEYS = ["titelblatt:v3", "anschreiben:v1", "lebenslauf:v1"] as const;

type Props = {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
};

function LayoutPreview({ id }: { id: CvLayoutId }) {
  if (id === "modern") {
    return (
      <span className="flex h-9 w-full overflow-hidden rounded border border-foreground/15 bg-background">
        <span className="w-[30%] bg-foreground/10" />
        <span className="flex flex-1 flex-col gap-1 p-1.5">
          <span className="h-1.5 w-2/3 rounded bg-foreground/55" />
          <span className="h-1 w-full rounded bg-foreground/15" />
          <span className="mt-0.5 h-1 w-4/5 rounded bg-foreground/15" />
        </span>
      </span>
    );
  }

  if (id === "minimal") {
    return (
      <span className="flex h-9 w-full flex-col rounded border border-foreground/15 bg-background px-3 py-1.5">
        <span className="h-1.5 w-2/5 rounded bg-foreground/60" />
        <span className="mt-1 h-px w-1/5 bg-foreground/35" />
        <span className="mt-1.5 h-1 w-4/5 rounded bg-foreground/12" />
        <span className="mt-1 h-1 w-3/5 rounded bg-foreground/12" />
      </span>
    );
  }

  if (id === "timeline") {
    return (
      <span className="relative flex h-9 w-full overflow-hidden rounded border border-foreground/15 bg-background p-1.5 pl-4">
        <span className="absolute bottom-1.5 left-2.5 top-1.5 w-px bg-foreground/25" />
        <span className="absolute left-[7px] top-2 h-2 w-2 rounded-full border-2 border-background bg-foreground/55" />
        <span className="absolute left-[7px] top-[22px] h-2 w-2 rounded-full border-2 border-background bg-foreground/35" />
        <span className="flex flex-1 flex-col gap-1">
          <span className="h-1.5 w-1/2 rounded bg-foreground/55" />
          <span className="h-1 w-full rounded bg-foreground/15" />
          <span className="mt-0.5 h-1 w-4/5 rounded bg-foreground/15" />
        </span>
      </span>
    );
  }

  if (id === "executive") {
    return (
      <span className="flex h-9 w-full overflow-hidden rounded border border-foreground/15 bg-background">
        <span className="flex w-[34%] flex-col gap-1 border-r border-foreground/15 bg-foreground/[0.06] px-1.5 py-2">
          <span className="h-2 w-2 rounded-sm border border-foreground/30" />
          <span className="mt-0.5 h-1 w-4/5 rounded bg-foreground/20" />
          <span className="h-1 w-3/5 rounded bg-foreground/15" />
        </span>
        <span className="flex flex-1 flex-col p-2">
          <span className="h-2 w-3/5 rounded bg-foreground/65" />
          <span className="mt-1 h-px w-full bg-foreground/25" />
          <span className="mt-1.5 h-1 w-4/5 rounded bg-foreground/15" />
        </span>
      </span>
    );
  }

  if (id === "editorial") {
    return (
      <span className="relative flex h-9 w-full flex-col overflow-hidden rounded border border-foreground/15 bg-background px-3 py-1.5">
        <span className="absolute bottom-1.5 left-1.5 top-1.5 w-1 rounded-full bg-foreground/50" />
        <span className="ml-1.5 text-[5px] font-semibold tracking-[0.22em] text-foreground/35">
          CURRICULUM
        </span>
        <span className="ml-1.5 mt-0.5 h-2 w-1/2 rounded bg-foreground/65" />
        <span className="ml-1.5 mt-1 h-px w-full bg-foreground/20" />
        <span className="ml-1.5 mt-1 h-1 w-2/3 rounded bg-foreground/15" />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-full flex-col gap-1 rounded border border-foreground/15 bg-background p-1.5">
      <span className="h-1.5 w-1/2 rounded bg-foreground/55" />
      <span className="h-1 w-full rounded bg-foreground/15" />
      <span className="h-1 w-4/5 rounded bg-foreground/15" />
    </span>
  );
}

function mirrorHint(layout: CvLayoutId): string {
  if (layout === "modern" || layout === "executive") return "Sidebar rechts, Main links";
  if (layout === "timeline") return "Zeitachse und Datumsseite nach rechts";
  if (layout === "editorial") return "Akzent, Foto und Datumsrand tauschen die Seite";
  if (layout === "minimal") return "Foto, Signatur und Datumsseite tauschen die Seite";
  return "Foto und Datumsseite tauschen die Seite";
}

function applyTemplateHeaderDefault(template: TemplateId) {
  const headerMode = defaultHeaderModeForTemplate(template);
  const footerMode = defaultFooterModeForTemplate(template);
  const headerHeightMm = defaultHeaderHeightMmForTemplate(template);
  const headerGapMm = defaultHeaderGapMmForTemplate(template);
  const cvOnly = window.location.pathname.includes("lebenslauf");
  const warmStackedContact =
    template === "freundlich" ? { headerTextLayout: "stacked" as const } : {};
  patchDossierChrome("cv", {
    headerMode,
    footerMode,
    headerHeightMm,
    headerGapMm,
    ...warmStackedContact,
  });
  if (!cvOnly) {
    patchDossierChrome("letter", {
      headerMode,
      footerMode,
      headerHeightMm,
      headerGapMm,
      ...warmStackedContact,
    });
  }
}

export function TemplatePicker({ value, onChange }: Props) {
  const cvLayout = useSyncExternalStore<CvLayoutId>(
    subscribeCvLayoutChoice,
    getCvLayoutChoice,
    () => "classic",
  );
  const mirrored = useSyncExternalStore(subscribeCvLayoutChoice, getCvLayoutMirror, () => false);
  const [onCvPage, setOnCvPage] = useState(false);

  useEffect(() => {
    setOnCvPage(window.location.pathname.includes("lebenslauf"));
  }, []);

  useEffect(() => {
    applyDossierTheme(value, freshFamilyForTemplate(value) ?? familyForTemplate(value));
  }, [value]);

  // Brand-new dossiers start on the canonical Brief fallback. Establish its
  // neutral chrome before parent autosave effects can create a draft key. Existing canonical chrome
  // or legacy drafts remain authoritative and are never overwritten here.
  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(DOSSIER_CHROME_STORAGE_KEY)) return;
      if (EXISTING_DOSSIER_KEYS.some((key) => window.localStorage.getItem(key))) return;
    } catch {
      return;
    }
    applyTemplateHeaderDefault(value);
  }, [value]);

  const chooseTemplate = (template: TemplateId) => {
    applyTemplateHeaderDefault(template);
    onChange(template);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {SELECTABLE_TEMPLATES.map((t) => {
          const active = t.id === value;
          const base = active
            ? "border-foreground bg-accent"
            : "border-input hover:border-foreground/40 hover:bg-accent/40";
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTemplate(t.id)}
              aria-pressed={active}
              title={t.description}
              className={`flex min-h-10 items-center justify-center rounded-md border px-2 py-2 text-center text-xs font-medium leading-tight transition ${base}`}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      {onCvPage && (
        <div className="mt-4 border-t pt-4">
          <div className="mb-2">
            <span className="block text-xs font-medium">CV-Aufbau</span>
            <span className="text-xs text-muted-foreground">
              Bestimmt nur die Anordnung des Inhalts. Der Dossier-Stil bleibt unverändert.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CV_LAYOUTS.map((layout) => {
              const active = cvLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setCvLayout(layout.id)}
                  aria-pressed={active}
                  className={`flex flex-col gap-2 rounded-md border p-2 text-left transition ${
                    active
                      ? "border-foreground bg-accent"
                      : "border-input hover:border-foreground/40"
                  }`}
                >
                  <LayoutPreview id={layout.id} />
                  <span>
                    <span className="block text-xs font-semibold">{layout.name}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {layout.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs">
            <input
              type="checkbox"
              checked={mirrored}
              onChange={(e) => setCvLayoutMirror(e.target.checked)}
            />
            <span>
              <span className="font-medium">Spiegelverkehrt</span>
              <span className="ml-1 text-muted-foreground">{mirrorHint(cvLayout)}</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
