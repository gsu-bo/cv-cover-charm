import type { LetterDesign } from "./types";

export type LetterPaginationPageContext = {
  pageIndex: number;
  finalPage: boolean;
};

/**
 * Internal, non-persisted bridge between the document paginator and the
 * established single-page LetterCanvas geometry. Symbols survive object
 * spreads but are ignored by JSON.stringify, so saved LetterDesign snapshots
 * remain unchanged.
 */
const LETTER_PAGE_CONTEXT = Symbol("letter-pagination-page-context");

type ContextualLetterDesign = LetterDesign & {
  [LETTER_PAGE_CONTEXT]?: LetterPaginationPageContext;
};

export function withLetterPaginationPageContext(
  design: LetterDesign,
  context: LetterPaginationPageContext,
): LetterDesign {
  return Object.assign({}, design, { [LETTER_PAGE_CONTEXT]: context }) as LetterDesign;
}

export function letterPaginationPageContext(
  design: LetterDesign,
): LetterPaginationPageContext | null {
  const value = (design as ContextualLetterDesign)[LETTER_PAGE_CONTEXT];
  if (!value) return null;
  return {
    pageIndex: Math.max(0, Math.trunc(value.pageIndex)),
    finalPage: value.finalPage,
  };
}
