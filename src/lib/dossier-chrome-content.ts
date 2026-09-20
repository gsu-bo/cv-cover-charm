import type { DossierChromeOptions } from "@/lib/dossier-chrome";

export type DossierChromeDocumentContentSettings = {
  headerTitleEnabled?: boolean;
  headerTitle?: string;
  headerTextEnabled?: boolean;
  headerText?: string;
  footerTitleEnabled?: boolean;
  footerTitle?: string;
  footerTextEnabled?: boolean;
  footerText?: string;
};

export type DossierChromeDocumentContent = {
  headerTitle?: string;
  headerText?: string;
  footerTitle?: string;
  footerText?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

export function normalizeDossierChromeDocumentContentSettings(
  value: unknown,
): DossierChromeDocumentContentSettings | undefined {
  if (!isRecord(value)) return undefined;
  const next: DossierChromeDocumentContentSettings = {
    headerTitleEnabled: value.headerTitleEnabled === true,
    headerTitle: cleanText(value.headerTitle, 120),
    headerTextEnabled: value.headerTextEnabled === true,
    headerText: cleanText(value.headerText, 240),
    footerTitleEnabled: value.footerTitleEnabled === true,
    footerTitle: cleanText(value.footerTitle, 120),
    footerTextEnabled: value.footerTextEnabled === true,
    footerText: cleanText(value.footerText, 240),
  };
  return next;
}

export function resolveDossierChromeDocumentContent(
  value: DossierChromeDocumentContentSettings | undefined,
  defaultTitle: string,
): DossierChromeDocumentContent {
  const fallbackTitle = defaultTitle.trim();
  return {
    headerTitle: value?.headerTitleEnabled
      ? cleanText(value.headerTitle, 120) ?? fallbackTitle || undefined
      : undefined,
    headerText: value?.headerTextEnabled ? cleanText(value.headerText, 240) : undefined,
    footerTitle: value?.footerTitleEnabled
      ? cleanText(value.footerTitle, 120) ?? fallbackTitle || undefined
      : undefined,
    footerText: value?.footerTextEnabled ? cleanText(value.footerText, 240) : undefined,
  };
}

/**
 * Content can make an automatic header taller, but never overwrites an explicit
 * user height. This keeps geometry predictable and preserves "user override wins".
 */
export function withDossierChromeDocumentContent(
  options: DossierChromeOptions,
  content: DossierChromeDocumentContent | undefined,
): DossierChromeOptions {
  if (options.headerMode === "none" || options.headerHeightMm !== null) return options;

  const hasTitle = !!content?.headerTitle?.trim();
  const hasText = !!content?.headerText?.trim();
  if (!hasTitle && !hasText) return options;

  const baseHeight =
    options.headerMode === "contact"
      ? options.headerTextLayout === "inline"
        ? 26
        : 32
      : 4;
  const automaticHeight = baseHeight + (hasTitle ? 5 : 0) + (hasText ? 4 : 0);

  return { ...options, headerHeightMm: automaticHeight };
}
