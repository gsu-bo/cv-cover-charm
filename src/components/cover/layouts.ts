import { DEFAULTS } from "@/default-config";
import { dossierDefaultFontKey } from "@/lib/dossier-theme";
import type { Block, BlockStyle, ColorSlot, CoverData, CustomField, TemplateId } from "./types";
import { coverAttachmentValues } from "./types";
import { buildBlocks as buildBaseBlocks } from "./layouts-base";
import type { StyleOverrides } from "./layouts-base";
import { isFreshTemplate } from "./fresh-templates";
import { templateDecorations } from "./template-decorations";
import { applyForestFlowCoverDefaults } from "./forest-flow-cover-defaults";
import "./editable-decorations.css";
import "./fresh-cover-visual-cleanup.css";
import "./template-typography-fixes.css";
import "./edel-dark.css";

// Keep the established layout catalogue in a stable base module. Simple visual
// primitives live exactly once as editor blocks in template-decorations.ts;
// CoverBackground is reserved for structural masks, frames and page surfaces.
export * from "./layouts-base";

const MODERN_TOP_CLUSTER_OFFSET_MM = 6;
const COVER_BEILAGEN_RIGHT_X_MM = 110;
const COVER_BEILAGEN_WIDTH_MM = 80;
const COVER_BEILAGEN_MAX_BOTTOM_MM = 276;

const EDITORIAL_HEADING_IDS = new Set(["eyebrow", "kicker", "kontaktTitel", "anTitel"]);

function setDefaultStyle<K extends keyof BlockStyle>(
  patch: Partial<BlockStyle>,
  blockOverrides: Partial<BlockStyle>,
  key: K,
  value: BlockStyle[K],
) {
  if (blockOverrides[key] === undefined) patch[key] = value;
}

/**
 * Visual defaults that need to be applied after the legacy layout catalogue.
 * Explicit per-element edits always win; this only corrects template defaults.
 */
function typographyDefaultPatch(
  template: TemplateId,
  block: Block,
  overrides: StyleOverrides,
): Partial<BlockStyle> {
  const patch: Partial<BlockStyle> = {};
  const blockOverrides = overrides[block.id] ?? {};

  // Fresh templates currently reuse proven legacy geometry, but typography must
  // come from their real dossier family rather than the old Warm/sans fallback.
  if (isFreshTemplate(template)) {
    setDefaultStyle(patch, blockOverrides, "font", dossierDefaultFontKey(template));
  }

  // 02 Editorial deliberately uses one restrained serif system. Keep the
  // profession as the single italic display accent; everything around it is a
  // quieter roman hierarchy rather than a mix of caps, italics and wide tracking.
  if (template === "klassisch") {
    if (EDITORIAL_HEADING_IDS.has(block.id)) {
      setDefaultStyle(patch, blockOverrides, "uppercase", false);
      setDefaultStyle(patch, blockOverrides, "weight", 600);
      setDefaultStyle(patch, blockOverrides, "tracking", 0.04);
    }

    if (block.id === "ortDatum") {
      setDefaultStyle(patch, blockOverrides, "italic", false);
      setDefaultStyle(patch, blockOverrides, "tracking", 0);
    }

    if (block.id === "beruf") {
      setDefaultStyle(patch, blockOverrides, "italic", true);
      setDefaultStyle(patch, blockOverrides, "weight", 600);
      setDefaultStyle(patch, blockOverrides, "tracking", 0);
    }

    if (block.id === "name") {
      setDefaultStyle(patch, blockOverrides, "weight", 700);
      setDefaultStyle(patch, blockOverrides, "tracking", -0.01);
    }

    if (block.id === "lehrbeginn") {
      setDefaultStyle(patch, blockOverrides, "italic", false);
      setDefaultStyle(patch, blockOverrides, "tracking", 0);
    }
  }

  return patch;
}

function templateDefaultAdjustment(
  template: TemplateId,
  block: Block,
  overrides: StyleOverrides,
): Block {
  let adjusted = block;
  const typographyPatch = typographyDefaultPatch(template, block, overrides);
  if (Object.keys(typographyPatch).length > 0) {
    adjusted = { ...adjusted, style: { ...adjusted.style, ...typographyPatch } };
  }
  adjusted = applyForestFlowCoverDefaults(template, adjusted, overrides);

  // Brief intentionally reuses Modern's base geometry. Keep the document label
  // on the same corrected 20mm left margin as Modern unless the user moved it.
  if (
    (template === "modern" || (template as string) === "brief") &&
    block.id === "eyebrow" &&
    overrides[block.id]?.x === undefined
  ) {
    adjusted = { ...adjusted, style: { ...adjusted.style, x: 20 } };
  }

  if (template === "modern") {
    if (
      (block.id === "foto" || block.id === "modernAccentCircle") &&
      overrides[block.id]?.y === undefined
    ) {
      adjusted = {
        ...adjusted,
        style: { ...adjusted.style, y: adjusted.style.y + MODERN_TOP_CLUSTER_OFFSET_MM },
      };
    }
  }

  // Sonne used to stop its lower information cluster around 196mm, leaving a
  // large accidental empty area below it. Match the rest of the catalogue:
  // contact sits on the shared print-safe lower anchor and Beilagen inherits
  // the same anchor from the contact block. Explicit user moves still win.
  if (template === "sonne" && block.id === "kontakt" && overrides[block.id]?.y === undefined) {
    adjusted = {
      ...adjusted,
      style: { ...adjusted.style, y: COVER_BEILAGEN_MAX_BOTTOM_MM, anchorBottom: true },
    };
  }

  // Studio had split one semantic phrase across two unrelated zones: the
  // profession lived in the yellow band while "Bewerbung um eine Lehrstelle
  // als" floated much lower on the white page. Keep the application statement
  // together inside the band, then give the applicant name its own clear level
  // below. These are defaults only; explicit editor moves still win.
  if (template === "studio") {
    const custom = overrides[block.id] ?? {};
    const withDefaults = (patch: Partial<BlockStyle>) => {
      const next: Partial<BlockStyle> = {};
      for (const [key, value] of Object.entries(patch) as Array<
        [keyof BlockStyle, BlockStyle[keyof BlockStyle]]
      >) {
        if (custom[key] === undefined) (next as Record<string, unknown>)[key] = value;
      }
      adjusted = { ...adjusted, style: { ...adjusted.style, ...next } };
    };

    if (block.id === "kicker") {
      withDefaults({
        x: 84,
        y: 31,
        w: 100,
        size: 8.5,
        color: "primary",
        uppercase: true,
        weight: 700,
        tracking: 0.18,
        lineHeight: 1.15,
        follows: null,
        above: null,
        anchorBottom: false,
        maxLines: 2,
      });
    } else if (block.id === "beruf") {
      withDefaults({
        x: 84,
        y: 40,
        w: 100,
        size: 18,
        color: "ink",
        weight: 700,
        tracking: 0.04,
        lineHeight: 1.08,
        follows: null,
        above: null,
        anchorBottom: false,
        maxLines: 2,
      });
    } else if (block.id === "name") {
      withDefaults({
        x: 84,
        y: 72,
        w: 100,
        size: 22,
        color: "ink",
        weight: 800,
        uppercase: true,
        tracking: 0.02,
        lineHeight: 1.05,
        follows: null,
        above: null,
        anchorBottom: false,
      });
    } else if (block.id === "lehrbeginn") {
      withDefaults({
        x: 84,
        y: 88,
        w: 100,
        size: 10,
        color: "ink",
        weight: 700,
        bg: "accent",
        padX: 5,
        padY: 1.8,
        follows: null,
        above: null,
        anchorBottom: false,
      });
    } else if (block.id === "ortDatum") {
      withDefaults({
        x: 84,
        y: 104,
        w: 100,
        size: 9,
        color: "ink",
        opacity: 0.6,
        follows: null,
        above: null,
        anchorBottom: false,
      });
    }
  }

  if ((template === "blockig" || template === "colorful") && block.id === "kicker") {
    adjusted = {
      ...adjusted,
      style: {
        ...adjusted.style,
        ...(overrides[block.id]?.w === undefined ? { w: 174 } : {}),
        ...(overrides[block.id]?.maxLines === undefined ? { maxLines: 1 } : {}),
      },
    };
  }

  // Blockig is a true modular grid rather than a full-width stripe with loose
  // content underneath. Every default remains an ordinary editor block: a user
  // move/resize/color override always wins over these starting coordinates.
  if (template === "blockig") {
    const custom = overrides[block.id] ?? {};
    const withDefaults = (patch: Partial<BlockStyle>) => {
      const next: Partial<BlockStyle> = {};
      for (const [key, value] of Object.entries(patch) as Array<
        [keyof BlockStyle, BlockStyle[keyof BlockStyle]]
      >) {
        if (custom[key] === undefined) (next as Record<string, unknown>)[key] = value;
      }
      adjusted = { ...adjusted, style: { ...adjusted.style, ...next } };
    };

    if (block.id === "decor-top-block") {
      withDefaults({ x: 0, y: 0, w: 72, ratio: 105 / 72, opacity: 1 });
    } else if (block.id === "decor-accent-band") {
      withDefaults({ x: 72, y: 0, w: 44, ratio: 52 / 44, opacity: 1 });
    } else if (block.id === "eyebrow") {
      withDefaults({ x: 15, y: 17, w: 44, size: 9, color: "bg", tracking: 0.28 });
    } else if (block.id === "ortDatum") {
      withDefaults({ x: 126, y: 18, w: 66, size: 9, color: "ink", align: "right" });
    } else if (block.id === "foto") {
      withDefaults({ x: 132, y: 38, w: 48, ratio: 1, radius: 0, color: "accent" });
    } else if (block.id === "kicker") {
      withDefaults({ x: 86, y: 96, w: 104, size: 9, color: "accent", tracking: 0.18 });
    } else if (block.id === "beruf") {
      withDefaults({
        x: 86,
        y: 106,
        w: 108,
        size: 29,
        color: "ink",
        weight: 800,
        uppercase: true,
        tracking: -0.025,
        lineHeight: 1.02,
      });
    } else if (block.id === "name") {
      withDefaults({
        x: 86,
        y: 164,
        w: 104,
        size: 15,
        color: "primary",
        weight: 800,
        uppercase: true,
        tracking: 0.1,
      });
    } else if (block.id === "lehrbeginn") {
      withDefaults({ x: 86, y: 176, w: 104, size: 9.5, color: "ink", weight: 600 });
    } else if (block.id === "kontaktTitel") {
      withDefaults({ x: 15, w: 48, color: "accent", tracking: 0.22 });
    } else if (block.id === "kontakt") {
      withDefaults({ x: 15, y: 283, w: 48, color: "bg", opacity: 0.95, lineHeight: 1.45 });
    } else if (block.id === "trenner") {
      withDefaults({ hidden: true });
    }
  }

  // Human used to look like unrelated legacy blocks dropped onto two giant
  // circles. Keep every user override intact, but give untouched blocks a
  // deliberate two-column hero, a stable title hierarchy and a calmer lower
  // information area. The profession follows the application kicker so long
  // copy can never collide with it.
  if (template === "human") {
    const custom = overrides[block.id] ?? {};

    if (block.id === "eyebrow") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 20 } : {}),
          ...(custom.y === undefined ? { y: 18 } : {}),
          ...(custom.w === undefined ? { w: 104 } : {}),
          ...(custom.size === undefined ? { size: 9.5 } : {}),
          ...(custom.weight === undefined ? { weight: 500 } : {}),
          ...(custom.tracking === undefined ? { tracking: 0.01 } : {}),
        },
      };
    }

    if (block.id === "ortDatum") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 120 } : {}),
          ...(custom.y === undefined ? { y: 18 } : {}),
          ...(custom.w === undefined ? { w: 70 } : {}),
          ...(custom.size === undefined ? { size: 9 } : {}),
        },
      };
    }

    if (block.id === "foto") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 22 } : {}),
          ...(custom.y === undefined ? { y: 46 } : {}),
          ...(custom.w === undefined ? { w: 46 } : {}),
          ...(custom.font === undefined ? { font: "freundlich" as const } : {}),
          ...(custom.fill === undefined ? { fill: "bg" } : {}),
        },
      };
    }

    if (block.id === "kicker") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 80 } : {}),
          ...(custom.y === undefined ? { y: 50 } : {}),
          ...(custom.w === undefined ? { w: 108 } : {}),
          ...(custom.size === undefined ? { size: 8.5 } : {}),
          ...(custom.weight === undefined ? { weight: 700 } : {}),
          ...(custom.tracking === undefined ? { tracking: 0.12 } : {}),
          ...(custom.lineHeight === undefined ? { lineHeight: 1.18 } : {}),
          ...(custom.maxLines === undefined ? { maxLines: 2 } : {}),
        },
      };
    }

    if (block.id === "beruf") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 80 } : {}),
          ...(custom.w === undefined ? { w: 108 } : {}),
          ...(custom.size === undefined ? { size: 26 } : {}),
          ...(custom.weight === undefined ? { weight: 700 } : {}),
          ...(custom.italic === undefined ? { italic: false } : {}),
          ...(custom.lineHeight === undefined ? { lineHeight: 1.04 } : {}),
          ...(custom.follows === undefined ? { follows: "kicker" } : {}),
          ...(custom.gap === undefined ? { gap: 2.2 } : {}),
        },
      };
    }

    if (block.id === "name") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 20 } : {}),
          ...(custom.y === undefined ? { y: 116 } : {}),
          ...(custom.w === undefined ? { w: 170 } : {}),
          ...(custom.size === undefined ? { size: 18.5 } : {}),
          ...(custom.weight === undefined ? { weight: 700 } : {}),
          ...(custom.tracking === undefined ? { tracking: -0.015 } : {}),
        },
      };
    }

    if (block.id === "lehrbeginn") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 20 } : {}),
          ...(custom.w === undefined ? { w: 165 } : {}),
          ...(custom.size === undefined ? { size: 9.5 } : {}),
          ...(custom.follows === undefined ? { follows: "name" } : {}),
          ...(custom.gap === undefined ? { gap: 1.6 } : {}),
        },
      };
    }

    if (block.id === "kontaktTitel" || block.id === "kontakt") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 20 } : {}),
          ...(custom.w === undefined ? { w: 82 } : {}),
        },
      };
    }

    if (block.id === "kontakt" && custom.y === undefined) {
      adjusted = { ...adjusted, style: { ...adjusted.style, y: 282 } };
    }

    if (block.id === "anTitel" || block.id === "empfaenger") {
      adjusted = {
        ...adjusted,
        style: {
          ...adjusted.style,
          ...(custom.x === undefined ? { x: 110 } : {}),
          ...(custom.w === undefined ? { w: 80 } : {}),
        },
      };
    }
  }

  return adjusted;
}

/**
 * Templates 21-38 were originally registered after the legacy layout switch
 * and therefore fell through to the old Warm content schema. That leaked stale
 * eyebrow copy from another design and placed the complete application kicker
 * plus profession on one flowing line.
 *
 * Keep the proven geometry for now, but give every Fresh cover one explicit
 * content contract:
 * - the top label is the stable document label "Bewerbung";
 * - application kicker and profession are separate logical lines inside the
 *   existing `beruf` block, so all template-specific transforms remain valid;
 * - the profession keeps its accent colour/weight without allowing `ALS` to
 *   flow behind the profession title.
 *
 * User data is not mutated. Switching back to a legacy template still restores
 * a custom eyebrow exactly as entered.
 */
function freshContentAdjustment(template: TemplateId, data: CoverData, block: Block): Block {
  if (!isFreshTemplate(template)) return block;

  if (block.id === "eyebrow") {
    return {
      ...block,
      lines: ["Bewerbung"],
      style: { ...block.style, maxLines: 1 },
    };
  }

  if (block.id === "beruf") {
    if (!data.beruf.trim()) return { ...block, lines: [] };
    const kicker = data.kicker.trim() || DEFAULTS.KICKER;
    return {
      ...block,
      lines: [kicker, [{ t: data.beruf, color: "primary", weight: 700 }]],
      style: {
        ...block.style,
        maxLines: Math.max(3, block.style.maxLines ?? 0),
        lineHeight: Math.max(1.2, block.style.lineHeight),
      },
    };
  }

  return block;
}

export function buildBlocks(
  template: TemplateId,
  data: CoverData,
  customs: CustomField[],
  overrides: StyleOverrides,
  slots: ColorSlot[],
): Block[] {
  // Edel Dark is a colour/surface variant, not a second geometry. Reuse the
  // established Edel composition so both designs stay aligned as the editor
  // evolves, while keeping their palettes and interior-page contracts separate.
  const layoutTemplate = (template as string) === "edelDark" ? ("edel" as TemplateId) : template;
  const blocks = buildBaseBlocks(layoutTemplate, data, customs, overrides, slots).map((block) =>
    freshContentAdjustment(
      template,
      data,
      templateDefaultAdjustment(template, block, overrides),
    ),
  );
  const decorations = templateDecorations(layoutTemplate, overrides).map((block) =>
    templateDefaultAdjustment(template, block, overrides),
  );

  const companyVisible = data.showBetriebOnCover === true;
  const beilagen = coverAttachmentValues(data).filter((value) => value.trim());
  const beilagenVisible = data.showBeilagenOnCover !== false && beilagen.length > 0;

  // Ausblenden entfernt nur die Darstellung. Die Firmendaten bleiben im
  // Titelblatt gespeichert und stehen weiterhin für das Motivationsschreiben
  // zur Übernahme bereit.
  const contentBlocks = blocks.map((block) =>
    !companyVisible && (block.id === "anTitel" || block.id === "empfaenger")
      ? { ...block, lines: [] }
      : block,
  );

  if (beilagenVisible) {
    const contactBody = blocks.find((block) => block.id === "kontakt");
    const recipientTitle = blocks.find((block) => block.id === "anTitel");
    const recipientBody = blocks.find((block) => block.id === "empfaenger");

    if (recipientTitle && recipientBody) {
      const titleBase = companyVisible
        ? {
            ...recipientTitle.style,
            above: "beilagen",
            follows: null,
            anchorBottom: false,
            gap: 1.5,
            uppercase: false,
            weight: Math.max(600, recipientTitle.style.weight),
          }
        : {
            ...recipientTitle.style,
            x: COVER_BEILAGEN_RIGHT_X_MM,
            w: COVER_BEILAGEN_WIDTH_MM,
            align: "right" as const,
            above: "beilagen",
            follows: null,
            anchorBottom: false,
            gap: 1.5,
            uppercase: false,
            weight: Math.max(600, recipientTitle.style.weight),
          };
      const bodyBase = companyVisible
        ? {
            ...recipientBody.style,
            above: "anTitel",
            follows: null,
            anchorBottom: false,
            gap: 2,
          }
        : {
            ...recipientBody.style,
            // Kolumne keeps its recipient text white because it normally lives
            // on the dark sidebar. Attachments move to the light bottom-right
            // page area, so their default must switch back to readable ink.
            ...(template === "terracotta" ? { color: "ink" } : {}),
            // If the company is hidden, the old recipient chain no longer has
            // a lower anchor. Without an explicit replacement the base `y=20`
            // leaks through and puts Beilagen beside the date/photo. Keep the
            // optional cover attachments in their own stable bottom-right slot,
            // aligned with the contact block where possible but capped at the
            // established print-safe lower edge.
            x: COVER_BEILAGEN_RIGHT_X_MM,
            w: COVER_BEILAGEN_WIDTH_MM,
            y: Math.min(
              contactBody?.style.anchorBottom === true
                ? contactBody.style.y
                : COVER_BEILAGEN_MAX_BOTTOM_MM,
              COVER_BEILAGEN_MAX_BOTTOM_MM,
            ),
            align: "right" as const,
            follows: null,
            above: null,
            anchorBottom: true,
          };
      const titleOverride = overrides.beilagenTitel ?? {};
      const bodyOverride = overrides.beilagen ?? {};

      contentBlocks.push(
        {
          id: "beilagenTitel",
          label: "Titel Beilagen",
          kind: "text",
          lines: ["Beilagen:"],
          style: {
            ...titleBase,
            ...titleOverride,
            weight: Math.max(600, titleOverride.weight ?? titleBase.weight),
          },
        },
        {
          id: "beilagen",
          label: "Beilagen",
          kind: "text",
          lines: beilagen,
          style: { ...bodyBase, ...bodyOverride },
        },
      );
    }
  }

  // Decorations render first so text/photos/custom content remain above them.
  // They are normal shape blocks, so BlockLayer + ElementBar own dragging,
  // resizing, colours, opacity, reset and removal without a background twin.
  return [...decorations, ...contentBlocks];
}
