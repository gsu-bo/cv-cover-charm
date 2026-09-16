import { DossierChromeControls } from "@/components/dossier/DossierChromeControls";
import { DossierPageMarginsControl } from "@/components/dossier/DossierPageMarginsControl";
import {
  letterPageGeometry,
  letterSafePageMarginMinimums,
} from "@/components/letter/layout-system";
import { DEMO_LETTER, type LetterAlignment, type LetterDesign } from "@/components/letter/types";
import type { DossierChromeOptions } from "@/lib/dossier-chrome";
import type { DossierPageMargins } from "@/lib/dossier-page-margins";

const buttonClass =
  "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function legacyChromePatch(patch: Partial<DossierChromeOptions>): Partial<LetterDesign> {
  const next: Partial<LetterDesign> = {};
  if (patch.headerMode !== undefined) next.headerMode = patch.headerMode;
  if (patch.headerShowName !== undefined) next.headerShowName = patch.headerShowName;
  if (patch.headerShowAddress !== undefined) next.headerShowAddress = patch.headerShowAddress;
  if (patch.headerShowPhone !== undefined) next.headerShowPhone = patch.headerShowPhone;
  if (patch.headerShowEmail !== undefined) next.headerShowEmail = patch.headerShowEmail;
  if (patch.headerDifferentFirstPage !== undefined) {
    next.headerDifferentFirstPage = patch.headerDifferentFirstPage;
  }
  if (patch.headerHeightMm !== undefined) next.headerHeightMm = patch.headerHeightMm;
  if (patch.headerTextLayout !== undefined) next.headerTextLayout = patch.headerTextLayout;
  if (patch.headerInlineSeparator !== undefined) {
    next.headerInlineSeparator = patch.headerInlineSeparator;
  }
  if (patch.headerBackgroundColor !== undefined) {
    next.headerBackgroundColor = patch.headerBackgroundColor;
  }
  if (patch.headerGradientColor !== undefined) next.headerGradientColor = patch.headerGradientColor;
  if (patch.footerMode !== undefined) {
    next.footerMode = patch.footerMode === "details" ? "attachments" : patch.footerMode;
  }
  if (patch.footerHeightMm !== undefined) next.footerHeightMm = patch.footerHeightMm;
  if (patch.footerTextLayout !== undefined) next.footerTextLayout = patch.footerTextLayout;
  if (patch.footerBackgroundColor !== undefined) {
    next.footerBackgroundColor = patch.footerBackgroundColor;
  }
  if (patch.footerGradientColor !== undefined) next.footerGradientColor = patch.footerGradientColor;
  if (patch.borderEnabled !== undefined) next.chromeBorderEnabled = patch.borderEnabled;
  if (patch.borderColor !== undefined) next.chromeBorderColor = patch.borderColor;
  if (patch.borderWidthMm !== undefined) next.chromeBorderWidthMm = patch.borderWidthMm;
  if (patch.textFont !== undefined) next.chromeTextFont = patch.textFont;
  return next;
}

function currentLetterDefaultMargins(design: LetterDesign): DossierPageMargins {
  if (typeof document !== "undefined") {
    const layer = document.querySelector<HTMLElement>(
      '[data-letter-page]:not([data-export-mode="true"]) [data-letter-text-layer], [data-letter-page] [data-letter-text-layer]',
    );
    const raw = layer?.dataset.letterContentBox;
    if (raw) {
      const [left, top, right, bottom] = raw.split(",").map(Number);
      if ([left, top, right, bottom].every(Number.isFinite)) {
        return { left, top, right, bottom };
      }
    }
  }

  const geometry = letterPageGeometry(DEMO_LETTER, design);
  const headerGap = geometry.effectiveHeaderMode === "none" ? 0 : 12;
  return {
    left: geometry.content.left,
    top: geometry.content.top + headerGap,
    right: geometry.content.right,
    bottom: geometry.content.bottom,
  };
}

function AlignmentRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LetterAlignment;
  onChange: (value: LetterAlignment) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2.5">
      <span className="text-xs font-medium">{label}</span>
      <div className="flex gap-1" role="group" aria-label={`${label} ausrichten`}>
        {(["left", "right"] as const).map((alignment) => {
          const active = value === alignment;
          const text = alignment === "left" ? "Links" : "Rechts";
          return (
            <button
              key={alignment}
              type="button"
              aria-pressed={active}
              aria-label={`${label} ${text}`}
              onClick={() => onChange(alignment)}
              className={`${buttonClass} ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LetterLayoutControls({
  design,
  onChange,
}: {
  design: LetterDesign;
  onChange: (value: Partial<LetterDesign>) => void;
}) {
  const defaultMargins = currentLetterDefaultMargins(design);
  const minimumMargins = letterSafePageMarginMinimums(DEMO_LETTER, design);
  const accentColor = design.colors.accent ?? design.colors.primary;

  return (
    <div className="grid gap-2.5">
      <DossierChromeControls
        scope="letter"
        onOptionsChange={(patch) => onChange(legacyChromePatch(patch))}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Header und Footer stellst du hier gemeinsam für Lebenslauf und Motivationsschreiben ein.
        Empfänger, Datum und Trennlinien bleiben briefspezifisch.
      </p>

      <AlignmentRow
        label="Meine Kontaktdaten"
        value={design.senderAlign ?? "left"}
        onChange={(senderAlign) => onChange({ senderAlign })}
      />
      <AlignmentRow
        label="Firma / Lehrbetrieb"
        value={design.recipientAlign ?? "left"}
        onChange={(recipientAlign) => onChange({ recipientAlign })}
      />
      <AlignmentRow
        label="Ort & Datum"
        value={design.dateAlign ?? "left"}
        onChange={(dateAlign) => onChange({ dateAlign })}
      />

      <div className="grid gap-2 rounded-md border p-2.5">
        <span className="text-xs font-medium">Trennlinien im Kopf</span>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={design.ruleAfterSender === true}
            onChange={(event) => onChange({ ruleAfterSender: event.target.checked })}
          />
          Trennlinie nach meinen Kontaktdaten
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={design.ruleAfterRecipient === true}
            onChange={(event) => onChange({ ruleAfterRecipient: event.target.checked })}
          />
          Trennlinie nach Firma / Lehrbetrieb
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={design.ruleAfterSubject === true}
            onChange={(event) => onChange({ ruleAfterSubject: event.target.checked })}
          />
          Trennlinie nach Titel / Betreff
        </label>
      </div>

      <DossierPageMarginsControl
        scope="letter"
        defaultMargins={defaultMargins}
        minimumMargins={minimumMargins}
        accentColor={accentColor}
        onApplied={() => onChange({})}
      />
    </div>
  );
}
