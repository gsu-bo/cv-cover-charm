import { cvBodyData } from "@/lib/dossier-body-contact";
import {
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
} from "react";
import { FONT_STACKS } from "@/components/cover/types";
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
import {
  resolveDossierChromeDocumentContent,
  withDossierChromeDocumentContent,
} from "@/lib/dossier-chrome-content";
import { CvTextAlignmentPortal } from "./CvTextAlignmentPortal";
import { getCvTextAlignment, subscribeCvTextAlignment } from "./text-alignment";
import { cvContentBox, cvFrameFor } from "./archetype";
import { CV_LAYOUT_EVENT } from "./layout";
import { CvCanvas as BaseCvCanvas } from "./CvCanvasBase";
import { resolveCvRubricOptions } from "./citrus-rubric";
import {
  CV_NAME_FONT_SIZE_MAX,
  CV_NAME_FONT_SIZE_MIN,
  type CvData,
  type CvDesign,
} from "./types";
import "@/components/dossier/edel-stationery.css";
import "@/components/dossier/human-polish.css";
import "@/components/dossier/legacy-template-refinements.css";
import "./full-section-rules.css";
import "./fresh-modern-sidebar-geometry.css";
import "./default-pagination-density.css";
import "./user-typography.css";
import "./citrus-rubric.css";
import "./content-geometry-contract.css";
import "./document-title-user-override.css";

export type { CvLayoutWarning } from "./CvCanvasBase";

type BaseProps = ComponentProps<typeof BaseCvCanvas>;
type Props = Omit<BaseProps, "chromeOptions" | "chromeContact" | "chromeDocumentContent"> & {
  chromeOptions?: DossierChromeOptions;
  chromeContact?: DossierChromeContact;
  /** Hidden multi-document renderers must not seize the live html template scope. */
  manageGlobalTemplateScope?: boolean;
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

/**
 * The CV editor is the live authority while it is on screen. Synced dossier
 * contact may fill a blank CV field, but it must never mask a newly typed value.
 */
export function resolveCvChromeContact(
  live: DossierChromeContact,
  fallback?: DossierChromeContact,
): DossierChromeContact {
  const pick = (key: keyof DossierChromeContact) => {
    const liveValue = live[key]?.trim();
    if (liveValue) return liveValue;
    return fallback?.[key]?.trim() ?? "";
  };

  return {
    name: pick("name"),
    address: pick("address"),
    place: pick("place"),
    phone: pick("phone"),
    email: pick("email"),
  };
}

/** Pure snapshot adapter: no dossier-chrome store reads happen below the route/editor boundary. */
export function CvCanvas({
  chromeOptions = DEFAULT_DOSSIER_CHROME_OPTIONS,
  chromeContact,
  manageGlobalTemplateScope = true,
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
  const resolvedContact = useMemo(
    () => resolveCvChromeContact(localContact, chromeContact),
    [chromeContact, localContact],
  );
  const design = useMemo(() => cvDesignWithFullSectionRules(props.design), [props.design]);
  const rubric = useMemo(() => resolveCvRubricOptions(design), [design]);
  const chromeDocumentContent = useMemo(
    () =>
      resolveDossierChromeDocumentContent(
        design.chromeContent,
        props.data.titel?.trim() || "Lebenslauf",
      ),
    [design.chromeContent, props.data.titel],
  );
  const resolvedChromeOptions = useMemo(
    () =>
      withDossierChromeDocumentContent(
        resolveTemplateChromeOptions(design.template, design.colors, chromeOptions),
        chromeDocumentContent,
      ),
    [chromeDocumentContent, chromeOptions, design.colors, design.template],
  );
  const canvasChromeOptions = useMemo<DossierChromeOptions>(() => {
    if (design.template !== "terracotta" || resolvedChromeOptions.headerMode !== "contact") {
      return resolvedChromeOptions;
    }
    // Kolumne intentionally hides the shared contact copy and presents these
    // fields in its sidebar. Keep the same contact-header geometry, but tell the
    // body de-duplication path that the hidden chrome does not own these fields.
    return {
      ...resolvedChromeOptions,
      headerShowAddress: false,
      headerShowPhone: false,
      headerShowEmail: false,
    };
  }, [design.template, resolvedChromeOptions]);
  const data = useMemo(
    () => cvBodyData(props.data, canvasChromeOptions),
    [canvasChromeOptions, props.data],
  );

  // The visible CV editor still owns the legacy html[data-dossier-template]
  // route scope. Hidden mixed-template PDF renderers opt out; their local
  // marker is mirrored into html only inside html2canvas' throw-away clone.
  useLayoutEffect(() => {
    if (!manageGlobalTemplateScope) return;
    const root = document.documentElement;
    const previous = root.dataset.dossierTemplate;
    root.dataset.dossierTemplate = design.template as string;
    window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));

    return () => {
      if (previous === undefined) delete root.dataset.dossierTemplate;
      else root.dataset.dossierTemplate = previous;
      window.dispatchEvent(new CustomEvent(CV_LAYOUT_EVENT));
    };
  }, [design.template, manageGlobalTemplateScope]);

  const frame = cvFrameFor(design.template);
  const classicBox = cvContentBox(frame, 0, "classic", design.sidebarPct, canvasChromeOptions);
  const modernBox = cvContentBox(frame, 0, "modern", design.sidebarPct, canvasChromeOptions);
  const primary = design.colors.primary ?? design.colors.accent ?? design.colors.ink ?? "#111111";
  const secondary = design.colors.secondary ?? design.colors.accent ?? primary;
  const tertiary = design.colors.tertiary ?? design.colors.accent ?? secondary;
  const nameStyle = props.data.person.nameStyle;
  const nameFontSizePt =
    typeof nameStyle?.fontSizePt === "number" && Number.isFinite(nameStyle.fontSizePt)
      ? Math.max(CV_NAME_FONT_SIZE_MIN, Math.min(CV_NAME_FONT_SIZE_MAX, nameStyle.fontSizePt))
      : undefined;
  const nameColor =
    typeof nameStyle?.color === "string" && /^#[0-9a-f]{6}$/i.test(nameStyle.color.trim())
      ? nameStyle.color.trim()
      : undefined;
  const geometryStyle = {
    display: "contents",
    "--cv-classic-main-left": `${classicBox.left}mm`,
    "--cv-classic-main-right": `${classicBox.right}mm`,
    "--cv-modern-main-left": `${modernBox.left}mm`,
    "--cv-modern-main-right": `${modernBox.right}mm`,
    "--cv-rubric-x": `${rubric.horizontalMm}mm`,
    "--cv-rubric-content-indent": `${rubric.contentIndentMm}mm`,
    "--cover-primary": primary,
    "--cover-secondary": secondary,
    "--cover-tertiary": tertiary,
    "--cover-accent": design.colors.accent ?? secondary,
    "--cover-ink": design.colors.ink ?? "#111111",
    "--cv-user-name-font": nameStyle?.font ? FONT_STACKS[nameStyle.font] : undefined,
    "--cv-user-name-size": nameFontSizePt ? `${nameFontSizePt}pt` : undefined,
    "--cv-user-name-color": nameColor,
    "--cv-user-name-weight":
      nameStyle?.bold === undefined ? undefined : nameStyle.bold ? "700" : "400",
    "--cv-user-name-style":
      nameStyle?.italic === undefined ? undefined : nameStyle.italic ? "italic" : "normal",
    "--cv-user-name-decoration":
      nameStyle?.underline === undefined ? undefined : nameStyle.underline ? "underline" : "none",
    // The generic background-motif slider owns only decorative motif intensity.
    // Keep the value as a CSS variable so preview and hidden PDF canvases use
    // the same live value without changing structural sheet geometry.
    "--dossier-motif-opacity": String(Math.max(0, Math.min(1, design.bgOpacity))),
  } as CSSProperties;

  return (
    <div
      style={geometryStyle}
      data-dossier-template={design.template}
      data-cv-body-align={bodyAlignment}
      data-cv-heading-rule={design.headingRule}
      data-cv-user-heading-rule={props.design.headingRule === "full" ? "full" : undefined}
      data-cv-user-name-font={nameStyle?.font ? "true" : undefined}
      data-cv-user-name-size={nameFontSizePt !== undefined ? "true" : undefined}
      data-cv-user-name-color={nameColor ? "true" : undefined}
      data-cv-user-name-weight={nameStyle?.bold === undefined ? undefined : "true"}
      data-cv-user-name-style={nameStyle?.italic === undefined ? undefined : "true"}
      data-cv-user-name-decoration={nameStyle?.underline === undefined ? undefined : "true"}
      data-cv-rubric-pill={rubric.pill ? "true" : "false"}
      data-cv-rubric-offset={rubric.horizontalOverride ? "custom" : undefined}
      data-cv-rubric-indent={rubric.contentIndentOverride ? "custom" : undefined}
      data-cv-rubric-x={rubric.horizontalMm}
      data-cv-rubric-content-indent={rubric.contentIndentMm}
      data-cv-citrus-pill={
        design.template === "citrus" ? (rubric.pill ? "true" : "false") : undefined
      }
      data-cv-citrus-rubric-x={design.template === "citrus" ? rubric.horizontalMm : undefined}
      data-cv-citrus-content-indent={
        design.template === "citrus" ? rubric.contentIndentMm : undefined
      }
    >
      <BaseCvCanvas
        {...props}
        data={data}
        design={design}
        chromeOptions={canvasChromeOptions}
        chromeContact={resolvedContact}
        chromeDocumentContent={chromeDocumentContent}
      />
      {!props.exportMode ? (
        <CvTextAlignmentPortal
          template={design.template}
          sidebarPct={design.sidebarPct}
          chromeOptions={canvasChromeOptions}
          accentColor={design.colors.accent ?? secondary}
        />
      ) : null}
    </div>
  );
}
