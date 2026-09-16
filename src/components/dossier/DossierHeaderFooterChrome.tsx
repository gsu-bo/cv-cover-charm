import { Mail, Smartphone } from "lucide-react";
import { FONT_STACKS } from "@/components/cover/types";
import { cvPalette, onColorRoles } from "@/components/cv/palette";
import {
  dossierFooterVisualHeightMmForOptions,
  dossierHeaderVisualHeightMmForOptions,
  type DossierChromeContact,
  type DossierChromeInlineSeparator,
  type DossierChromeOptions,
  type DossierChromeScope,
} from "@/lib/dossier-chrome";
import { resolveTemplateChromeOptions } from "@/lib/template-chrome";
import "./chrome-policy.css";

function surfaceBackground(first: string, second: string | null): string {
  return second ? `linear-gradient(90deg, ${first}, ${second})` : first;
}

function normalizedHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const color = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(color) ? color : null;
}

function automaticBorderColor({
  colors,
  headerBackground,
  headerGradient,
  footerBackground,
  footerGradient,
  palette,
}: {
  colors: Record<string, string>;
  headerBackground: string;
  headerGradient: string | null;
  footerBackground: string;
  footerGradient: string | null;
  palette: ReturnType<typeof cvPalette>;
}): string {
  const occupied = new Set(
    [headerBackground, headerGradient, footerBackground, footerGradient]
      .map(normalizedHex)
      .filter((value): value is string => value !== null),
  );
  const candidates = [
    colors.cvHeading,
    colors.accent,
    colors.secondary,
    colors.primary,
    palette.accent,
    palette.ink,
    palette.muted,
    "#94a3b8",
    "#cbd5e1",
  ];
  for (const candidate of candidates) {
    const normalized = normalizedHex(candidate);
    if (normalized && !occupied.has(normalized)) return normalized;
  }
  return "#94a3b8";
}

type ContactRow = {
  key: "name" | "address" | "place" | "phone" | "email";
  value: string;
  strong: boolean;
};

function InlineContactSeparator({
  style,
  rowKey,
  index,
  compact = false,
}: {
  style: DossierChromeInlineSeparator;
  rowKey: ContactRow["key"];
  index: number;
  compact?: boolean;
}) {
  if (style === "icons" && (rowKey === "phone" || rowKey === "email")) {
    const Icon = rowKey === "phone" ? Smartphone : Mail;
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center"
        style={{
          marginLeft: index ? (compact ? "1mm" : "1.5mm") : 0,
          marginRight: compact ? "0.7mm" : "0.9mm",
          color: "#ffffff",
          opacity: 0.94,
        }}
      >
        <Icon
          style={{ width: compact ? "2.5mm" : "3mm", height: compact ? "2.5mm" : "3mm" }}
          strokeWidth={1.7}
        />
      </span>
    );
  }

  if (index === 0) return null;

  if (style === "space") {
    return (
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{ width: compact ? "3.5ch" : "5ch" }}
      />
    );
  }

  const symbol = style === "slash" ? "/" : style === "pipe" ? "|" : "·";
  return (
    <span
      aria-hidden="true"
      className="shrink-0"
      style={{
        marginInline: compact ? "1.05mm" : "1.5mm",
        opacity: style === "pipe" ? 0.45 : 0.58,
      }}
    >
      {symbol}
    </span>
  );
}

export function DossierHeaderFooterChrome({
  scope,
  template,
  colors,
  contact,
  pageIndex = 0,
  options,
  footerHeightMm,
  footerLabel,
  footerDetails = [],
  footerLeft,
  footerRight,
}: {
  scope: DossierChromeScope;
  template: string;
  colors: Record<string, string>;
  contact: DossierChromeContact;
  pageIndex?: number;
  options: DossierChromeOptions;
  footerHeightMm?: number;
  footerLabel?: string;
  footerDetails?: string[];
  footerLeft?: string;
  footerRight?: string;
}) {
  const resolvedContact = contact;
  // Contact-mode template gradients must render identically in motivation
  // letter and CV. Compact snapshots stay untouched here: their document-level
  // resolver (not this generic shared renderer) owns special treatments such as
  // Modern's mirrored dark/pink pair, so explicit chrome snapshots remain authoritative.
  const visualOptions =
    options.headerMode === "contact"
      ? resolveTemplateChromeOptions(template, colors, options)
      : options;
  const headerMode = options.headerMode;
  const continuationContact = pageIndex > 0 && headerMode === "contact";
  const sourcePalette = cvPalette(colors);
  const primary =
    template === "brief"
      ? "#111111"
      : (colors.primary ?? colors.accent ?? colors.secondary ?? sourcePalette.accent);
  const secondary =
    template === "brief" ? "#4b5563" : (colors.accent ?? colors.secondary ?? sourcePalette.accent);
  const headerBackground = visualOptions.headerBackgroundColor ?? primary;
  const footerBackground = visualOptions.footerBackgroundColor ?? secondary;
  const headerRoles = onColorRoles(headerBackground, visualOptions.headerGradientColor ?? secondary);
  const footerRoles = onColorRoles(footerBackground, visualOptions.footerGradientColor ?? primary);
  const headerSurface = surfaceBackground(headerBackground, visualOptions.headerGradientColor);
  const footerSurface = surfaceBackground(footerBackground, visualOptions.footerGradientColor);
  const borderColor =
    visualOptions.borderColor ??
    automaticBorderColor({
      colors,
      headerBackground,
      headerGradient: visualOptions.headerGradientColor,
      footerBackground,
      footerGradient: visualOptions.footerGradientColor,
      palette: sourcePalette,
    });
  const borderStyle = visualOptions.borderEnabled
    ? `${visualOptions.borderWidthMm}mm solid ${borderColor}`
    : undefined;
  const textFontFamily = visualOptions.textFont ? FONT_STACKS[visualOptions.textFont] : undefined;
  const headerVisualHeight = dossierHeaderVisualHeightMmForOptions(options, pageIndex);
  const compactFooterHeight = dossierFooterVisualHeightMmForOptions(options);
  const detailsHeight = options.footerHeightMm ?? footerHeightMm ?? 10;
  const letter = scope === "letter";
  const warmLetterOwnsFirstPageHeader =
    letter && template === "freundlich" && pageIndex === 0 && headerMode === "compact";
  const resolvedFooterLeft = footerLeft;
  const cvPageNumberFooter =
    scope === "cv" && footerRight ? /^seite\s+\d+$/i.test(footerRight.trim()) : false;
  const resolvedFooterRight = cvPageNumberFooter ? undefined : footerRight;
  const contactRows = [
    options.headerShowName && resolvedContact.name
      ? { key: "name", value: resolvedContact.name, strong: true }
      : null,
    options.headerShowAddress && resolvedContact.address
      ? { key: "address", value: resolvedContact.address, strong: false }
      : null,
    options.headerShowAddress && resolvedContact.place
      ? { key: "place", value: resolvedContact.place, strong: false }
      : null,
    options.headerShowPhone && resolvedContact.phone
      ? { key: "phone", value: resolvedContact.phone, strong: false }
      : null,
    options.headerShowEmail && resolvedContact.email
      ? { key: "email", value: resolvedContact.email, strong: false }
      : null,
  ].filter((row): row is ContactRow => row !== null);
  const continuationRows = [
    options.headerShowName && resolvedContact.name
      ? { key: "name", value: resolvedContact.name, strong: true }
      : null,
    options.headerShowAddress && resolvedContact.place
      ? { key: "place", value: resolvedContact.place, strong: false }
      : null,
    options.headerShowPhone && resolvedContact.phone
      ? { key: "phone", value: resolvedContact.phone, strong: false }
      : null,
    options.headerShowEmail && resolvedContact.email
      ? { key: "email", value: resolvedContact.email, strong: false }
      : null,
  ].filter((row): row is ContactRow => row !== null);
  const footerValues = [resolvedFooterLeft, resolvedFooterRight].filter(
    (value): value is string => !!value?.trim(),
  );
  const stackedHeader = options.headerTextLayout === "stacked";
  const inlineSeparator = options.headerInlineSeparator ?? "icons";
  const headerContentOffsetY = options.headerContentOffsetYMm ?? 0;
  const footerContentOffsetY = options.footerContentOffsetYMm ?? 0;
  const headerContentTransform =
    headerContentOffsetY === 0 ? undefined : `translateY(${headerContentOffsetY}mm)`;
  const footerContentTransform =
    footerContentOffsetY === 0 ? undefined : `translateY(${footerContentOffsetY}mm)`;

  return (
    <div
      data-dossier-chrome={scope}
      data-dossier-header-mode={headerMode}
      data-dossier-footer-mode={options.footerMode}
      data-dossier-header-text-layout={options.headerTextLayout}
      data-dossier-header-inline-separator={inlineSeparator}
      data-dossier-footer-text-layout={options.footerTextLayout}
      data-dossier-border-enabled={visualOptions.borderEnabled ? "true" : "false"}
      data-dossier-border-color={borderColor}
      data-dossier-border-width-mm={visualOptions.borderWidthMm}
      data-dossier-chrome-font={visualOptions.textFont ?? "template"}
      data-letter-chrome={letter ? "" : undefined}
      data-letter-header-mode={letter ? headerMode : undefined}
      className="pointer-events-none absolute inset-0 z-[3] overflow-hidden"
      style={{ fontFamily: textFontFamily }}
    >
      {headerMode === "compact" && !warmLetterOwnsFirstPageHeader ? (
        <div
          data-dossier-compact-header
          data-dossier-header-height-mm={headerVisualHeight}
          className="absolute inset-x-0 top-0"
          style={{
            height: `${headerVisualHeight}mm`,
            boxSizing: "border-box",
            background: headerSurface,
            borderBottom: borderStyle,
          }}
          aria-hidden="true"
        />
      ) : null}

      {headerMode === "contact" ? (
        continuationContact ? (
          <div
            data-dossier-continuation-contact-header
            data-dossier-header-height-mm={headerVisualHeight}
            data-cv-continuation-header={scope === "cv" ? "" : undefined}
            data-letter-continuation-header={letter ? "" : undefined}
            className="absolute inset-x-0 top-0 flex items-center"
            style={{
              height: `${headerVisualHeight}mm`,
              padding: "0 12mm",
              boxSizing: "border-box",
              background: headerSurface,
              borderBottom: borderStyle,
              color: headerRoles.ink,
              fontSize: "7.6pt",
              lineHeight: 1.1,
            }}
          >
            <div
              data-dossier-continuation-contact
              className="flex min-w-0 flex-1 flex-wrap items-center justify-center text-center opacity-95"
              style={{ overflowWrap: "anywhere", transform: headerContentTransform }}
            >
              {continuationRows.map((row, index) => (
                <span key={row.key} className="inline-flex min-w-0 items-center">
                  <InlineContactSeparator
                    style={inlineSeparator}
                    rowKey={row.key}
                    index={index}
                    compact
                  />
                  <span className={row.strong ? "min-w-0 font-semibold" : "min-w-0"}>
                    {row.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              data-dossier-contact-header-background
              data-dossier-header-height-mm={headerVisualHeight}
              className="absolute inset-x-0 top-0"
              style={{
                height: `${headerVisualHeight}mm`,
                boxSizing: "border-box",
                background: headerSurface,
                borderBottom: borderStyle,
              }}
              aria-hidden="true"
            />
            <div
              data-dossier-integrated-contact
              data-letter-integrated-contact={letter ? "" : undefined}
              className="absolute inset-x-0 top-0 flex"
              style={{
                height: `${headerVisualHeight}mm`,
                padding: stackedHeader ? "1mm 23mm 1mm 24mm" : "2mm 18mm",
                boxSizing: "border-box",
                color: headerRoles.ink,
                fontSize: stackedHeader ? "8pt" : "8.5pt",
                lineHeight: stackedHeader ? 1.08 : 1.18,
                overflow: "hidden",
              }}
            >
              {stackedHeader ? (
                <div
                  className="my-auto min-w-0"
                  style={{ overflowWrap: "anywhere", transform: headerContentTransform }}
                >
                  {contactRows.map((row) => (
                    <div
                      key={row.key}
                      className={row.strong ? "font-semibold" : "opacity-95"}
                      style={row.strong ? { fontSize: "9.5pt", marginBottom: "0.2mm" } : undefined}
                    >
                      {row.value}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  data-dossier-inline-contact
                  className="my-auto flex min-w-0 flex-1 flex-wrap items-center justify-center gap-y-[0.8mm] text-center"
                  style={{ overflowWrap: "anywhere", transform: headerContentTransform }}
                >
                  {contactRows.map((row, index) => (
                    <span key={row.key} className="inline-flex min-w-0 items-center">
                      <InlineContactSeparator
                        style={inlineSeparator}
                        rowKey={row.key}
                        index={index}
                      />
                      <span
                        className={row.strong ? "min-w-0 font-semibold" : "min-w-0 opacity-95"}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {row.value}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )
      ) : null}

      {options.footerMode === "compact" ? (
        <div
          data-dossier-footer="compact"
          data-dossier-footer-height-mm={compactFooterHeight}
          data-letter-footer={letter ? "compact" : undefined}
          data-letter-footer-height-mm={letter ? compactFooterHeight : undefined}
          className="absolute inset-x-0 bottom-0"
          style={{
            height: `${compactFooterHeight}mm`,
            boxSizing: "border-box",
            background: footerSurface,
            borderTop: borderStyle,
            opacity: template === "brief" ? 0.75 : 0.92,
          }}
          aria-hidden="true"
        />
      ) : null}

      {options.footerMode === "details" ? (
        <div
          data-dossier-footer="details"
          data-dossier-footer-height-mm={detailsHeight}
          data-letter-footer={letter ? "attachments" : undefined}
          data-letter-footer-height-mm={letter ? detailsHeight : undefined}
          className="absolute inset-x-0 bottom-0 text-[8.5pt] leading-[1.3]"
          style={{
            height: `${detailsHeight}mm`,
            padding: "2.2mm 23mm 2.2mm 24mm",
            boxSizing: "border-box",
            background: footerSurface,
            borderTop: borderStyle,
            color: footerRoles.ink,
            overflow: "hidden",
          }}
        >
          {footerLabel && footerDetails.length ? (
            options.footerTextLayout === "inline" ? (
              <div
                data-letter-footer-attachments={letter ? "" : undefined}
                className="flex h-full min-w-0 items-center gap-[3mm]"
                style={{ transform: footerContentTransform }}
              >
                <span
                  data-letter-pdf-text={letter ? "attachments-heading" : undefined}
                  className="shrink-0 font-semibold"
                >
                  {footerLabel}
                </span>
                <div
                  data-letter-pdf-text={letter ? "attachments-body" : undefined}
                  className="min-w-0 opacity-95"
                  style={{ overflowWrap: "anywhere" }}
                >
                  <div className="min-w-0">
                    {footerDetails.map((value, index) => (
                      <div key={value} className="inline">
                        {index ? " · " : ""}
                        {value}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                data-letter-footer-attachments={letter ? "" : undefined}
                className="flex h-full min-w-0 items-start gap-[8mm]"
                style={{ transform: footerContentTransform }}
              >
                <div
                  data-letter-pdf-text={letter ? "attachments-heading" : undefined}
                  className="shrink-0 font-semibold"
                >
                  {footerLabel}
                </div>
                <div
                  data-letter-pdf-text={letter ? "attachments-body" : undefined}
                  className="min-w-0 flex-1"
                  style={{ overflowWrap: "anywhere" }}
                >
                  <div>
                    {footerDetails.map((value) => (
                      <div key={value}>{value}</div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : options.footerTextLayout === "stacked" ? (
            <div
              className="flex h-full min-w-0 flex-col justify-center"
              style={{ transform: footerContentTransform }}
            >
              {footerValues.map((value) => (
                <div key={value} className="min-w-0 whitespace-normal break-words">
                  {value}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="flex h-full min-w-0 items-center justify-between gap-[8mm]"
              style={{ transform: footerContentTransform }}
            >
              <span className="min-w-0 whitespace-normal break-words">
                {footerValues.join(" · ")}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}