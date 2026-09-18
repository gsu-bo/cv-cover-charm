import { forwardRef, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, BlockStyle, CoverData, FontKey, TemplateId } from "./types";
import { CoverBackground } from "./CoverBackground";
import { BlockLayer, type Point } from "./BlockLayer";
import { PAGE } from "@/default-config";
import { dossierDefaultFontKey, effectiveDossierFont } from "@/lib/dossier-theme";
import "./cover-text-color.css";

/** Ganzzahlige Blattmasse – siehe PAGE in default-config. */
const { WIDTH: PAGE_W, HEIGHT: PAGE_H } = PAGE;

export type { Point };
export { crop, photoRadius } from "./BlockLayer";

const DOSSIER_TEXT_IDS = new Set([
  "name",
  "beruf",
  "eyebrow",
  "kicker",
  "kontaktTitel",
  "anTitel",
  "beilagenTitel",
  "ortDatum",
  "lehrbeginn",
  "kontakt",
  "empfaenger",
  "beilagen",
]);

function sharedDossierBlockFont(blocks: Block[]): FontKey | null {
  const fonts = new Set(
    blocks
      .filter((block) => block.kind === "text" && DOSSIER_TEXT_IDS.has(block.id))
      .map((block) => block.style.font),
  );
  if (fonts.size !== 1) return null;
  return [...fonts][0];
}

/**
 * Kontakt + Beilagen are one semantic footer pair. Legacy templates used
 * different default copy (for example "So erreichen Sie mich") and Beilagen
 * carried a colon while Kontakt did not. Normalize the generated defaults at
 * the shared cover boundary so all templates render one convention.
 *
 * A user-supplied Kontakt label remains authoritative.
 */
function normalizedFooterBlocks(blocks: Block[], data: CoverData): Block[] {
  const hasCustomContactLabel = Boolean(data.labelKontakt?.trim());

  return blocks.map((block) => {
    if (block.kind !== "text") return block;

    if (block.id === "kontaktTitel" && !hasCustomContactLabel) {
      return { ...block, lines: ["Kontakt"] };
    }

    if (block.id !== "beilagenTitel") return block;

    let changed = false;
    const lines = block.lines.map((line) => {
      if (typeof line !== "string" || line.trim().toLocaleLowerCase("de-CH") !== "beilagen:") {
        return line;
      }
      changed = true;
      return line.replace(/:\s*$/, "");
    });

    return changed ? { ...block, lines } : block;
  });
}

/**
 * The automatic pair is deliberately opt-out. Dragging Beilagen in the editor
 * clears these links/anchors, after which the user's explicit Y position wins.
 */
function usesAutomaticFooterPair(blocks: Block[]): boolean {
  const title = blocks.find((block) => block.id === "beilagenTitel");
  const body = blocks.find((block) => block.id === "beilagen");
  return Boolean(
    title &&
      body &&
      title.style.above === "beilagen" &&
      !title.style.follows &&
      body.style.anchorBottom === true,
  );
}

type Props = {
  template: TemplateId;
  data: CoverData;
  colors: Record<string, string>;
  blocks: Block[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, patch: Partial<BlockStyle>) => void;
  /** Explizite gemeinsame Dossier-Schrift; null = Vorlage/Familie. */
  fontOverride?: FontKey | null;
  /** Globale Schriftskalierung (1 = Vorlagen-Standard). */
  fontScale?: number;
  editable?: boolean;
  /** Zeichenmodus: Ziehen erzeugt eine Freihandform statt zu verschieben. */
  drawing?: boolean;
  onDrawn?: (points: Point[]) => void;
};

/**
 * Das A4-Titelblatt: Hintergrund der Vorlage, darüber die bedienbare Ebene.
 *
 * Zeichnen, Auswählen und Verschieben stecken in `BlockLayer`, weil der
 * Lebenslauf dieselbe Bedienung braucht.
 */
export const CoverCanvas = forwardRef<HTMLDivElement, Props>(function CoverCanvas(
  { template, data, colors, blocks, selected, onSelect, onMove, fontOverride, ...rest },
  ref,
) {
  const { editable = true, drawing = false, fontScale = 1 } = rest;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const renderBlocks = useMemo(
    () => normalizedFooterBlocks(blocks, data),
    [blocks, data.labelKontakt],
  );
  const automaticFooterPair = usesAutomaticFooterPair(renderBlocks);

  const setCanvasRef = (node: HTMLDivElement | null) => {
    canvasRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  // Fresh cover CSS historically scopes itself through html[data-dossier-template].
  // The visible editor already establishes that route-level scope, but the hidden
  // combined-PDF canvas can be mounted from another route. Keep the actual cover
  // template active while this canvas exists so Edge-Cove do not rasterise as a
  // flat primary-colour page. M14 will remove this global CSS dependency entirely.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.dossierTemplate;
    root.dataset.dossierTemplate = template as string;

    return () => {
      if (previous === undefined) delete root.dataset.dossierTemplate;
      else root.dataset.dossierTemplate = previous;
    };
  }, [template]);

  /*
   * Resolve the final rendered geometry, not only the data-model geometry.
   * A few legacy/Fresh template styles still move Kontakt with late CSS
   * `top`/transform rules (Forest Flow was the visible regression). The earlier
   * resolver-level sync could therefore be correct numerically while the PDF
   * was still visibly misaligned.
   *
   * Kontakt is the visual anchor. In the untouched automatic footer state move
   * the complete Beilagen column by the same render-time delta: its heading lands
   * on the exact Kontakt baseline and the body keeps its intended gap below the
   * heading. This preserves each template's intentional Kontakt placement and
   * also covers future CSS transforms. Explicitly dragged Beilagen opt out via
   * `usesAutomaticFooterPair` above.
   */
  useLayoutEffect(() => {
    if (!automaticFooterPair) return;
    const root = canvasRef.current;
    if (!root) return;

    const contact = root.querySelector<HTMLElement>('[data-block-id="kontaktTitel"]');
    const attachmentsTitle = root.querySelector<HTMLElement>('[data-block-id="beilagenTitel"]');
    const attachmentsBody = root.querySelector<HTMLElement>('[data-block-id="beilagen"]');
    if (!contact || !attachmentsTitle || !attachmentsBody) return;

    const rootRect = root.getBoundingClientRect();
    const scale = rootRect.width > 0 ? rootRect.width / PAGE_W : 1;
    const contactRect = contact.getBoundingClientRect();
    const titleRect = attachmentsTitle.getBoundingClientRect();
    const titleTop = Number.parseFloat(getComputedStyle(attachmentsTitle).top);
    const bodyTop = Number.parseFloat(getComputedStyle(attachmentsBody).top);
    if (!Number.isFinite(titleTop) || !Number.isFinite(bodyTop) || scale <= 0) return;

    const deltaCssPx = (contactRect.top - titleRect.top) / scale;
    const previousTitleTop = attachmentsTitle.style.getPropertyValue("top");
    const previousTitlePriority = attachmentsTitle.style.getPropertyPriority("top");
    const previousBodyTop = attachmentsBody.style.getPropertyValue("top");
    const previousBodyPriority = attachmentsBody.style.getPropertyPriority("top");

    attachmentsTitle.style.setProperty("top", `${titleTop + deltaCssPx}px`, "important");
    attachmentsBody.style.setProperty("top", `${bodyTop + deltaCssPx}px`, "important");

    return () => {
      if (previousTitleTop) {
        attachmentsTitle.style.setProperty("top", previousTitleTop, previousTitlePriority);
      } else {
        attachmentsTitle.style.removeProperty("top");
      }
      if (previousBodyTop) {
        attachmentsBody.style.setProperty("top", previousBodyTop, previousBodyPriority);
      } else {
        attachmentsBody.style.removeProperty("top");
      }
    };
  }, [automaticFooterPair, fontScale, renderBlocks, template]);

  // Die Titelblatt-Route trägt eine bewusst gewählte globale Schrift bereits
  // in alle Standardblöcke ein. Ein von der Familienvorgabe abweichender
  // gemeinsamer Block-Font ist deshalb der laufende Dossier-Override. Ohne
  // Override entscheidet ausschliesslich die zentrale Dossier-Familie.
  const liveFont = sharedDossierBlockFont(renderBlocks);
  const inferredOverride =
    liveFont && liveFont !== dossierDefaultFontKey(template) ? liveFont : null;
  const resolvedOverride = fontOverride === undefined ? inferredOverride : fontOverride;
  const dossierFont = effectiveDossierFont(template, resolvedOverride);
  const paper = colors.coverPaper || colors.bg || "#ffffff";
  const primary = colors.primary ?? colors.accent ?? colors.ink ?? paper;
  const secondary = colors.secondary ?? colors.accent ?? primary;
  const accent = colors.accent ?? secondary;
  const ink = colors.ink ?? "#111111";
  const coverTextOverride = colors.coverInk || "";

  return (
    <div
      ref={setCanvasRef}
      data-dossier-document="cover"
      data-cover-template={template}
      data-cover-text-override={coverTextOverride ? "true" : undefined}
      data-dossier-font-source={resolvedOverride ? "override" : "family"}
      data-dossier-footer-sync={automaticFooterPair ? "automatic" : "manual"}
      className="relative overflow-hidden shadow-2xl"
      style={{
        width: `${PAGE_W}px`,
        height: `${PAGE_H}px`,
        backgroundColor: paper,
        ["--dossier-font" as string]: dossierFont,
        // Palette roles live on the common cover ancestor so acceptance CSS can
        // repair contrast without freezing a template to one hard-coded colour.
        ["--cover-paper" as string]: paper,
        ["--cover-primary" as string]: primary,
        ["--cover-secondary" as string]: secondary,
        ["--cover-accent" as string]: accent,
        ["--cover-ink" as string]: ink,
        ["--cover-text-override" as string]: coverTextOverride || ink,
        // Photo initials are not a semantic text role, but still belong to the
        // dossier type system. Keep one unshadowed token for that renderer edge.
        ["--dossier-resolved-font" as string]: dossierFont,
      }}
      onPointerDown={(e) => {
        if (drawing) return;
        if (editable && !(e.target as HTMLElement).closest("[data-block-id]")) {
          onSelect(null);
        }
      }}
    >
      <CoverBackground template={template} colors={colors} />
      <BlockLayer
        blocks={renderBlocks}
        colors={colors}
        selected={selected}
        onSelect={onSelect}
        onMove={onMove}
        dossierFont={dossierFont}
        data={data}
        {...rest}
      />
    </div>
  );
});
