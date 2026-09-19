import { cvBodyData } from "@/lib/dossier-body-contact";
import {
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
} from "react";
import {
  DEFAULT_DOSSIER_CHROME_OPTIONS,
  type DossierChromeContact,
  type DossierChromeOptions,
} from "@/lib/dossier-chrome";
import {
  getDossierPageMarginsSnapshot,
  subscribeDossierPageMargins,
} from "@/lib/dossier-page-margins";
import { resolveTemplateChromeOptions } from "@/lib/template-chrome";
import { CvTextAlignmentPortal } from "./CvTextAlignmentPortal";
import { getCvTextAlignment, subscribeCvTextAlignment } from "./text-alignment";
import { cvContentBox, cvFrameFor } from "./archetype";
import { CV_LAYOUT_EVENT } from "./layout";
import { CvCanvas as BaseCvCanvas } from "./CvCanvasBase";
import type { CvData, CvDesign } from "./types";
import "@/components/dossier/edel-stationery.css";
import "@/components/dossier/human-polish.css";
import "@/components/dossier/legacy-template-refinements.css";
import "./full-section-rules.css";
import "./fresh-modern-sidebar-geometry.css";
import "./default-pagination-density.css";
import "./user-typography.css";

export type { CvLayoutWarning } from "./CvCanvasBase";

type BaseProps = ComponentProps<typeof BaseCvCanvas>;
type Props = Omit<BaseProps, "chromeOptions" | "chromeContact"> & {
  chromeOptions?: DossierChromeOptions;
  chromeContact?: DossierChromeContact;
};

/**
 * Section rules are one dossier-wide visual contract: when a rule is visible,
 * it fills the remaining heading row all the way to the right. Older saved CVs
 * may still contain the retired `short` value; render those as `full` instead
 * of leaking the historic 15/18 mm dash back into preview or PDF export.
 */
export function cvDesignWithFullSectionRules(design: CvDesign): CvDesign {
  if (design.headingRule === "none") return design;
  if (design.headingRule === "full") return design;
  return { ...design, headingRule: "full" };
}

function contactFromCv(data: CvData): DossierChromeContact {
  const person = data.person;
  return {
    name: [person.vorname, person.nachname].filter(Boolean).join(" "),
    address: person.adresse ?? "",
    place: person.plzOrt ?? "",
    phone: person.telefon ?? "",
    email: person.email ?? "",
  };
}

/** Pure snapshot adapter: no dossier-chrome store reads happen below the route/editor boundary. */
export function CvCanvas({
  chromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
  chromeContact,
  ...props
}: Props) {
  const bodyAlignment = useSyncExternalStore(
    subscribeCvTextAlignment,
    getCvTextAlignment,
    () => "left",
  );
  // Page margins are stored outside the legacy CV JSON. Subscribing here keeps
  // preview, pagination and hidden PDF canvases on one geometry path.
  useSyncExternalStore(subscribeDossierPageMargins, getDossierPageMarginsSnapshot, () => "{}");
  const localContact = useMemo(() => contactFromCv(props.data), [props.data]);
  const design = useMemo(() => cvDesignWithFullSectionRules(props.design), [props.design]);
  const resolvedChromeOptions = useMemo(
    () => resolveTemplateChromeOptions(design.template, design.colors, chromeOptions),
    [chromeOptions, design.colors, design.template],
  );
  const data = useMemo(
    () => cvBodyData(props.data, resolvedChromeOptions),
    [props.data, resolvedChromeOptions],
  );

  // Layout defaults are template-aware, but an explicit student choice remains
  // in localStorage. Update the active template before paint and notify the
  // external-store subscribers so Kolumne can start in Sidebar without writing
  // a permanent layout choice that would leak into the next template.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.dossierTemplate;
    root.dataset.dossierTemplate = design.template as string;
    window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));

    return () => {
      if (previous === undefined) delete root.dataset.dossierTemplate;
      else root.dataset.dossierTemplate = previous;
      window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));
    };
  }, [design.template]);

  const modernBox = cvContentBox(
    cvFrameFor(design.template),
    0,
    "modern",
    design.sidebarPct,
    resolvedChromeOptions,
  );
  const primary = design.colors.primary ?? design.colors.accent ?? design.colors.ink ?? "#111111";
  const secondary = design.colors.secondary ?? design.colors.accent ?? primary;
  const tertiary = design.colors.tertiary ?? design.colors.accent ?? secondary;
  const geometryStyle = {
    display: "contents",
    "--cv-modern-main-left": `${modernBox.left}mm`,
    "--cv-modern-main-right": `${modernBox.right}mm`,
    "--cover-primary": primary,
    "--cover-secondary": secondary,
    "--cover-tertiary": tertiary,
    "--cover-accent": design.colors.accent ?? secondary,
    "--cover-ink": design.colors.ink ?? "#111111",
    // The generic background-motif slider owns only decorative motif intensity.
    // Keep the value as a CSS variable so preview and hidden PDF canvases use
    // the same live value without changing structural sheet geometry.
    "--dossier-motif-opacity": String(Math.max(0, Math.min(1, design.bgOpacity))),
  } as CSSProperties;

  return (
    <div
      style={geometryStyle}
      data-cv-body-align={bodyAlignment}
      data-cv-heading-rule={design.headingRule}
      data-cv-user-heading-rule={props.design.headingRule === "full" ? "full" : undefined}
    >
      <BaseCvCanvas
        {...props}
        data={data}
        design={design}
        chromeOptions={resolvedChromeOptions}
        chromeContact={chromeContact ?? localContact}
      />
      {!props.exportMode ? (
        <CvTextAlignmentPortal
          template={design.template}
          sidebarPct={design.sidebarPct}
          chromeOptions={resolvedChromeOptions}
          accentColor={design.colors.accent ?? secondary}
        />
      ) : null}
    </div>
  );
}
