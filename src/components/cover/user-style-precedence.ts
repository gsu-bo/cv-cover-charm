import type { Block, BlockStyle } from "./types";

/**
 * Render-only metadata describing which block style keys came from the saved
 * per-element override bucket. It is deliberately not part of BlockStyle and
 * therefore never enters JSON persistence or migrations.
 */
export type UserStyledBlock = Block & {
  userStyleKeys?: readonly (keyof BlockStyle)[];
};

export function withUserStyleKeys(
  block: Block,
  override: Partial<BlockStyle> | undefined,
): UserStyledBlock {
  const keys = override ? (Object.keys(override) as (keyof BlockStyle)[]) : [];
  return keys.length > 0 ? { ...block, userStyleKeys: keys } : block;
}

export function hasUserStyle(block: Block, key: keyof BlockStyle): boolean {
  return ((block as UserStyledBlock).userStyleKeys ?? []).includes(key);
}
