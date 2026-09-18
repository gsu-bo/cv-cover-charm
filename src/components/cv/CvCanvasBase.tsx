import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PAGE } from "@/default-config";
import { DossierHeaderFooterChrome } from "@/components/dossier/DossierHeaderFooterChrome";
import { DossierSheetBackground } from "@/components/dossier/DossierSheetBackground";
import { BlockLayer, type Point } from "@/components/cover/BlockLayer";
import { buildCustomBlocks, type StyleOverrides } from "@/components/cover/layouts";
import {
  FONT_STACKS,
  TEMPLATES,
  type BlockStyle,
  type CustomField,
} from "@/components/cover/types";
import {
  getCvInfoPosition,
  getCvLayout,
  getCvLayoutChoice,
  getCvLayoutMirror,
  subscribeCvLayout,
  subscribeCvLayoutChoice,
  type CvLayoutId,
} from "./layout";
import { getCvPlacements, subscribeCvPlacements } from "./placement";
import { alphaHex, cvVisualPolicy, sidebarPlan, smartNameSize } from "./intelligence";
import { onColorRoles, type CvOnColor } from "./palette";
import { normalizeCvPaperColor, resolveCvPalette } from "./cv-paper";
import {
  bandLeftMm,
  cvContentBox,
  cvFrameFor,
  cvSurface,
  FOOTER_MM,
  headTopMm,
  headerSitsInBand,
  pageMarker,
  sidebarWidthMm,
  type CvRenderLayout,
} from "./archetype";
import { dossierThemeFor } from "@/lib/dossier-theme";
import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import { cvBodyData } from "@/lib/dossier-body-contact";
import { dossierPhotoCropStyle, dossierPhotoRadius, dossierPhotoRatio } from "@/lib/dossier-photo";
import { getCvPhotoStyle, subscribeCvPhotoStyle } from "./photo";
import {
  DEFAULT_CV_PHOTO_PLACEMENT,
  getCvPhotoPlacement,
  normalizeCvPhotoPlacement,
  resolveCvPhotoPosition,
  setCvPhotoPlacement,
  subscribeCvPhotoPlacement,
} from "./photo-place";
import {
  CV_BLOCK_LABELS,
  CV_DOC_TITLE_DEFAULTS,
  CV_DOC_TITLE_FONT_SIZE_MAX,
  CV_DOC_TITLE_FONT_SIZE_MIN,
  CV_DOC_TITLE_MARGIN_BOTTOM_MAX,
  CV_SECTION_TITLE_FONT_SIZE_MAX,
  CV_SECTION_TITLE_FONT_SIZE_MIN,
  CV_SECTION_TITLE_MARGIN_BOTTOM_MAX,
  CV_TYPE_DEFAULTS,
  DEFAULT_CV_PLACEMENTS,
  customSectionForKey,
  cvSectionLayout,
  cvSectionOrder,
  entryFilled,
  hasCustomizedCvSectionLayout,
  isCustomSectionKey,
  type CvData,
  type CvDesign,
  type CvLayoutSectionKey,
  type CvPlacementKey,
  type CvSectionLayout,
  type CvSectionKey,
} from "./types";

/** Seitenrand in mm – derselbe wie auf dem Titelblatt (siehe `archetype.ts`). */
const MARGIN_X = 20;
/** Fotobreite im einspaltigen Kopf; die Höhe folgt der gewählten Rahmenform. */
const PHOTO_MAIN_MM = 30;
/** Umrechnung als Rückfall, falls die Messung nichts hergibt. */
const PX_PER_MM = 96 / 25.4;
/** Blattbreite in mm – Bezug, um Bildschirmpixel in Millimeter umzurechnen. */
const SHEET_W_MM = 210;
const SHEET_H_MM = 297;

type SectionResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type FreeSectionLiveBox = {
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
};

const SECTION_RESIZE_HANDLES: Array<{
  direction: SectionResizeDirection;
  left: string;
  top: string;
  cursor: string;
}> = [
  { direction: "nw", left: "0%", top: "0%", cursor: "nwse-resize" },
  { direction: "n", left: "50%", top: "0%", cursor: "ns-resize" },
  { direction: "ne", left: "100%", top: "0%", cursor: "nesw-resize" },
  { direction: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { direction: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { direction: "s", left: "50%", top: "100%", cursor: "ns-resize" },
  { direction: "sw", left: "0%", top: "100%", cursor: "nesw-resize" },
  { direction: "w", left: "0%", top: "50%", cursor: "ew-resize" },
];

const SECTION_RESIZE_DIRECTION_LABEL: Record<SectionResizeDirection, string> = {
  n: "oben",
  ne: "oben rechts",
  e: "rechts",
  se: "unten rechts",
  s: "unten",
  sw: "unten links",
  w: "links",
  nw: "oben links",
};

const SHEET_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

type Row = {
  id: string;
  node: React.ReactNode;
  heading?: boolean;
  /** Früheste Seite für bewusst zugewiesene Rubriken, null = normale Paginierung. */
  minPage?: 0 | 1;
};

export type CvLayoutWarning = {
  id: string;
  message: string;
};

type Props = {
  data: CvData;
  design: CvDesign;
  elements: CustomField[];
  chromeOptions: DossierChromeOptions;
  chromeContact: DossierChromeContact;
  exportMode?: boolean;
  /** Abweichungen vom Vorgabestil je Element – Position, Farbe, Grösse. */
  elementStyles?: StyleOverrides;
  /** Bedienung der Elemente. Fehlt sie, wird nur gezeichnet. */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** Ausgewählte frei platzierte Rubrik für Rahmen und Werkzeugleiste. */
  selectedSection?: CvLayoutSectionKey | null;
  onSelectSection?: (key: CvLayoutSectionKey | null) => void;
  onMoveElement?: (id: string, patch: Partial<BlockStyle>) => void;
  onSectionLayout?: (key: CvLayoutSectionKey, patch: Partial<CvSectionLayout>) => void;
  /** Hinweise aus der tatsächlich gerenderten Vorschau oder Exportansicht. */
  onLayoutWarnings?: (warnings: CvLayoutWarning[]) => void;
  onPageCount?: (count: number) => void;
  drawing?: boolean;
  onDrawn?: (points: Point[], page: 1 | 2) => void;
};

function label(data: CvData, key: CvPlacementKey): string {
  return data.labels[key]?.trim() || CV_BLOCK_LABELS[key];
}

export function CvCanvas({
  data,
  design,
  elements,
  chromeOptions,
  chromeContact,
  exportMode = false,
  elementStyles = {},
  selected = null,
  onSelect,
  selectedSection = null,
  onSelectSection,
  onMoveElement,
  onSectionLayout,
  onLayoutWarnings,
  onPageCount,
  drawing = false,
  onDrawn,
}: Props) {
  const pal = resolveCvPalette(design);
  const paperColorOverride = normalizeCvPaperColor(design.paperColor);
  // Die Bauform der Vorlage entscheidet über Flächen und Textbereich. Sie ist
  // der eigentliche Träger der Verwandtschaft zum Titelblatt.
  const frame = useMemo(() => cvFrameFor(design.template), [design.template]);
  // Die Auswahl im Aufbau-Picker gilt. Sie wurde früher bei Spalten- und
  // Karten-Vorlagen überschrieben, was wie ein toter Knopf wirkte.
  const layout = useSyncExternalStore<CvRenderLayout>(
    subscribeCvLayout,
    getCvLayout,
    () => "classic",
  );
  // Raw choice is separate from renderer mode. Classic/Luftig/Timeline/Magazin
  // share the same renderer but have different real content geometry.
  const layoutChoice = useSyncExternalStore<CvLayoutId>(
    subscribeCvLayoutChoice,
    getCvLayoutChoice,
    () => "classic",
  );
  const infoPosition = useSyncExternalStore(
    subscribeCvLayout,
    getCvInfoPosition,
    () => "standard" as const,
  );
  const placements = useSyncExternalStore(
    subscribeCvPlacements,
    getCvPlacements,
    () => DEFAULT_CV_PLACEMENTS,
  );
  const policy = useMemo(
    () => cvVisualPolicy(design.template, layout, design.bgOpacity),
    [design.template, design.bgOpacity, layout],
  );
  const sidePlan = useMemo(() => sidebarPlan(data), [data]);
  const orderedSectionKeys = useMemo(() => cvSectionOrder(data), [data]);
  const contentSectionKeys = orderedSectionKeys.filter((key) => key !== "person");
  const customSectionLayout = hasCustomizedCvSectionLayout(data);
  const personLayoutCustomized = (() => {
    const value = cvSectionLayout(data, "person");
    return (
      orderedSectionKeys[0] !== "person" ||
      value.page !== 1 ||
      value.width !== "full" ||
      value.positioning !== "flow"
    );
  })();
  const [freeHeights, setFreeHeights] = useState<Partial<Record<CvLayoutSectionKey, number>>>({});
  const [liveSectionBoxes, setLiveSectionBoxes] = useState<
    Partial<Record<CvLayoutSectionKey, FreeSectionLiveBox>>
  >({});
  const canvasRef = useRef<HTMLDivElement>(null);

  /** Vom Nutzer einstellbare Typografie und Spaltenbreite. */
  const headingRule = design.headingRule ?? CV_TYPE_DEFAULTS.headingRule;
  const titleScale = design.titleScale ?? CV_TYPE_DEFAULTS.titleScale;
  const headingScale = design.headingScale ?? CV_TYPE_DEFAULTS.headingScale;
  const bodyScale = design.bodyScale ?? CV_TYPE_DEFAULTS.bodyScale;
  const sidebarPct = design.sidebarPct ?? CV_TYPE_DEFAULTS.sidebarPct;
  /**
   * Drei Regler, drei Rollen – und jeder Text auf dem Blatt gehört zu einer:
   *
   *   ptTitle  Name und Dokumenttitel
   *   ptHead   Untertitel und Rubriken
   *   pt       alles andere
   *
   * Fest eingetragene Grade gab es früher in der Seitenspalte und bei den
   * Eintragstiteln; die Regler liessen sie unberührt und wirkten darum halb
   * kaputt. TYPE_BASE hebt alle Grundwerte an: das frühere "120 %" ist der
   * neue Normalzustand, die Regler stehen wieder auf 100 %.
   */
  const TYPE_BASE = 1.2;
  const pt = (size: number) => `${(size * TYPE_BASE * bodyScale).toFixed(2)}pt`;
  const ptHead = (size: number) => `${(size * TYPE_BASE * headingScale).toFixed(2)}pt`;

  /**
   * Schriftbild der Dossier-Familie. Titelblatt und Lebenslauf lesen dieselbe
   * Quelle, damit Editorials Serifen-Überschriften nicht wie Moderns
   * Versalien aussehen.
   */
  const theme = useMemo(() => dossierThemeFor(design.template), [design.template]);
  const headingStyle = theme.headingStyle;
  const sectionTitleFontSizePx =
    typeof design.sectionTitleFontSizePx === "number" &&
    Number.isFinite(design.sectionTitleFontSizePx)
      ? Math.max(
          CV_SECTION_TITLE_FONT_SIZE_MIN,
          Math.min(CV_SECTION_TITLE_FONT_SIZE_MAX, design.sectionTitleFontSizePx),
        )
      : null;
  const sectionTitleMarginBottomPx =
    typeof design.sectionTitleMarginBottomPx === "number" &&
    Number.isFinite(design.sectionTitleMarginBottomPx)
      ? Math.max(0, Math.min(CV_SECTION_TITLE_MARGIN_BOTTOM_MAX, design.sectionTitleMarginBottomPx))
      : null;
  const sectionTitleColor = design.sectionTitleColor?.trim();
  const sectionTitleWeight =
    design.sectionTitleBold === undefined
      ? headingStyle.weight
      : design.sectionTitleBold
        ? 700
        : 400;
  const sectionTitleFontStyle = design.sectionTitleItalic ? "italic" : "normal";
  const sectionTitleDecoration = design.sectionTitleUnderline ? "underline" : "none";

  /** Rahmenform des Fotos – dieselbe Einstellung wie im Titelblatt. */
  const photoStyle = useSyncExternalStore(subscribeCvPhotoStyle, getCvPhotoStyle, () =>
    getCvPhotoStyle(),
  );
  /** Platz auf dem Blatt, Grösse und Rahmen – nur für den Lebenslauf. */
  const place = useSyncExternalStore(
    subscribeCvPhotoPlacement,
    getCvPhotoPlacement,
    () => DEFAULT_CV_PHOTO_PLACEMENT,
  );
  /**
   * Während des Ziehens liegen die Werte hier, damit nicht bei jedem
   * Mausschritt in den Speicher geschrieben wird. Losgelassen wird übernommen.
   */
  const [liveBox, setLiveBox] = useState<{
    xMm: number;
    yMm: number;
    widthMm: number;
  } | null>(null);
  const photoBox = liveBox ?? { xMm: place.xMm, yMm: place.yMm, widthMm: place.widthMm };

  /** Farbe der tragenden Fläche – dieselbe, die das Titelblatt dort verwendet. */
  const areaColor = design.colors.primary || design.colors.accent || pal.accent;
  /**
   * Schrift **auf** der farbigen Fläche. Die Fläche wird nicht aufgehellt,
   * sondern bekommt eine Schrift, die darauf lesbar ist.
   */
  const onArea = useMemo(
    () => onColorRoles(areaColor, design.colors.accent),
    [areaColor, design.colors.accent],
  );
  /** Rollen für die Seitenspalte: auf Farbe bei "column", sonst auf Papier. */
  const side: CvOnColor =
    frame.id === "column"
      ? onArea
      : {
          bg: pal.paper,
          ink: pal.ink,
          muted: pal.muted,
          accent: pal.accent,
          hairline: pal.accent,
        };

  const slots = useMemo(
    () => TEMPLATES.find((t) => t.id === design.template)?.slots ?? [],
    [design.template],
  );

  const p = cvBodyData(data, chromeOptions).person;
  const name = [p.vorname, p.nachname].filter(Boolean).join(" ");
  const adresse = [p.adresse, p.plzOrt].filter(Boolean).join(" · ");
  const kontakt = [p.telefon, p.email].filter(Boolean).join(" · ");
  const kontaktZeilen = [adresse, kontakt].filter(Boolean);
  const angaben = [
    p.geburtsdatum && `Geburtsdatum ${p.geburtsdatum}`,
    p.nationalitaet && `Nationalität ${p.nationalitaet}`,
  ].filter(Boolean) as string[];
  const nameSize = smartNameSize(name, layout) * TYPE_BASE * titleScale;
  const photoPosition = resolveCvPhotoPosition(place, {
    template: design.template,
    layout,
    legacyMirrored: getCvLayoutMirror(),
  });
  const infoMirrored = infoPosition === "mirrored";
  const sidebarPhysicalSide = infoMirrored ? "right" : "left";

  /**
   * Es gibt genau ein logisches Foto. Links/Rechts verwenden einen automatischen
   * Slot, frei verwendet ausschliesslich den vorhandenen freien Renderer.
   */
  const autoPhoto = !!p.foto && photoPosition !== "free";
  const freePhotoOn = !!p.foto && photoPosition === "free";
  const automaticPhotoInSidebar =
    autoPhoto &&
    layout === "modern" &&
    !personLayoutCustomized &&
    photoPosition === sidebarPhysicalSide;
  const automaticPhotoInMain =
    autoPhoto &&
    layout === "modern" &&
    !personLayoutCustomized &&
    photoPosition !== sidebarPhysicalSide;
  /*
   * Der Rahmen selbst steht in `layout-options.css`: Stärke und Farbe kommen
   * dort als CSS-Variablen an und tragen `!important`. Ein Inline-Ring hier
   * käme nie zum Zug, darum steht keiner mehr im Renderer.
   */

  /**
   * Foto mit der Maus verschieben und an der Ecke grösser ziehen.
   *
   * Die Vorschau ist gezoomt, darum wird nicht mit einem festen Faktor
   * gerechnet: die gemessene Blattbreite auf dem Bildschirm entspricht 210 mm,
   * daraus ergibt sich der Umrechnungsfaktor für diese Geste.
   */
  const startPhotoGesture = (kind: "move" | "size") => (event: React.PointerEvent<HTMLElement>) => {
    if (exportMode || event.button !== 0) return;
    const pageEl = event.currentTarget.closest("[data-cv-page]") as HTMLElement | null;
    if (!pageEl) return;
    const sheetPx = pageEl.getBoundingClientRect().width;
    if (!sheetPx) return;
    event.preventDefault();
    event.stopPropagation();

    const mmPerPx = SHEET_W_MM / sheetPx;
    const startX = event.clientX;
    const startY = event.clientY;
    const from = { xMm: place.xMm, yMm: place.yMm, widthMm: place.widthMm };
    let latest = from;

    const step = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * mmPerPx;
      const dy = (moveEvent.clientY - startY) * mmPerPx;
      const next = normalizeCvPhotoPlacement(
        kind === "move"
          ? { ...place, xMm: from.xMm + dx, yMm: from.yMm + dy }
          : { ...place, widthMm: from.widthMm + dx },
      );
      latest = { xMm: next.xMm, yMm: next.yMm, widthMm: next.widthMm };
      setLiveBox(latest);
    };
    const stop = () => {
      window.removeEventListener("pointermove", step);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      setLiveBox(null);
      setCvPhotoPlacement(latest);
    };

    window.addEventListener("pointermove", step);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  /** Pfeiltasten für das letzte Millimeterchen; mit Shift feiner. */
  const nudgePhoto = (event: React.KeyboardEvent<HTMLElement>) => {
    const stepMm = event.shiftKey ? 0.5 : 2;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-stepMm, 0],
      ArrowRight: [stepMm, 0],
      ArrowUp: [0, -stepMm],
      ArrowDown: [0, stepMm],
    };
    const delta = by[event.key];
    if (!delta) return;
    event.preventDefault();
    setCvPhotoPlacement({ xMm: place.xMm + delta[0], yMm: place.yMm + delta[1] });
  };

  const headingText = (id: string, text: string): Row => ({
    id: `h-${id}`,
    heading: true,
    node: (
      <div
        data-cv-section={id}
        data-cv-user-section-margin={sectionTitleMarginBottomPx === null ? undefined : "true"}
        style={{
          ["--cv-user-section-margin-bottom" as string]:
            sectionTitleMarginBottomPx === null ? undefined : `${sectionTitleMarginBottomPx}px`,
          marginTop: layout === "modern" ? "4.8mm" : "4mm",
          marginBottom:
            sectionTitleMarginBottomPx === null
              ? layout === "modern"
                ? "2mm"
                : "1.8mm"
              : `${sectionTitleMarginBottomPx}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "3mm" }}>
          <div
            data-cv-section-title
            data-cv-user-section-size={sectionTitleFontSizePx === null ? undefined : "true"}
            data-cv-user-section-color={sectionTitleColor ? "true" : undefined}
            data-cv-user-section-weight={design.sectionTitleBold === undefined ? undefined : "true"}
            data-cv-user-section-style={
              design.sectionTitleItalic === undefined ? undefined : "true"
            }
            data-cv-user-section-decoration={
              design.sectionTitleUnderline === undefined ? undefined : "true"
            }
            style={{
              ["--cv-user-section-font-size" as string]:
                sectionTitleFontSizePx === null ? undefined : `${sectionTitleFontSizePx}px`,
              ["--cv-user-section-color" as string]: sectionTitleColor || undefined,
              ["--cv-user-section-weight" as string]: `${sectionTitleWeight}`,
              ["--cv-user-section-style" as string]: sectionTitleFontStyle,
              ["--cv-user-section-decoration" as string]: sectionTitleDecoration,
              // Versalien laufen breiter als Gemischtschrift; darum je nach
              // Familie ein anderer Grundwert.
              fontSize:
                sectionTitleFontSizePx === null
                  ? ptHead(headingStyle.uppercase ? 10.2 : 11.4)
                  : `${sectionTitleFontSizePx}px`,
              fontWeight: sectionTitleWeight,
              fontStyle: sectionTitleFontStyle,
              textDecoration: sectionTitleDecoration,
              letterSpacing: `${headingStyle.trackingEm}em`,
              textTransform: headingStyle.uppercase ? "uppercase" : "none",
              fontFamily: theme.typography.fontStack,
              color: sectionTitleColor || pal.accent,
              lineHeight: headingStyle.lineHeight,
            }}
          >
            {text}
          </div>
          {headingRule !== "none" && (
            <div
              data-cv-accent="section"
              data-cv-user-section-color={sectionTitleColor ? "true" : undefined}
              style={{
                ["--cv-user-section-color" as string]: sectionTitleColor || undefined,
                width: headingRule === "full" ? "auto" : layout === "modern" ? "15mm" : "18mm",
                flex: headingRule === "full" ? "1 1 auto" : undefined,
                height: layout === "modern" ? "0.65mm" : "0.55mm",
                flexShrink: headingRule === "full" ? 1 : 0,
                borderRadius: "999px",
                background: sectionTitleColor || pal.accent,
                opacity: layout === "modern" ? 0.9 : 0.72,
              }}
            />
          )}
        </div>
      </div>
    ),
  });

  const sectionTitle = (key: CvLayoutSectionKey): string => {
    if (key === "person") return "Persönliche Angaben";
    const custom = customSectionForKey(data, key);
    return custom?.title.trim() || (isCustomSectionKey(key) ? "Eigene Rubrik" : label(data, key));
  };

  const heading = (key: CvLayoutSectionKey): Row => headingText(key, sectionTitle(key));

  /**
   * Titel des Dokuments – auf jeder Vorlage, im Formular änderbar, leer
   * ausblendbar. Er nimmt den Ton der Familie auf, wie der Kicker auf dem
   * Titelblatt.
   */
  const docTitle = (color: string) => {
    const text = data.titel?.trim();
    if (!text) return null;
    const fontSizePx = Math.max(
      CV_DOC_TITLE_FONT_SIZE_MIN,
      Math.min(
        CV_DOC_TITLE_FONT_SIZE_MAX,
        design.docTitleFontSizePx ?? CV_DOC_TITLE_DEFAULTS.fontSizePx,
      ),
    );
    const marginBottomPx = Math.max(
      0,
      Math.min(
        CV_DOC_TITLE_MARGIN_BOTTOM_MAX,
        design.docTitleMarginBottomPx ?? CV_DOC_TITLE_DEFAULTS.marginBottomPx,
      ),
    );
    const customColor = design.docTitleColor?.trim();
    return (
      <div
        data-cv-doc-title
        data-cv-user-doc-size={
          typeof design.docTitleFontSizePx === "number" &&
          Number.isFinite(design.docTitleFontSizePx)
            ? "true"
            : undefined
        }
        data-cv-user-doc-color={customColor ? "true" : undefined}
        data-cv-user-doc-weight={design.docTitleBold === undefined ? undefined : "true"}
        data-cv-user-doc-style={design.docTitleItalic === undefined ? undefined : "true"}
        data-cv-user-doc-decoration={design.docTitleUnderline === undefined ? undefined : "true"}
        data-cv-user-doc-margin={
          typeof design.docTitleMarginBottomPx === "number" &&
          Number.isFinite(design.docTitleMarginBottomPx)
            ? "true"
            : undefined
        }
        style={{
          ["--cv-user-doc-font-size" as string]: `${fontSizePx}px`,
          ["--cv-user-doc-color" as string]: customColor || undefined,
          ["--cv-user-doc-weight" as string]: `${(design.docTitleBold ?? CV_DOC_TITLE_DEFAULTS.bold) ? 700 : 400}`,
          ["--cv-user-doc-style" as string]:
            (design.docTitleItalic ?? CV_DOC_TITLE_DEFAULTS.italic) ? "italic" : "normal",
          ["--cv-user-doc-decoration" as string]:
            (design.docTitleUnderline ?? CV_DOC_TITLE_DEFAULTS.underline) ? "underline" : "none",
          ["--cv-user-doc-margin-bottom" as string]: `${marginBottomPx}px`,
          fontSize: `${fontSizePx}px`,
          fontWeight: (design.docTitleBold ?? CV_DOC_TITLE_DEFAULTS.bold) ? 700 : 400,
          fontStyle: (design.docTitleItalic ?? CV_DOC_TITLE_DEFAULTS.italic) ? "italic" : "normal",
          textDecoration:
            (design.docTitleUnderline ?? CV_DOC_TITLE_DEFAULTS.underline) ? "underline" : "none",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontFamily: theme.typography.fontStack,
          color: customColor || color,
          opacity: customColor ? 1 : 0.85,
          marginBottom: `${marginBottomPx}px`,
        }}
      >
        {text}
      </div>
    );
  };

  const entryRow = (id: string, zeit: string, titel: string, ort: string, text: string): Row => ({
    id,
    node: (
      <div
        data-cv-entry
        style={{
          display: "flex",
          gap: layout === "modern" ? "4mm" : "5mm",
          marginBottom: "2.4mm",
        }}
      >
        <div
          data-cv-date
          data-cv-rail
          data-cv-muted
          style={{
            width: layout === "modern" ? "23mm" : "27mm",
            flexShrink: 0,
            fontSize: pt(9.3),
            color: pal.muted,
            paddingTop: "0.45mm",
            lineHeight: 1.35,
          }}
        >
          {zeit}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {titel && (
            <div
              data-cv-entry-title
              style={{
                fontSize: pt(layout === "modern" ? 11.4 : 11.5),
                fontWeight: 700,
                color: pal.ink,
                lineHeight: 1.2,
                overflowWrap: "anywhere",
              }}
            >
              {titel}
            </div>
          )}
          {ort && (
            <div
              data-cv-muted
              style={{
                fontSize: pt(9.7),
                color: pal.muted,
                marginTop: "0.35mm",
                lineHeight: 1.3,
              }}
            >
              {ort}
            </div>
          )}
          {text && (
            <div
              data-cv-body
              style={{
                fontSize: pt(9.9),
                color: pal.ink,
                marginTop: "0.75mm",
                lineHeight: 1.35,
              }}
            >
              {text}
            </div>
          )}
        </div>
      </div>
    ),
  });

  const referenceRows = (): Row[] => {
    const list = data.referenzen.filter(
      (r) => r.name.trim() || r.funktion.trim() || r.kontakt.trim(),
    );
    if (!list.length || data.hidden.referenzen) return [];
    return [
      heading("referenzen"),
      ...list.map(
        (r): Row => ({
          id: r.id,
          node: (
            <div data-cv-entry style={{ marginBottom: "2.1mm" }}>
              {r.name && (
                <div
                  data-cv-entry-title
                  style={{ fontSize: pt(10.8), fontWeight: 700, color: pal.ink, lineHeight: 1.25 }}
                >
                  {r.name}
                </div>
              )}
              {r.funktion && (
                <div
                  data-cv-muted
                  style={{
                    fontSize: pt(9.7),
                    color: pal.muted,
                    marginTop: "0.3mm",
                    lineHeight: 1.3,
                  }}
                >
                  {r.funktion}
                </div>
              )}
              {r.kontakt && (
                <div
                  data-cv-body
                  style={{
                    fontSize: pt(9.7),
                    color: pal.ink,
                    marginTop: "0.35mm",
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                  }}
                >
                  {r.kontakt}
                </div>
              )}
            </div>
          ),
        }),
      ),
    ];
  };

  const languageRows = (): Row[] => {
    const list = data.sprachen.filter((s) => s.name.trim() || s.niveau.trim());
    if (!list.length || data.hidden.sprachen) return [];
    return [
      heading("sprachen"),
      ...list.map(
        (s): Row => ({
          id: `main-${s.id}`,
          node: (
            <div data-cv-entry style={{ display: "flex", gap: "5mm", marginBottom: "1.5mm" }}>
              <div
                data-cv-rail
                data-cv-entry-title
                style={{
                  width: layout === "modern" ? "23mm" : "27mm",
                  flexShrink: 0,
                  fontSize: pt(10.2),
                  fontWeight: 650,
                  color: pal.ink,
                  lineHeight: 1.3,
                }}
              >
                {s.name}
              </div>
              <div
                data-cv-muted
                style={{ flex: 1, fontSize: pt(9.8), color: pal.muted, lineHeight: 1.3 }}
              >
                {s.niveau}
              </div>
            </div>
          ),
        }),
      ),
    ];
  };

  const simpleListRows = (key: "staerken" | "hobbys"): Row[] => {
    if (data.hidden[key]) return [];
    const list = data[key].filter((v) => v.trim());
    if (!list.length) return [];
    return [
      heading(key),
      ...list.map(
        (v, i): Row => ({
          id: `main-${key}-${i}`,
          node: (
            <div
              data-cv-entry
              data-cv-body
              style={{
                display: "flex",
                gap: "2.6mm",
                marginBottom: "1.35mm",
                fontSize: pt(9.9),
                lineHeight: 1.35,
                color: pal.ink,
              }}
            >
              <span style={{ color: pal.accent, fontWeight: 700 }}>•</span>
              <span>{v}</span>
            </div>
          ),
        }),
      ),
    ];
  };

  const contactMainRows = (): Row[] => {
    if (!kontaktZeilen.length && !angaben.length) return [];
    return [
      headingText("kontakt", label(data, "kontakt")),
      {
        id: "kontakt-main",
        node: (
          <div
            data-cv-entry
            data-cv-body
            style={{ marginBottom: "2.2mm", fontSize: pt(9.8), lineHeight: 1.4, color: pal.ink }}
          >
            {kontaktZeilen.map((line) => (
              <div key={line} style={{ overflowWrap: "anywhere" }}>
                {line}
              </div>
            ))}
            {angaben.length > 0 && (
              <div data-cv-muted style={{ marginTop: "1mm", color: pal.muted }}>
                {angaben.join(" · ")}
              </div>
            )}
          </div>
        ),
      },
    ];
  };

  /** Inhalt einer Rubrik als unteilbarer Block für Grid und freie Platzierung. */
  const sectionRows = (key: CvLayoutSectionKey): Row[] => {
    if (key === "person") return [];
    const custom = customSectionForKey(data, key);
    if (custom) {
      const entries = custom.entries.filter(entryFilled);
      if (!entries.length) return [];
      return [
        heading(key),
        ...entries.map((entry) =>
          entryRow(`${key}-${entry.id}`, entry.zeit, entry.titel, entry.ort, entry.beschreibung),
        ),
      ];
    }
    if (isCustomSectionKey(key) || data.hidden[key]) return [];
    if (key === "schule" || key === "erfahrung") {
      const list = data[key].filter(entryFilled);
      if (!list.length) return [];
      return [
        heading(key),
        ...list.map((entry) =>
          entryRow(entry.id, entry.zeit, entry.titel, entry.ort, entry.beschreibung),
        ),
      ];
    }
    if (key === "sprachen") return languageRows();
    if (key === "hobbys" || key === "staerken") return simpleListRows(key);
    return referenceRows();
  };

  /**
   * Wird nur benutzt, wenn die persönlichen Angaben selbst ein abweichendes
   * Layout erhalten. So bleibt der historische Kopf aller Vorlagen ohne
   * Layoutänderung pixelgleich.
   */
  const personalSectionRows = (): Row[] => [
    {
      id: "person-layout",
      node: (
        <div
          data-cv-header
          style={{
            display: "flex",
            flexDirection: photoPosition === "right" ? "row-reverse" : "row",
            gap: "7mm",
            alignItems: "flex-start",
            marginBottom: "3.2mm",
          }}
        >
          {autoPhoto && (
            <div
              data-cv-photo
              style={{
                position: "relative",
                width: `${PHOTO_MAIN_MM}mm`,
                height: `${PHOTO_MAIN_MM * dossierPhotoRatio(photoStyle.shape)}mm`,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: dossierPhotoRadius(photoStyle.shape),
              }}
            >
              <img src={p.foto ?? undefined} alt="" style={dossierPhotoCropStyle(photoStyle)} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {docTitle(pal.muted)}
            <div
              data-cv-name
              style={{
                fontSize: `${nameSize}pt`,
                fontWeight: 750,
                color: pal.ink,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                overflowWrap: "anywhere",
              }}
            >
              {name || "Dein Name"}
            </div>
            {p.untertitel && (
              <div
                data-cv-subtitle
                style={{
                  fontSize: ptHead(11.2),
                  fontWeight: 600,
                  color: pal.accent,
                  marginTop: "1.15mm",
                  lineHeight: 1.25,
                }}
              >
                {p.untertitel}
              </div>
            )}
            {kontaktZeilen.length > 0 && (
              <div
                data-cv-body
                style={{ marginTop: "2.5mm", fontSize: pt(9.7), color: pal.ink, lineHeight: 1.38 }}
              >
                {kontaktZeilen.map((line) => (
                  <div key={line} style={{ overflowWrap: "anywhere" }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
            {angaben.length > 0 && (
              <div
                data-cv-muted
                data-cv-personal-info
                style={{
                  marginTop: "1.35mm",
                  fontSize: pt(9.2),
                  color: pal.muted,
                  lineHeight: 1.35,
                  textAlign: infoMirrored ? "right" : "left",
                }}
              >
                {angaben.join(" · ")}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  type SectionUnit = {
    key: CvLayoutSectionKey;
    width: "full" | "half";
    minPage: 0 | 1;
    rows: Row[];
  };

  const sectionNode = (unit: SectionUnit) => (
    <div
      data-cv-rubric={unit.key}
      data-cv-section-width={unit.width}
      style={{ minWidth: 0, overflowWrap: "anywhere" }}
    >
      {unit.rows.map((row) => (
        <div key={row.id} style={{ display: "flow-root" }}>
          {row.node}
        </div>
      ))}
    </div>
  );

  /** CSS Grid-Regeln als echte Zeilen packen – ohne absolute Positionierung. */
  const packSectionUnits = (units: SectionUnit[]): Row[] => {
    const packed: Row[] = [];
    let waiting: SectionUnit | null = null;
    const add = (items: SectionUnit[]) => {
      const id = `layout-${items.map((item) => item.key).join("-")}`;
      packed.push({
        id,
        minPage: items[0].minPage,
        node: (
          <div
            data-cv-section-row
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: "6mm",
              alignItems: "start",
            }}
          >
            {items.map((item) => (
              <div
                key={item.key}
                style={{ gridColumn: item.width === "full" ? "1 / -1" : "span 1", minWidth: 0 }}
              >
                {sectionNode(item)}
              </div>
            ))}
          </div>
        ),
      });
    };

    for (const unit of units) {
      if (unit.width === "full") {
        if (waiting) add([waiting]);
        waiting = null;
        add([unit]);
      } else if (waiting) {
        add([waiting, unit]);
        waiting = null;
      } else {
        waiting = unit;
      }
    }
    if (waiting) add([waiting]);
    return packed;
  };

  let rows: Row[] = [];
  // Trägt ein Kopfband den Namen, gehört er nicht in den Textfluss – sonst
  // stünde er zweimal auf der Seite.
  const nameInBand = headerSitsInBand(frame);

  if (layout === "classic") {
    /**
     * Kopfblock: Foto, Name und die Angaben zur Person.
     *
     * Trägt ein Kopfband bereits Name und Zeile darunter, werden nur diese
     * beiden weggelassen – Foto und Angaben bleiben, sonst fielen sie
     * ersatzlos weg.
     */
    const classicHeader = (withName: boolean): Row => ({
      id: "kopf",
      node: (
        <div
          data-cv-header
          style={{
            display: "flex",
            flexDirection: photoPosition === "right" ? "row-reverse" : "row",
            gap: "7mm",
            alignItems: "flex-start",
            marginBottom: "3.2mm",
          }}
        >
          {autoPhoto && (
            <div
              data-cv-photo
              style={{
                position: "relative",
                width: `${PHOTO_MAIN_MM}mm`,
                height: `${PHOTO_MAIN_MM * dossierPhotoRatio(photoStyle.shape)}mm`,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: dossierPhotoRadius(photoStyle.shape),
              }}
            >
              <img src={p.foto ?? undefined} alt="" style={dossierPhotoCropStyle(photoStyle)} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {withName && docTitle(pal.muted)}
            {withName && (
              <div
                data-cv-name
                style={{
                  fontSize: `${nameSize}pt`,
                  fontWeight: 750,
                  color: pal.ink,
                  lineHeight: 1.02,
                  letterSpacing: "-0.02em",
                  overflowWrap: "anywhere",
                }}
              >
                {name || "Dein Name"}
              </div>
            )}
            {withName && p.untertitel && (
              <div
                data-cv-subtitle
                style={{
                  fontSize: ptHead(11.2),
                  fontWeight: 600,
                  color: pal.accent,
                  marginTop: "1.15mm",
                  lineHeight: 1.25,
                }}
              >
                {p.untertitel}
              </div>
            )}
            {kontaktZeilen.length > 0 && (
              <div
                data-cv-body
                style={{
                  marginTop: withName ? "2.5mm" : 0,
                  fontSize: pt(9.7),
                  color: pal.ink,
                  lineHeight: 1.38,
                }}
              >
                {kontaktZeilen.map((k) => (
                  <div key={k} style={{ overflowWrap: "anywhere" }}>
                    {k}
                  </div>
                ))}
              </div>
            )}
            {angaben.length > 0 && (
              <div
                data-cv-muted
                data-cv-personal-info
                style={{
                  marginTop: "1.35mm",
                  fontSize: pt(9.2),
                  color: pal.muted,
                  lineHeight: 1.35,
                  textAlign: infoMirrored ? "right" : "left",
                }}
              >
                {angaben.join(" · ")}
              </div>
            )}
          </div>
        </div>
      ),
    });
    // Nur Name und Zeile darunter wandern ins Band; Foto und Angaben bleiben
    // im Kopfblock.
    const hasHeaderContent = autoPhoto || kontaktZeilen.length > 0 || angaben.length > 0;
    if (!nameInBand || hasHeaderContent) rows.push(classicHeader(!nameInBand));

    for (const key of contentSectionKeys) rows.push(...sectionRows(key));
  } else {
    const modernHeader: Row = {
      id: "kopf-modern",
      node: (
        <div
          data-cv-header
          style={{
            marginBottom: "4.8mm",
            display: automaticPhotoInMain ? "flex" : undefined,
            flexDirection: automaticPhotoInMain && photoPosition === "left" ? "row-reverse" : "row",
            gap: automaticPhotoInMain ? "7mm" : undefined,
            alignItems: automaticPhotoInMain ? "flex-start" : undefined,
          }}
        >
          {!nameInBand && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {docTitle(pal.muted)}
              <div
                data-cv-name
                style={{
                  fontSize: `${nameSize}pt`,
                  fontWeight: 760,
                  color: pal.ink,
                  lineHeight: 1,
                  letterSpacing: "-0.025em",
                  overflowWrap: "anywhere",
                }}
              >
                {name || "Dein Name"}
              </div>
              {p.untertitel && (
                <div
                  data-cv-subtitle
                  style={{
                    marginTop: "1.4mm",
                    fontSize: ptHead(11.5),
                    fontWeight: 600,
                    color: pal.accent,
                    lineHeight: 1.25,
                  }}
                >
                  {p.untertitel}
                </div>
              )}
              <div
                data-cv-accent="header"
                style={{
                  width: "24mm",
                  height: "0.85mm",
                  marginTop: "3.2mm",
                  borderRadius: "999px",
                  background: pal.accent,
                }}
              />
            </div>
          )}
          {automaticPhotoInMain && (
            <div
              data-cv-photo
              data-cv-photo-auto-main
              style={{
                position: "relative",
                width: `${PHOTO_MAIN_MM}mm`,
                height: `${PHOTO_MAIN_MM * dossierPhotoRatio(photoStyle.shape)}mm`,
                flexShrink: 0,
                overflow: "hidden",
                borderRadius: dossierPhotoRadius(photoStyle.shape),
                marginLeft: nameInBand && photoPosition === "right" ? "auto" : undefined,
                marginRight: nameInBand && photoPosition === "left" ? "auto" : undefined,
              }}
            >
              <img src={p.foto ?? undefined} alt="" style={dossierPhotoCropStyle(photoStyle)} />
            </div>
          )}
        </div>
      ),
    };
    if (!nameInBand || automaticPhotoInMain) rows.push(modernHeader);

    if (placements.kontakt === "main") rows.push(...contactMainRows());

    for (const key of contentSectionKeys) {
      if (!isCustomSectionKey(key) && placements[key] !== "main") continue;
      rows.push(...sectionRows(key));
    }
  }

  if (customSectionLayout) {
    const preservedHeaderRows = personLayoutCustomized
      ? []
      : rows
          .filter((row) => ["kopf", "kopf-modern", "h-kontakt", "kontakt-main"].includes(row.id))
          .map((row) => ({ ...row, minPage: 0 as const }));

    const units: SectionUnit[] = [];
    for (const key of orderedSectionKeys) {
      if (key === "person") {
        if (!personLayoutCustomized) continue;
        const personLayout = cvSectionLayout(data, "person");
        if (personLayout.positioning === "flow") {
          units.push({
            key: "person",
            width: personLayout.width,
            minPage: (personLayout.page - 1) as 0 | 1,
            rows: personalSectionRows(),
          });
        }
        continue;
      }
      const sectionLayout = cvSectionLayout(data, key);
      const content = sectionRows(key);
      if (!content.length || sectionLayout.positioning !== "flow") continue;
      if (layout === "modern" && !isCustomSectionKey(key) && placements[key] !== "main") continue;
      units.push({
        key,
        width: sectionLayout.width,
        minPage: (sectionLayout.page - 1) as 0 | 1,
        rows: content,
      });
    }

    rows = [
      ...preservedHeaderRows,
      ...packSectionUnits(units.filter((unit) => unit.minPage === 0)),
      ...packSectionUnits(units.filter((unit) => unit.minPage === 1)),
    ];
  }

  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Row[][]>([rows]);
  useLayoutEffect(() => {
    onPageCount?.(pages.length);
  }, [onPageCount, pages.length]);

  const placementShape = Object.entries(placements)
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
  const sectionLayoutShape = orderedSectionKeys
    .map((key) => {
      const value = cvSectionLayout(data, key);
      return `${key}:${value.page}:${value.width}:${value.positioning}:${value.x}:${value.y}:${value.widthMm}:${value.heightMm}`;
    })
    .join("|");
  const chromeShape = `${chromeOptions.headerMode}|${chromeOptions.footerMode}|${chromeOptions.headerShowName ? 1 : 0}|${chromeOptions.headerShowAddress ? 1 : 0}|${chromeOptions.headerShowPhone ? 1 : 0}|${chromeOptions.headerShowEmail ? 1 : 0}`;
  const shape = `${chromeShape}|photo:${photoPosition}|info:${infoPosition}|${layoutChoice}|${layout}|${frame.id}|${design.font ?? "template"}|${placementShape}|${sectionLayoutShape}|${rows
    .map((row) => `${row.id}:${row.minPage ?? "auto"}`)
    .join("|")}`;

  useLayoutEffect(() => {
    const root = canvasRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-cv-free-section]"));
    if (!blocks.length) {
      setFreeHeights((current) => (Object.keys(current).length ? {} : current));
      return;
    }

    const measure = () => {
      const next: Partial<Record<CvLayoutSectionKey, number>> = {};
      for (const block of blocks) {
        const key = block.dataset.cvFreeSection as CvLayoutSectionKey | undefined;
        const page = block.closest<HTMLElement>("[data-cv-page]");
        if (!key || !page) continue;
        const pageWidth = page.getBoundingClientRect().width;
        if (!pageWidth) continue;
        next[key] = (block.getBoundingClientRect().height / pageWidth) * SHEET_W_MM;
      }
      setFreeHeights((current) => {
        const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
        for (const key of keys) {
          if (
            Math.abs(
              (current[key as CvLayoutSectionKey] ?? 0) - (next[key as CvLayoutSectionKey] ?? 0),
            ) > 0.2
          ) {
            return next;
          }
        }
        return current;
      });
    };

    const observer = new ResizeObserver(measure);
    blocks.forEach((block) => observer.observe(block));
    measure();
    return () => observer.disconnect();
  }, [shape, pages.length]);

  /**
   * Der Messkasten steckt in der verkleinerten Vorschau. Wird er gemessen,
   * bevor die Verkleinerung steht, kommen zu kleine Zeilenhöhen heraus – und
   * weil sich am Inhalt nichts geändert hat, wird nie neu gerechnet. Der Text
   * lief dann unten aus der Seite, ohne dass eine zweite entstand.
   *
   * Diese Beobachtung stösst die Rechnung an, sobald sich die tatsächliche
   * Grösse ändert; nebenbei stimmt die Seitenzahl damit auch nach einem
   * Zoomwechsel.
   */
  const [measuredAt, setMeasuredAt] = useState(0);
  const lastTotal = useRef(-1);
  useLayoutEffect(() => {
    const box = measureRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;

    const total = () =>
      Array.from(box.children).reduce(
        (sum, child) => sum + (child as HTMLElement).getBoundingClientRect().height,
        0,
      );

    // Nur bei einer echten Änderung neu rechnen, sonst löst schon das
    // Anmelden der Beobachtung die nächste Runde aus.
    const check = () => {
      const now = total();
      if (Math.abs(now - lastTotal.current) < 0.5) return;
      lastTotal.current = now;
      setMeasuredAt((n) => n + 1);
    };

    // Die Zeilen selbst beobachten, nicht nur ihren Kasten: dessen Höhe steht
    // durch die Seitenränder fest und ändert sich nie, auch wenn der Text
    // höher wird. Genau dann fehlte die zweite Seite.
    const observer = new ResizeObserver(check);
    observer.observe(box);
    for (const child of Array.from(box.children)) observer.observe(child);
    // Mit der endgültigen Schrift fällt der Text anders um als mit der Ersatzschrift.
    document.fonts?.ready.then(check).catch(() => {});
    return () => observer.disconnect();
  }, [shape]);

  useLayoutEffect(() => {
    const box = measureRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const scale = rect.width / (box.offsetWidth || 1) || 1;
    const measured = rect.height / scale;

    /*
     * Höhe je Seite.
     *
     * Gerechnet wird von der **gemessenen** Höhe aus, nicht aus den Rändern
     * der Bauform: Die Aufbau-Stile setzen eigene Ränder mit `!important`, und
     * eine Rechnung, die davon nichts weiss, kommt auf eine falsche Seitenhöhe
     * – bei "Luftig" fiel damit die letzte Zeile unter den Rand.
     *
     * Der Messkasten zeigt also, was Seite 1 wirklich hergibt. Die Folgeseiten
     * unterscheiden sich davon nur um das, was die Bauform selbst pro Seite
     * ändert: das kürzere Kopfband und die Fusszeile.
     */
    const first = cvContentBox(frame, 0, layout, sidebarPct, chromeOptions);
    const paginationSafetyPx = 2;
    const heightFor = (pageIndex: number) => {
      if (pageIndex === 0) return Math.max(0, measured - paginationSafetyPx);
      const b = cvContentBox(frame, pageIndex, layout, sidebarPct, chromeOptions);
      const deltaMm = b.top - first.top + (b.bottom - first.bottom);
      return Math.max(0, measured - deltaMm * PX_PER_MM - paginationSafetyPx);
    };

    const kids = Array.from(box.children) as HTMLElement[];
    const heights = kids.map((k) => k.getBoundingClientRect().height / scale);

    const out: Row[][] = [];
    let current: Row[] = [];
    let used = 0;
    let pageIndex = 0;
    const finishPage = () => {
      out[pageIndex] = current;
      pageIndex += 1;
      current = [];
      used = 0;
    };
    rows.forEach((row, i) => {
      while (pageIndex < (row.minPage ?? 0)) finishPage();
      const h = heights[i] ?? 0;
      if (used + h > heightFor(pageIndex) && current.length) {
        const last = current[current.length - 1];
        if (last?.heading) {
          current.pop();
          finishPage();
          current = [last];
          used = heights[i - 1] ?? 0;
        } else {
          finishPage();
        }
      }
      current.push(row);
      used += h;
    });
    out[pageIndex] = current;
    const requiredPages =
      orderedSectionKeys.some((key) => cvSectionLayout(data, key).page === 2) ||
      (design.useElements && elements.some((element) => element.page === 2))
        ? 2
        : 1;
    while (out.length < requiredPages) out.push([]);
    setPages(out.length ? out : [[]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shape,
    data,
    layout,
    layoutChoice,
    design.template,
    design.useElements,
    elements,
    pal.accent,
    pal.ink,
    pal.muted,
    measuredAt,
  ]);

  /**
   * Papierfarbe für die Zierde.
   *
   * Eine Vorlage darf ein dunkles Blatt haben – Sonne etwa steht auf #333.
   * Läge diese Farbe auch nur blass unter dem Text, wäre das Papier grau statt
   * weiss. Für die Zierde zählen deshalb nur die *Formen* der Vorlage, nicht
   * ihr Blattgrund. Bei "card" ist der Grund dagegen die tragende Fläche und
   * bleibt, wie er ist.
   */
  /**
   * Der Grund der Seite: der **echte Hintergrund des Titelblatts**, voll deckend.
   *
   * Vorher wurde er auf 11 % heruntergeblendet und die Vorlage stattdessen mit
   * eigenen Bändern und Spalten nachgebaut. Das Ergebnis sah nie nach dem
   * Titelblatt aus – wer dort Warm mit zwei grossen Kreisen auf Creme gewählt
   * hatte, fand im Lebenslauf ein weisses Blatt mit einem Schleier.
   *
   * Jetzt steht dieselbe Fläche auf beiden Blättern. Lesbar wird der Text
   * durch die Schreibfläche darüber, nicht dadurch, dass die Vorlage
   * verschwindet.
   */
  const ground = (pageIndex: number) => (
    <div data-cv-background="motif" style={{ position: "absolute", inset: 0 }}>
      <DossierSheetBackground
        template={design.template}
        colors={design.colors}
        pageIndex={pageIndex}
        paperColor={paperColorOverride}
      />
    </div>
  );

  /**
   * Eigene Felder und Formen – dieselben wie auf dem Titelblatt.
   *
   * Sie lagen früher als blasse Zierde im Hintergrund und liessen sich hier
   * nicht anfassen; Textfelder und Bilder fielen sogar ganz weg. Jetzt tragen
   * sie dieselbe Ebene wie auf dem Titelblatt: volle Deckkraft, anklickbar,
   * mit der Maus verschiebbar. Jedes Element gehört genau zu seiner gewählten
   * CV-Seite und wird deshalb nicht auf jedem Blatt wiederholt.
   */
  const elementBlocks = useMemo(() => {
    const built = buildCustomBlocks(design.template, elements, elementStyles, slots);
    if (!design.font) return built;
    return built.map((block) =>
      elementStyles[block.id]?.font
        ? block
        : {
            ...block,
            style: { ...block.style, font: design.font as NonNullable<CvDesign["font"]> },
          },
    );
  }, [design.template, design.font, elements, elementStyles, slots]);

  const elementLayer = (pageIndex: number) => {
    const idsOnPage = new Set(
      elements
        .filter((element) => (element.page === 2 ? 1 : 0) === pageIndex)
        .map((element) => element.id),
    );
    const shown = design.useElements
      ? elementBlocks.filter((block) => idsOnPage.has(block.id))
      : [];
    // Im Zeichenmodus muss die Ebene auch dann da sein, wenn noch kein Element
    // existiert – sonst gäbe es keine Fläche, auf der man ziehen kann.
    if (shown.length === 0 && !drawing) return null;
    const editable = !exportMode && !!onMoveElement;
    return (
      <div
        data-cv-elements
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 5,
          // Im Export darf die Ebene nichts abfangen; in der Vorschau nimmt ein
          // Klick daneben die Auswahl zurück, genau wie auf dem Titelblatt.
          pointerEvents: editable ? undefined : "none",
        }}
        onPointerDown={
          editable
            ? (e) => {
                if (drawing) return;
                if (!(e.target as HTMLElement).closest("[data-block-id]")) onSelect?.(null);
              }
            : undefined
        }
      >
        <BlockLayer
          blocks={shown}
          colors={design.colors}
          selected={exportMode ? null : selected}
          onSelect={onSelect ?? (() => {})}
          onMove={onMoveElement ?? (() => {})}
          editable={!exportMode && !!onMoveElement}
          drawing={!exportMode && drawing}
          onDrawn={
            onDrawn && pageIndex < 2
              ? (points) => onDrawn(points, (pageIndex + 1) as 1 | 2)
              : undefined
          }
        />
      </div>
    );
  };

  /** Ausschnitt des echten Titelblatt-Hintergrunds, oben bündig. */
  const bandMotif = (heightMm: number) => (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: `${heightMm}mm`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: `${PAGE.WIDTH}px`,
          height: `${PAGE.HEIGHT}px`,
        }}
      >
        <DossierSheetBackground
          template={design.template}
          colors={design.colors}
          paperColor={paperColorOverride}
        />
      </div>
    </div>
  );

  /** Farbe des Kopfbands – bei Studio das Akzentband, sonst die Hauptfläche. */
  const bandColor = frame.id === "column" ? design.colors.accent || areaColor : areaColor;
  const onBand = onColorRoles(bandColor, design.colors.primary);

  /**
   * Alles, was hinter dem Text liegt.
   *
   * Früher hat diese Funktion Spalte, Kopfband, Fussband und Zierrahmen selbst
   * nachgezeichnet, während der echte Hintergrund auf 11 % gedimmt war. Das
   * waren zwei Darstellungen derselben Vorlage, die nie ganz zusammenpassten.
   * Jetzt zeichnet der Hintergrund sie – er ist ja derselbe wie auf dem
   * Titelblatt – und hier kommt nur noch die Schreibfläche darüber.
   */
  const chrome = (pageIndex: number) => {
    const surface = cvSurface(frame, pageIndex, layout, sidebarPct, chromeOptions);
    return (
      <>
        <div
          data-cv-background="paper"
          style={{ position: "absolute", inset: 0, background: pal.paper }}
        />
        {ground(pageIndex)}

        <div
          data-cv-surface
          data-cv-card={frame.id === "card" ? "" : undefined}
          style={{
            position: "absolute",
            left: `${surface.left}mm`,
            right: `${surface.right}mm`,
            top: `${surface.top}mm`,
            bottom: `${surface.bottom}mm`,
            background: pal.paper,
            borderRadius: frame.id === "card" ? `${frame.cardRadiusMm}mm` : undefined,
            // Der Regler bestimmt, wie viel Vorlage durch die Schreibfläche
            // scheint. Der Bereich ist eng gehalten, damit der Text auf jeder
            // Einstellung lesbar bleibt.
            opacity:
              frame.id === "quiet" ||
              (frame.id === "band" && frame.headFirstMm === 0 && frame.footMm === 0)
                ? Math.max(0.8, 1 - policy.backgroundOpacity * 0.5)
                : 1,
          }}
        />
      </>
    );
  };

  const sidePresence = (pageIndex: number) => {
    const onPage = (key: CvSectionKey) => {
      const sectionLayout = cvSectionLayout(data, key);
      return (
        placements[key] === "side" &&
        sectionLayout.positioning === "flow" &&
        sectionLayout.page - 1 === pageIndex &&
        !data.hidden[key]
      );
    };
    const hasContact =
      !personLayoutCustomized &&
      pageIndex === 0 &&
      placements.kontakt === "side" &&
      !!(p.adresse || p.plzOrt || p.telefon || p.email || p.geburtsdatum || p.nationalitaet);
    const hasSchool = onPage("schule") && data.schule.some(entryFilled);
    const hasExperience = onPage("erfahrung") && data.erfahrung.some(entryFilled);
    const hasLanguages =
      onPage("sprachen") && data.sprachen.some((s) => s.name.trim() || s.niveau.trim());
    const hasStrengths = onPage("staerken") && data.staerken.some((value) => value.trim());
    const hasHobbies = onPage("hobbys") && data.hobbys.some((value) => value.trim());
    const hasReferences =
      onPage("referenzen") &&
      data.referenzen.some((reference) =>
        [reference.name, reference.funktion, reference.kontakt].some((value) => value.trim()),
      );
    const firstSideKey = contentSectionKeys.find(
      (key): key is CvSectionKey =>
        !isCustomSectionKey(key) && onPage(key) && sectionRows(key).length > 0,
    );
    const firstSide = hasContact
      ? "contact"
      : firstSideKey === "schule"
        ? "school"
        : firstSideKey === "erfahrung"
          ? "experience"
          : firstSideKey === "sprachen"
            ? "languages"
            : firstSideKey === "staerken"
              ? "strengths"
              : firstSideKey === "hobbys"
                ? "hobbies"
                : "references";
    return {
      hasContact,
      hasSchool,
      hasExperience,
      hasLanguages,
      hasStrengths,
      hasHobbies,
      hasReferences,
      firstSide,
    };
  };

  const sideSectionStyle = (key: CvSectionKey): React.CSSProperties => ({
    gridColumn: cvSectionLayout(data, key).width === "half" ? "span 1" : "1 / -1",
    order: contentSectionKeys.indexOf(key) + 10,
    minWidth: 0,
    overflowWrap: "anywhere",
  });

  const sideHeading = (text: string, first = false) => (
    <div
      data-cv-section="sidebar"
      data-cv-user-section-margin={sectionTitleMarginBottomPx === null ? undefined : "true"}
      style={{
        ["--cv-user-section-margin-bottom" as string]:
          sectionTitleMarginBottomPx === null ? undefined : `${sectionTitleMarginBottomPx}px`,
        marginTop:
          first && !automaticPhotoInSidebar
            ? "0.8mm"
            : sidePlan.veryCompact
              ? "3.2mm"
              : sidePlan.compact
                ? "4.1mm"
                : "5.2mm",
        marginBottom:
          sectionTitleMarginBottomPx === null
            ? sidePlan.veryCompact
              ? "1.2mm"
              : sidePlan.compact
                ? "1.5mm"
                : "1.9mm"
            : `${sectionTitleMarginBottomPx}px`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2mm", minWidth: 0 }}>
        <div
          data-cv-section-title
          data-cv-user-section-size={sectionTitleFontSizePx === null ? undefined : "true"}
          data-cv-user-section-color={sectionTitleColor ? "true" : undefined}
          data-cv-user-section-weight={design.sectionTitleBold === undefined ? undefined : "true"}
          data-cv-user-section-style={design.sectionTitleItalic === undefined ? undefined : "true"}
          data-cv-user-section-decoration={
            design.sectionTitleUnderline === undefined ? undefined : "true"
          }
          style={{
            ["--cv-user-section-font-size" as string]:
              sectionTitleFontSizePx === null ? undefined : `${sectionTitleFontSizePx}px`,
            ["--cv-user-section-color" as string]: sectionTitleColor || undefined,
            ["--cv-user-section-weight" as string]: `${sectionTitleWeight}`,
            ["--cv-user-section-style" as string]: sectionTitleFontStyle,
            ["--cv-user-section-decoration" as string]: sectionTitleDecoration,
            fontSize:
              sectionTitleFontSizePx === null
                ? ptHead(
                    headingStyle.uppercase
                      ? sidePlan.veryCompact
                        ? 8.4
                        : sidePlan.compact
                          ? 8.8
                          : 9.2
                      : sidePlan.veryCompact
                        ? 9.4
                        : sidePlan.compact
                          ? 9.8
                          : 10.2,
                  )
                : `${sectionTitleFontSizePx}px`,
            fontWeight: sectionTitleWeight,
            fontStyle: sectionTitleFontStyle,
            textDecoration: sectionTitleDecoration,
            letterSpacing: `${headingStyle.trackingEm}em`,
            textTransform: headingStyle.uppercase ? "uppercase" : "none",
            fontFamily: theme.typography.fontStack,
            color: sectionTitleColor || side.accent,
            lineHeight: headingStyle.lineHeight,
            flexShrink: 0,
          }}
        >
          {text}
        </div>
        {headingRule !== "none" && (
          <div
            data-cv-accent="section"
            data-cv-user-section-color={sectionTitleColor ? "true" : undefined}
            style={{
              ["--cv-user-section-color" as string]: sectionTitleColor || undefined,
              width: "auto",
              flex: "1 1 auto",
              minWidth: 0,
              height: "0.5mm",
              borderRadius: "999px",
              background: sectionTitleColor || side.accent,
              opacity: 0.78,
            }}
          />
        )}
      </div>
    </div>
  );

  const sideBody =
    (sidePlan.veryCompact ? 8.7 : sidePlan.compact ? 9.1 : 9.5) * TYPE_BASE * bodyScale;
  const sideSmall =
    (sidePlan.veryCompact ? 8.2 : sidePlan.compact ? 8.6 : 9.1) * TYPE_BASE * bodyScale;
  const sideLine = sidePlan.veryCompact ? 1.3 : sidePlan.compact ? 1.4 : 1.5;

  const sideEntries = (key: "schule" | "erfahrung") => (
    <>
      {data[key].filter(entryFilled).map((e) => (
        <div
          data-cv-entry
          key={`side-${e.id}`}
          style={{ marginBottom: sidePlan.compact ? "1.7mm" : "2.2mm" }}
        >
          {e.zeit && (
            <div
              data-cv-date
              data-cv-muted
              style={{ fontSize: `${sideSmall}pt`, color: side.muted, lineHeight: 1.25 }}
            >
              {e.zeit}
            </div>
          )}
          {e.titel && (
            <div
              data-cv-entry-title
              style={{
                marginTop: "0.25mm",
                fontSize: `${sideBody}pt`,
                fontWeight: 700,
                color: side.ink,
                lineHeight: 1.28,
              }}
            >
              {e.titel}
            </div>
          )}
          {e.ort && (
            <div
              data-cv-muted
              style={{
                marginTop: "0.2mm",
                fontSize: `${sideSmall}pt`,
                color: side.muted,
                lineHeight: 1.28,
              }}
            >
              {e.ort}
            </div>
          )}
          {e.beschreibung && (
            <div
              data-cv-body
              style={{
                marginTop: "0.35mm",
                fontSize: `${sideSmall}pt`,
                color: side.ink,
                lineHeight: 1.3,
              }}
            >
              {e.beschreibung}
            </div>
          )}
        </div>
      ))}
    </>
  );

  /** Bei "column" ist die Spalte die Fläche der Vorlage – sonst getönte Papierspalte. */
  const onColumn = frame.id === "column";
  const sidebarWidth = sidebarWidthMm(frame, layout, sidebarPct);
  /**
   * Fotobreite in der Seitenspalte. Ein Hochportrait wird hoch, darum bleibt
   * die Breite unter dem, was die Spalte abzüglich ihrer Ränder hergibt.
   */
  const sidePhotoMm = Math.min(
    sidePlan.veryCompact ? 25 : 28,
    sidebarWidth - (onColumn ? 19 : 15.5),
  );

  const freeSectionKeys = orderedSectionKeys.filter((key) => {
    if (cvSectionLayout(data, key).positioning !== "free") return false;
    return key === "person" ? personalSectionRows().length > 0 : sectionRows(key).length > 0;
  });

  const freeSectionBox = (key: CvLayoutSectionKey, pageIndex: number) => {
    const sectionLayout = cvSectionLayout(data, key);
    const box = cvContentBox(frame, pageIndex, layout, sidebarPct, chromeOptions);
    const available = SHEET_W_MM - box.left - box.right;
    const presetWidth =
      sectionLayout.width === "half" ? Math.max(20, (available - 6) / 2) : available;
    const live = liveSectionBoxes[key];
    const widthMm = Math.max(
      20,
      Math.min(available, live?.widthMm ?? sectionLayout.widthMm ?? presetWidth),
    );
    const requestedHeight = live?.heightMm ?? sectionLayout.heightMm ?? 0;
    const heightMm = Math.max(10, requestedHeight, freeHeights[key] ?? 0);
    const fallbackY = box.top + Math.max(0, freeSectionKeys.indexOf(key)) * 18;
    const minX = box.left;
    const maxX = Math.max(minX, SHEET_W_MM - box.right - widthMm);
    const minY = box.top;
    const maxY = Math.max(minY, SHEET_H_MM - box.bottom - heightMm);
    return {
      widthMm,
      heightMm,
      x: Math.max(minX, Math.min(maxX, live?.x ?? sectionLayout.x ?? minX)),
      y: Math.max(minY, Math.min(maxY, live?.y ?? sectionLayout.y ?? fallbackY)),
      minX,
      maxX,
      minY,
      maxY,
      pageRight: SHEET_W_MM - box.right,
      pageBottom: SHEET_H_MM - box.bottom,
    };
  };

  const startSectionGesture =
    (key: CvLayoutSectionKey, pageIndex: number) => (event: React.PointerEvent<HTMLElement>) => {
      if (exportMode || !onSectionLayout || event.button !== 0) return;
      const pageEl = event.currentTarget.closest("[data-cv-page]") as HTMLElement | null;
      if (!pageEl) return;
      const sheetPx = pageEl.getBoundingClientRect().width;
      if (!sheetPx) return;
      event.preventDefault();
      event.stopPropagation();
      onSelectSection?.(key);
      onSelect?.(null);

      const mmPerPx = SHEET_W_MM / sheetPx;
      const startX = event.clientX;
      const startY = event.clientY;
      const from = freeSectionBox(key, pageIndex);
      let latest: FreeSectionLiveBox = {
        x: from.x,
        y: from.y,
        widthMm: from.widthMm,
        heightMm: from.heightMm,
      };

      const step = (moveEvent: PointerEvent) => {
        const rawX = from.x + (moveEvent.clientX - startX) * mmPerPx;
        const rawY = from.y + (moveEvent.clientY - startY) * mmPerPx;
        // Zwei-Millimeter-Raster: hilfreich, aber fein genug, um nicht zu stören.
        latest = {
          ...latest,
          x: Math.max(from.minX, Math.min(from.maxX, Math.round(rawX / 2) * 2)),
          y: Math.max(from.minY, Math.min(from.maxY, Math.round(rawY / 2) * 2)),
        };
        setLiveSectionBoxes((current) => ({ ...current, [key]: latest }));
      };
      const stop = () => {
        window.removeEventListener("pointermove", step);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        setLiveSectionBoxes((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        onSectionLayout(key, { x: latest.x, y: latest.y });
      };
      window.addEventListener("pointermove", step);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    };

  const startSectionResize =
    (key: CvLayoutSectionKey, pageIndex: number, direction: SectionResizeDirection) =>
    (event: React.PointerEvent<HTMLElement>) => {
      if (exportMode || !onSectionLayout || event.button !== 0) return;
      const pageEl = event.currentTarget.closest("[data-cv-page]") as HTMLElement | null;
      if (!pageEl) return;
      const sheetPx = pageEl.getBoundingClientRect().width;
      if (!sheetPx) return;
      event.preventDefault();
      event.stopPropagation();
      onSelectSection?.(key);
      onSelect?.(null);

      const mmPerPx = SHEET_W_MM / sheetPx;
      const startX = event.clientX;
      const startY = event.clientY;
      const from = freeSectionBox(key, pageIndex);
      const originalRight = from.x + from.widthMm;
      const originalBottom = from.y + from.heightMm;
      let latest: FreeSectionLiveBox = {
        x: from.x,
        y: from.y,
        widthMm: from.widthMm,
        heightMm: from.heightMm,
      };

      const step = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startX) * mmPerPx;
        const dy = (moveEvent.clientY - startY) * mmPerPx;
        let left = from.x;
        let top = from.y;
        let right = originalRight;
        let bottom = originalBottom;

        if (direction.includes("e")) {
          right = Math.max(left + 20, Math.min(from.pageRight, originalRight + dx));
        }
        if (direction.includes("w")) {
          left = Math.max(from.minX, Math.min(right - 20, from.x + dx));
        }
        if (direction.includes("s")) {
          bottom = Math.max(top + 10, Math.min(from.pageBottom, originalBottom + dy));
        }
        if (direction.includes("n")) {
          top = Math.max(from.minY, Math.min(bottom - 10, from.y + dy));
        }

        latest = {
          x: Math.round(left * 10) / 10,
          y: Math.round(top * 10) / 10,
          widthMm: Math.round((right - left) * 10) / 10,
          heightMm: Math.round((bottom - top) * 10) / 10,
        };
        setLiveSectionBoxes((current) => ({ ...current, [key]: latest }));
      };
      const stop = () => {
        window.removeEventListener("pointermove", step);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        setLiveSectionBoxes((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        onSectionLayout(key, latest);
      };
      window.addEventListener("pointermove", step);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    };

  const nudgeSection =
    (key: CvLayoutSectionKey, pageIndex: number) => (event: React.KeyboardEvent<HTMLElement>) => {
      if (!onSectionLayout) return;
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const move = delta[event.key];
      if (!move) return;
      event.preventDefault();
      const box = freeSectionBox(key, pageIndex);
      onSectionLayout(key, {
        x: Math.max(box.minX, Math.min(box.maxX, box.x + move[0])),
        y: Math.max(box.minY, Math.min(box.maxY, box.y + move[1])),
      });
    };

  const freeSections = (pageIndex: number) =>
    freeSectionKeys.map((key) => {
      const sectionLayout = cvSectionLayout(data, key);
      if (sectionLayout.page - 1 !== pageIndex) return null;
      const content = key === "person" ? personalSectionRows() : sectionRows(key);
      const unit: SectionUnit = {
        key,
        width: sectionLayout.width,
        minPage: pageIndex as 0 | 1,
        rows: content,
      };
      const box = freeSectionBox(key, pageIndex);
      const active = selectedSection === key;
      return (
        <div
          key={key}
          data-cv-free-section={key}
          data-cv-section-label={sectionTitle(key)}
          role={exportMode ? undefined : "button"}
          tabIndex={exportMode ? undefined : 0}
          aria-label={exportMode ? undefined : `${sectionTitle(key)} verschieben`}
          onPointerDown={exportMode ? undefined : startSectionGesture(key, pageIndex)}
          onKeyDown={exportMode ? undefined : nudgeSection(key, pageIndex)}
          style={{
            position: "absolute",
            left: `${box.x}mm`,
            top: `${box.y}mm`,
            width: `${box.widthMm}mm`,
            minHeight: `${box.heightMm}mm`,
            minWidth: 0,
            zIndex: 8,
            cursor: exportMode ? undefined : "grab",
            touchAction: "none",
            boxSizing: "border-box",
            borderRadius: "1.5mm",
            outline: !exportMode && active ? `0.55mm solid ${pal.accent}` : undefined,
            outlineOffset: !exportMode && active ? "1.2mm" : undefined,
          }}
        >
          {sectionNode(unit)}
          {!exportMode && active && (
            <span
              data-cv-section-handle
              aria-hidden
              style={{
                position: "absolute",
                right: 0,
                top: "-5.2mm",
                borderRadius: "999px",
                padding: "0.8mm 2mm",
                background: pal.paper,
                color: pal.accent,
                border: `0.3mm solid ${pal.accent}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
                fontFamily: SHEET_FONT,
                fontSize: "7.5pt",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              Ziehen zum Verschieben
            </span>
          )}
          {!exportMode && active
            ? SECTION_RESIZE_HANDLES.map((handle) => (
                <span
                  key={handle.direction}
                  data-cv-section-resize-handle={handle.direction}
                  role="button"
                  tabIndex={-1}
                  aria-label={`${sectionTitle(key)}: Grösse ${SECTION_RESIZE_DIRECTION_LABEL[handle.direction]} ändern`}
                  onPointerDown={startSectionResize(key, pageIndex, handle.direction)}
                  style={{
                    position: "absolute",
                    left: handle.left,
                    top: handle.top,
                    width: "3.2mm",
                    height: "3.2mm",
                    transform: "translate(-50%, -50%)",
                    borderRadius: "0.55mm",
                    border: `0.45mm solid ${pal.accent}`,
                    background: pal.paper,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                    cursor: handle.cursor,
                    touchAction: "none",
                    zIndex: 2,
                  }}
                />
              ))
            : null}
        </div>
      );
    });

  /**
   * Frei gesetztes Foto. Es liegt über dem Satzspiegel, gehört keiner Spalte an
   * und steht nur auf der ersten Seite. In der Vorschau lässt es sich ziehen,
   * im Export ist es ein stilles Bild ohne Griffe.
   */
  const freePhoto = (pageIndex: number) => {
    if (pageIndex !== 0 || !freePhotoOn) return null;
    const heightMm = photoBox.widthMm * dossierPhotoRatio(photoStyle.shape);
    return (
      <div
        data-cv-photo
        data-cv-photo-free
        role={exportMode ? undefined : "button"}
        tabIndex={exportMode ? undefined : 0}
        aria-label={exportMode ? undefined : "Foto verschieben – mit der Maus ziehen"}
        onPointerDown={exportMode ? undefined : startPhotoGesture("move")}
        onKeyDown={exportMode ? undefined : nudgePhoto}
        style={{
          position: "absolute",
          left: `${infoMirrored && layout === "modern" ? SHEET_W_MM - photoBox.xMm - photoBox.widthMm : photoBox.xMm}mm`,
          top: `${photoBox.yMm}mm`,
          width: `${photoBox.widthMm}mm`,
          height: `${heightMm}mm`,
          zIndex: 6,
          borderRadius: dossierPhotoRadius(photoStyle.shape),
          cursor: exportMode ? undefined : "grab",
          touchAction: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            borderRadius: dossierPhotoRadius(photoStyle.shape),
          }}
        >
          <img
            src={p.foto ?? undefined}
            alt=""
            style={dossierPhotoCropStyle(photoStyle)}
            draggable={false}
          />
        </div>
        {!exportMode && (
          <div
            data-cv-photo-handle
            aria-hidden
            onPointerDown={startPhotoGesture("size")}
            title="Grösse ziehen"
            style={{
              position: "absolute",
              right: "-2.4mm",
              bottom: "-2.4mm",
              width: "4.8mm",
              height: "4.8mm",
              borderRadius: "9999px",
              background: "#ffffff",
              border: `0.4mm solid ${pal.accent}`,
              boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
              cursor: "nwse-resize",
              touchAction: "none",
            }}
          />
        )}
      </div>
    );
  };

  /**
   * Warnungen aus der tatsächlich gezeichneten Vorschau ableiten. Dadurch
   * stimmen sie mit Schriftumbruch, Vorlagengeometrie und PDF-Canvas überein,
   * statt dieselben Masse ein zweites Mal grob nachzurechnen.
   */
  useLayoutEffect(() => {
    if (!onLayoutWarnings || !canvasRef.current) return;
    const root = canvasRef.current;
    let animationFrame = 0;

    const report = () => {
      const warnings: CvLayoutWarning[] = [];
      const warningIds = new Set<string>();
      const add = (warning: CvLayoutWarning) => {
        if (warningIds.has(warning.id)) return;
        warningIds.add(warning.id);
        warnings.push(warning);
      };
      const pageNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-cv-page]"));

      if (pageNodes.length > 2) {
        add({
          id: "more-than-two-pages",
          message: `Dein CV belegt aktuell ${pageNodes.length} Seiten. Inhalte nach Seite 2 bitte kürzen oder neu verteilen.`,
        });
      }

      for (const [pageIndex, page] of pageNodes.entries()) {
        const main = Array.from(page.children).find(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && child.hasAttribute("data-cv-main"),
        );
        if (main && main.scrollHeight > main.clientHeight + 3) {
          add({
            id: `main-clipped:${pageIndex}`,
            message: `Auf Seite ${pageIndex + 1} ragt Inhalt aus dem druckbaren Bereich und könnte im PDF abgeschnitten werden.`,
          });
        }
      }

      const freeSections = Array.from(
        root.querySelectorAll<HTMLElement>("[data-cv-free-section]"),
      ).map((node) => ({
        node,
        key: node.dataset.cvFreeSection ?? "rubrik",
        label: node.dataset.cvSectionLabel || "Eine frei platzierte Rubrik",
        page: node.closest<HTMLElement>("[data-cv-page]"),
        rect: node.getBoundingClientRect(),
      }));

      for (const section of freeSections) {
        if (!section.page) continue;
        const pageRect = section.page.getBoundingClientRect();
        const outside =
          section.rect.left < pageRect.left - 1 ||
          section.rect.top < pageRect.top - 1 ||
          section.rect.right > pageRect.right + 1 ||
          section.rect.bottom > pageRect.bottom + 1;
        if (outside) {
          add({
            id: `free-clipped:${section.key}`,
            message: `„${section.label}“ ragt über den Seitenrand und könnte im PDF abgeschnitten werden.`,
          });
        }
      }

      for (let firstIndex = 0; firstIndex < freeSections.length; firstIndex += 1) {
        const first = freeSections[firstIndex];
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < freeSections.length;
          secondIndex += 1
        ) {
          const second = freeSections[secondIndex];
          if (!first.page || first.page !== second.page) continue;
          const overlapWidth = Math.max(
            0,
            Math.min(first.rect.right, second.rect.right) -
              Math.max(first.rect.left, second.rect.left),
          );
          const overlapHeight = Math.max(
            0,
            Math.min(first.rect.bottom, second.rect.bottom) -
              Math.max(first.rect.top, second.rect.top),
          );
          const smallerArea = Math.min(
            first.rect.width * first.rect.height,
            second.rect.width * second.rect.height,
          );
          const overlapRatio = smallerArea > 0 ? (overlapWidth * overlapHeight) / smallerArea : 0;
          if (overlapRatio >= 0.25) {
            add({
              id: `free-overlap:${[first.key, second.key].sort().join(":")}`,
              message: `„${first.label}“ und „${second.label}“ überlappen sich deutlich.`,
            });
          }
        }
      }

      const elementLabels = new Map(elements.map((element) => [element.id, element.label]));
      for (const node of root.querySelectorAll<HTMLElement>("[data-cv-elements] [data-block-id]")) {
        const page = node.closest<HTMLElement>("[data-cv-page]");
        if (!page) continue;
        const pageRect = page.getBoundingClientRect();
        const rect = node.getBoundingClientRect();
        const outside =
          rect.left < pageRect.left - 1 ||
          rect.top < pageRect.top - 1 ||
          rect.right > pageRect.right + 1 ||
          rect.bottom > pageRect.bottom + 1;
        if (!outside) continue;
        const id = node.dataset.blockId ?? "element";
        add({
          id: `element-clipped:${id}`,
          message: `Das freie Element „${elementLabels.get(id) ?? "Element"}“ ragt über den Seitenrand und könnte im PDF abgeschnitten werden.`,
        });
      }

      onLayoutWarnings(warnings);
    };

    const scheduleReport = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(report);
    };
    scheduleReport();

    if (typeof ResizeObserver === "undefined") {
      return () => window.cancelAnimationFrame(animationFrame);
    }
    const observer = new ResizeObserver(scheduleReport);
    observer.observe(root);
    for (const node of root.querySelectorAll<HTMLElement>(
      "[data-cv-page], [data-cv-main], [data-cv-free-section], [data-block-id]",
    )) {
      observer.observe(node);
    }
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [elementBlocks, elements, exportMode, onLayoutWarnings, pages, shape]);

  const modernSidebar = (pageIndex: number) => {
    // Eine farbige Spalte läuft über die volle Höhe, wie auf dem Titelblatt.
    // Die getönte Papierspalte beginnt erst unter dem Kopfband, damit dieses
    // über die ganze Breite sichtbar bleibt.
    const surface = cvSurface(frame, pageIndex, layout, sidebarPct, chromeOptions);
    const contentBox = cvContentBox(frame, pageIndex, layout, sidebarPct, chromeOptions);
    // Card-Vorlagen tragen den Kopf bewusst auf der farbigen Oberzone. Die
    // Sidebar darf diese Komposition auf Seite 1 weder links anschneiden noch
    // vertikal hineinragen. Ab Seite 2 gilt wieder die normale Kartenfläche.
    const cardHeaderClearanceMm =
      frame.id === "card" && pageIndex === 0 && !personLayoutCustomized
        ? contentBox.top + 32
        : surface.top;
    const sidebarTopMm = onColumn ? 0 : Math.max(surface.top, cardHeaderClearanceMm);
    const sidebarLeftMm = onColumn ? 0 : frame.id === "card" ? surface.left : 0;
    const {
      hasContact,
      hasSchool,
      hasExperience,
      hasLanguages,
      hasStrengths,
      hasHobbies,
      hasReferences,
      firstSide,
    } = sidePresence(pageIndex);
    const hasSideSections =
      hasContact ||
      hasSchool ||
      hasExperience ||
      hasLanguages ||
      hasStrengths ||
      hasHobbies ||
      hasReferences;
    const sidebarPhoto = pageIndex === 0 && automaticPhotoInSidebar;
    return (
      <div
        data-cv-sidebar
        style={{
          position: "absolute",
          left: `${sidebarLeftMm}mm`,
          top: `${sidebarTopMm}mm`,
          bottom: onColumn ? 0 : `${surface.bottom}mm`,
          width: `${sidebarWidth}mm`,
          padding: onColumn
            ? `${sidebarPhoto ? "16mm" : "13mm"} 9mm ${Math.max(12, frame.footMm + 8)}mm 10mm`
            : `${sidebarPhoto ? "12.5mm" : "9.5mm"} 7.5mm 12mm 8mm`,
          boxSizing: "border-box",
          // Die Spalte selbst liegt schon im Seitengrund; hier nur bei der
          // getönten Papierspalte einen eigenen Grund zeichnen.
          background: onColumn ? "transparent" : side.bg,
          // Kein Trennstrich: Die getönte Spalte setzt sich schon von selbst
          // vom Papier ab, die Linie darüber lag als grüner Strich dazwischen.
          fontFamily: SHEET_FONT,
          overflow: "hidden",
        }}
      >
        {!onColumn && (
          <div
            aria-hidden
            data-cv-sidebar-tint
            style={{
              position: "absolute",
              inset: 0,
              background: `${side.accent}${alphaHex(policy.sidebarTint)}`,
              pointerEvents: "none",
            }}
          />
        )}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: customSectionLayout
              ? "repeat(2, minmax(0, 1fr))"
              : "minmax(0, 1fr)",
            columnGap: customSectionLayout ? "2.2mm" : undefined,
            alignItems: "start",
          }}
        >
          {pageIndex === 0 || hasSideSections ? (
            <>
              {sidebarPhoto && (
                <div
                  data-cv-photo
                  style={{
                    gridColumn: customSectionLayout ? "1 / -1" : undefined,
                    position: "relative",
                    order: 0,
                    width: `${sidePhotoMm}mm`,
                    height: `${sidePhotoMm * dossierPhotoRatio(photoStyle.shape)}mm`,
                    overflow: "hidden",
                    borderRadius: dossierPhotoRadius(photoStyle.shape),
                    marginBottom: sidePlan.compact ? "3.8mm" : "5.3mm",
                  }}
                >
                  <img src={p.foto ?? undefined} alt="" style={dossierPhotoCropStyle(photoStyle)} />
                </div>
              )}

              {hasContact && (
                <div
                  style={{
                    gridColumn: customSectionLayout ? "1 / -1" : undefined,
                    order: 1,
                  }}
                >
                  {sideHeading(label(data, "kontakt"), firstSide === "contact")}
                  <div
                    data-cv-entry
                    data-cv-body
                    style={{
                      fontSize: `${sideBody}pt`,
                      color: side.ink,
                      lineHeight: sideLine,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {p.adresse && <div>{p.adresse}</div>}
                    {p.plzOrt && <div>{p.plzOrt}</div>}
                    {p.telefon && (
                      <div style={{ marginTop: sidePlan.compact ? "1mm" : "1.7mm" }}>
                        {p.telefon}
                      </div>
                    )}
                    {p.email && <div>{p.email}</div>}
                    {p.geburtsdatum && (
                      <div
                        data-cv-date
                        data-cv-muted
                        style={{ marginTop: sidePlan.compact ? "1.2mm" : "2mm", color: side.muted }}
                      >
                        Geb. {p.geburtsdatum}
                      </div>
                    )}
                    {p.nationalitaet && (
                      <div data-cv-muted style={{ color: side.muted }}>
                        {p.nationalitaet}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasSchool && (
                <div style={sideSectionStyle("schule")}>
                  {sideHeading(label(data, "schule"), firstSide === "school")}
                  {sideEntries("schule")}
                </div>
              )}

              {hasExperience && (
                <div style={sideSectionStyle("erfahrung")}>
                  {sideHeading(label(data, "erfahrung"), firstSide === "experience")}
                  {sideEntries("erfahrung")}
                </div>
              )}

              {hasLanguages && (
                <div style={sideSectionStyle("sprachen")}>
                  {sideHeading(label(data, "sprachen"), firstSide === "languages")}
                  {data.sprachen
                    .filter((s) => s.name.trim() || s.niveau.trim())
                    .map((s) => (
                      <div
                        data-cv-entry
                        key={s.id}
                        style={{
                          marginBottom: sidePlan.veryCompact
                            ? "1.1mm"
                            : sidePlan.compact
                              ? "1.5mm"
                              : "1.9mm",
                          lineHeight: 1.32,
                        }}
                      >
                        <div
                          data-cv-entry-title
                          style={{
                            fontSize: `${sideBody + 0.1}pt`,
                            fontWeight: 700,
                            color: side.ink,
                          }}
                        >
                          {s.name}
                        </div>
                        {s.niveau && (
                          <div
                            data-cv-muted
                            style={{
                              fontSize: `${sideSmall}pt`,
                              color: side.muted,
                              marginTop: "0.2mm",
                            }}
                          >
                            {s.niveau}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {hasStrengths && (
                <div style={sideSectionStyle("staerken")}>
                  {sideHeading(label(data, "staerken"), firstSide === "strengths")}
                  {data.staerken
                    .filter((v) => v.trim())
                    .map((v, i) => (
                      <div
                        data-cv-entry
                        data-cv-body
                        key={`side-strength-${i}`}
                        style={{
                          display: "flex",
                          gap: "1.7mm",
                          marginBottom: sidePlan.veryCompact
                            ? "0.9mm"
                            : sidePlan.compact
                              ? "1.15mm"
                              : "1.45mm",
                        }}
                      >
                        <span style={{ color: side.accent, fontWeight: 800 }}>•</span>
                        <span
                          style={{
                            fontSize: `${sideBody - 0.2}pt`,
                            lineHeight: 1.34,
                            color: side.ink,
                          }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              {hasHobbies && (
                <div style={sideSectionStyle("hobbys")}>
                  {sideHeading(label(data, "hobbys"), firstSide === "hobbies")}
                  {data.hobbys
                    .filter((v) => v.trim())
                    .map((v, i) => (
                      <div
                        data-cv-entry
                        data-cv-body
                        key={`side-hobby-${i}`}
                        style={{
                          fontSize: `${sideBody - 0.2}pt`,
                          lineHeight: 1.36,
                          color: side.ink,
                          marginBottom: sidePlan.veryCompact
                            ? "0.8mm"
                            : sidePlan.compact
                              ? "1.05mm"
                              : "1.35mm",
                        }}
                      >
                        {v}
                      </div>
                    ))}
                </div>
              )}

              {hasReferences && (
                <div style={sideSectionStyle("referenzen")}>
                  {sideHeading(label(data, "referenzen"), firstSide === "references")}
                  {data.referenzen
                    .filter((r) => r.name.trim() || r.funktion.trim() || r.kontakt.trim())
                    .map((r) => (
                      <div
                        data-cv-entry
                        key={`side-${r.id}`}
                        style={{ marginBottom: sidePlan.compact ? "1.6mm" : "2mm" }}
                      >
                        {r.name && (
                          <div
                            data-cv-entry-title
                            style={{ fontSize: `${sideBody}pt`, fontWeight: 700, color: side.ink }}
                          >
                            {r.name}
                          </div>
                        )}
                        {r.funktion && (
                          <div
                            data-cv-muted
                            style={{
                              marginTop: "0.2mm",
                              fontSize: `${sideSmall}pt`,
                              color: side.muted,
                              lineHeight: 1.28,
                            }}
                          >
                            {r.funktion}
                          </div>
                        )}
                        {r.kontakt && (
                          <div
                            data-cv-body
                            style={{
                              marginTop: "0.25mm",
                              fontSize: `${sideSmall}pt`,
                              color: side.ink,
                              lineHeight: 1.28,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {r.kontakt}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : pageMarker(frame) !== "sidebar" ? null : ( // Band oder Fusszeile tragen die Angabe schon – hier wäre sie doppelt.
            <div
              data-cv-header
              style={{
                paddingTop: "5mm",
                gridColumn: customSectionLayout ? "1 / -1" : undefined,
                order: 1000,
              }}
            >
              <div
                data-cv-name
                style={{
                  fontSize: `${Math.min(12.5, smartNameSize(name, "modern") * 0.44) * TYPE_BASE * titleScale}pt`,
                  fontWeight: 750,
                  color: side.ink,
                  lineHeight: 1.15,
                  overflowWrap: "anywhere",
                }}
              >
                {name || "Lebenslauf"}
              </div>
              <div data-cv-muted style={{ marginTop: "1.5mm", fontSize: pt(9), color: side.muted }}>
                Lebenslauf · Seite {pageIndex + 1}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /**
   * Name und Zeile darunter im Kopfband – dort, wo sie auf dem Titelblatt
   * ebenfalls stehen. Auf Folgeseiten bleibt nur die Seitenangabe.
   */
  const bandHeader = (pageIndex: number) => {
    const head = pageIndex === 0 ? frame.headFirstMm : frame.headRestMm;
    if (!nameInBand || personLayoutCustomized || head <= 0) return null;
    const roles = frame.bandMotif ? onArea : onBand;
    // Rechts der Seitenspalte beginnen, sonst verschwindet der Vorname
    // dahinter – gemessen fehlten so die ersten 117 px des Namens.
    const clear = Math.max(bandLeftMm(frame, layout), sidebarWidthMm(frame, layout, sidebarPct));
    const left = clear + (clear > 0 ? 10 : MARGIN_X);
    return (
      <div
        data-cv-band-header
        style={{
          position: "absolute",
          left: `${left}mm`,
          right: `${MARGIN_X}mm`,
          top: `${headTopMm(frame, pageIndex)}mm`,
          height: `${head}mm`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          fontFamily: SHEET_FONT,
          overflow: "hidden",
        }}
      >
        {pageIndex === 0 ? (
          <>
            {docTitle(roles.muted)}
            <div
              data-cv-name
              style={{
                fontSize: `${nameSize}pt`,
                fontWeight: 750,
                color: roles.ink,
                lineHeight: 1.02,
                letterSpacing: "-0.02em",
                overflowWrap: "anywhere",
              }}
            >
              {name || "Dein Name"}
            </div>
            {p.untertitel && (
              <div
                data-cv-subtitle
                style={{
                  marginTop: "1.6mm",
                  fontSize: ptHead(11.2),
                  fontWeight: 600,
                  color: roles.muted,
                }}
              >
                {p.untertitel}
              </div>
            )}
          </>
        ) : (
          <div data-cv-muted style={{ fontSize: pt(9), color: roles.muted }}>
            {name || "Lebenslauf"} · Seite {pageIndex + 1}
          </div>
        )}
      </div>
    );
  };

  /**
   * Dezente Fusszeile ab Seite 2 – aber nur, wo nicht schon ein Kopfband oder
   * eine Seitenspalte die Angabe trägt. Auf einem Blatt steht sie genau einmal.
   */
  const footer = (pageIndex: number) => {
    if (pageIndex === 0 || pageMarker(frame) !== "footer") return null;
    const box = cvContentBox(frame, pageIndex, layout, sidebarPct, chromeOptions);
    return (
      <div
        data-cv-page-label
        data-cv-footer
        data-cv-muted
        style={{
          position: "absolute",
          left: `${box.left}mm`,
          right: `${box.right}mm`,
          bottom: `${box.bottom - FOOTER_MM}mm`,
          height: `${FOOTER_MM}mm`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6mm",
          borderTop: `0.25mm solid ${pal.accent}${alphaHex(0.3)}`,
          paddingTop: "1.6mm",
          boxSizing: "border-box",
          fontFamily: theme.typography.fontStack,
          fontSize: pt(8.5),
          color: pal.muted,
        }}
      >
        <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          {name || "Lebenslauf"}
        </span>
        <span style={{ flexShrink: 0 }}>Seite {pageIndex + 1}</span>
      </div>
    );
  };

  const firstBox = cvContentBox(frame, 0, layout, sidebarPct, chromeOptions);

  return (
    <div
      ref={canvasRef}
      className="flex flex-col items-center gap-4"
      data-dossier-document="cv"
      data-cv-template={design.template}
      data-cv-layout={layout}
      data-cv-archetype={frame.id}
      data-cv-photo-position={photoPosition}
      data-cv-info-position={infoPosition}
      data-cv-band-head={frame.headFirstMm > 0 ? "true" : "false"}
      data-export-mode={exportMode ? "true" : "false"}
      style={{
        ["--dossier-font" as string]: design.font
          ? FONT_STACKS[design.font]
          : theme.typography.fontStack,
      }}
      onPointerDown={
        exportMode
          ? undefined
          : (event) => {
              if (!(event.target as HTMLElement).closest("[data-cv-free-section]")) {
                onSelectSection?.(null);
              }
            }
      }
    >
      {/*
        Hidden A4 measurement page. It deliberately uses a separate semantic
        hook instead of data-cv-page so PDF export never mistakes it for a real
        page. Variant CSS mirrors the real main-column geometry onto this box.
      */}
      <div
        aria-hidden
        data-cv-measure-page
        style={{
          position: "absolute",
          left: "-10000px",
          top: 0,
          width: `${PAGE.WIDTH}px`,
          height: `${PAGE.HEIGHT}px`,
          visibility: "hidden",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          ref={measureRef}
          data-cv-main
          style={{
            position: "absolute",
            left: `${firstBox.left}mm`,
            right: `${firstBox.right}mm`,
            top: `${firstBox.top}mm`,
            bottom: `${firstBox.bottom}mm`,
            ["--cv-main-top" as string]: `${firstBox.top}mm`,
            ["--cv-main-bottom" as string]: `${firstBox.bottom}mm`,
            overflow: "visible",
            fontFamily: SHEET_FONT,
          }}
        >
          {rows.map((r) => (
            <div key={r.id} style={{ display: "flow-root" }}>
              {r.node}
            </div>
          ))}
        </div>
      </div>

      {pages.map((page, i) => {
        const box = cvContentBox(frame, i, layout, sidebarPct, chromeOptions);
        return (
          <div
            key={i}
            data-cv-page={i}
            data-cv-paper-color={pal.paper}
            data-cv-text-color={pal.ink}
            className="relative overflow-hidden shadow-2xl"
            style={{ width: `${PAGE.WIDTH}px`, height: `${PAGE.HEIGHT}px`, background: pal.paper }}
          >
            {chrome(i)}
            <DossierHeaderFooterChrome
              scope="cv"
              template={design.template}
              colors={design.colors}
              options={chromeOptions}
              contact={chromeContact}
              pageIndex={i}
              footerLeft={chromeContact.name || "Lebenslauf"}
              footerRight={`Seite ${i + 1}`}
            />
            {layout === "modern" && modernSidebar(i)}
            {bandHeader(i)}
            {footer(i)}
            {elementLayer(i)}
            {freePhoto(i)}
            {freeSections(i)}
            <div
              data-cv-main
              style={{
                position: "absolute",
                left: `${box.left}mm`,
                right: `${box.right}mm`,
                top: `${box.top}mm`,
                bottom: `${box.bottom}mm`,
                ["--cv-main-top" as string]: `${box.top}mm`,
                ["--cv-main-bottom" as string]: `${box.bottom}mm`,
                overflow: "hidden",
                fontFamily: SHEET_FONT,
              }}
            >
              {page.map((r) => (
                <div key={r.id} style={{ display: "flow-root" }}>
                  {r.node}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
