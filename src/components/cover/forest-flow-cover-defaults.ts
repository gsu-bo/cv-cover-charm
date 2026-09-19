import type { StyleOverrides } from "./layouts-base";
import type { Block, BlockStyle, TemplateId } from "./types";

/**
 * Forest Flow used to pin editable cover blocks through late CSS `!important`
 * geometry. That made the template look correct at rest, but it also meant the
 * editor could save a drag/resize override without ever being able to display
 * it. Keep the reviewed composition as normal block defaults instead: reset
 * returns here, while explicit user overrides always remain authoritative.
 */
const FOREST_FLOW_COVER_DEFAULTS: Record<string, Partial<BlockStyle>> = {
  eyebrow: { x: 7, y: 17, w: 38, follows: null, above: null, anchorBottom: false },
  ortDatum: { x: 7, y: 268, w: 38, follows: null, above: null, anchorBottom: false },
  foto: { x: 143, y: 27, follows: null, above: null, anchorBottom: false },
  name: { x: 72, y: 111, w: 112, follows: null, above: null, anchorBottom: false },
  beruf: { x: 72, y: 137, w: 112, follows: null, above: null, anchorBottom: false },
  lehrbeginn: { x: 72, y: 159, w: 112, follows: null, above: null, anchorBottom: false },
  kontaktTitel: { x: 7, y: 192, w: 38, follows: null, above: null, anchorBottom: false },
  kontakt: { x: 7, y: 203, w: 38, follows: null, above: null, anchorBottom: false },
  anTitel: { x: 72, y: 239, w: 112, follows: null, above: null, anchorBottom: false },
  empfaenger: { x: 72, y: 250, w: 112, follows: null, above: null, anchorBottom: false },
};

export function applyForestFlowCoverDefaults(
  template: TemplateId,
  block: Block,
  overrides: StyleOverrides,
): Block {
  if ((template as string) !== "forestFlow") return block;
  const defaults = FOREST_FLOW_COVER_DEFAULTS[block.id];
  if (!defaults) return block;

  const custom = overrides[block.id] ?? {};
  const patch: Partial<BlockStyle> = {};
  for (const [key, value] of Object.entries(defaults) as Array<
    [keyof BlockStyle, BlockStyle[keyof BlockStyle]]
  >) {
    if (custom[key] === undefined) (patch as Record<string, unknown>)[key] = value;
  }

  return { ...block, style: { ...block.style, ...patch } };
}
