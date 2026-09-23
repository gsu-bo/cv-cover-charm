import { useEffect, useSyncExternalStore } from "react";
import { FONT_LABELS, type FontKey } from "@/components/cover/types";
import {
  DEFAULT_DOSSIER_CHROME_STATE,
  getDossierChromeState,
  patchDossierChrome,
  setDossierChromeSync,
  subscribeDossierChrome,
  type DossierChromeInlineSeparator,
  type DossierChromeOptions,
  type DossierChromeScope,
  type DossierFooterMode,
  type DossierHeaderMode,
} from "@/lib/dossier-chrome";

const selectClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const smallButtonClass =
  "rounded border border-input bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent";

function VerticalOffsetControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>{label}</span>
        <span>
          {value === 0
            ? "0 mm · zentriert"
            : `${value > 0 ? "+" : ""}${value.toFixed(value % 1 ? 1 : 0)} mm`}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.min(max, Math.max(min, value))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={label}
      />
      {value !== 0 ? (
        <button
          type="button"
          className={`${smallButtonClass} justify-self-start`}
          onClick={() => onChange(0)}
        >
          Zentrierte Standardposition
        </button>
      ) : null}
    </label>
  );
}

function BackgroundControl({
  label,
  color,
  gradientColor,
  fallback,
  onColor,
  onGradientColor,
}: {
  label: string;
  color: string | null;
  gradientColor: string | null;
  fallback: string;
  onColor: (value: string | null) => void;
  onGradientColor: (value: string | null) => void;
}) {
  const custom = color !== null || gradientColor !== null;
  const gradient = custom && gradientColor !== null;
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-2.5">
      <label className="block text-xs font-medium">
        {label}
        <select
          data-dossier-background-mode-control
          value={custom ? "custom" : "template"}
          onChange={(event) => {
            if (event.target.value === "template") {
              onColor(null);
              onGradientColor(null);
            } else {
              onColor(color ?? fallback);
            }
          }}
          className={selectClass}
        >
          <option value="template">Wie Vorlage</option>
          <option value="custom">Eigene Farbe</option>
        </select>
      </label>

      {custom ? (
        <>
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <span className="mr-auto text-xs text-muted-foreground">Erste Farbe</span>
            <input
              type="color"
              value={color ?? fallback}
              onChange={(event) => onColor(event.target.value)}
              className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
              aria-label={`${label} erste Farbe`}
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={gradient}
              onChange={(event) => onGradientColor(event.target.checked ? "#ffffff" : null)}
            />
            Verlauf mit zweiter Farbe
          </label>

          {gradient ? (
            <div className="flex items-center justify-between gap-2 pl-5">
              <span className="text-[11px] text-muted-foreground">Zweite Farbe</span>
              <input
                type="color"
                value={gradientColor ?? "#ffffff"}
                onChange={(event) => onGradientColor(event.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
                aria-label={`${label} zweite Verlaufsfarbe`}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TextColorControl({
  kind,
  color,
  fallback,
  onColor,
}: {
  kind: "header" | "footer";
  color: string | null;
  fallback: string;
  onColor: (value: string | null) => void;
}) {
  const custom = color !== null;
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-2.5">
      <label className="block text-xs font-medium">
        Schriftfarbe
        <select
          data-dossier-text-color-mode-control={kind}
          value={custom ? "custom" : "automatic"}
          onChange={(event) =>
            onColor(event.target.value === "automatic" ? null : (color ?? fallback))
          }
          className={selectClass}
        >
          <option value="automatic">Automatisch</option>
          <option value="custom">Eigene Farbe</option>
        </select>
      </label>
      {custom ? (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <span className="mr-auto text-xs text-muted-foreground">Eigene Farbe</span>
          <input
            data-dossier-text-color-control={kind}
            type="color"
            value={color ?? fallback}
            onInput={(event) => onColor(event.currentTarget.value)}
            onChange={(event) => onColor(event.target.value)}
            className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
            aria-label={`${kind === "header" ? "Header" : "Footer"}-Schriftfarbe`}
          />
        </div>
      ) : null}
    </div>
  );
}

function FontSizeControl({
  kind,
  value,
  fallback,
  onChange,
}: {
  kind: "header" | "footer";
  value: number | null;
  fallback: number;
  onChange: (value: number | null) => void;
}) {
  const size = value ?? fallback;
  const label = kind === "header" ? "Header" : "Footer";
  return (
    <label className="grid gap-1 text-xs">
      <span className="flex items-center justify-between gap-2 text-muted-foreground">
        <span>Schriftgrösse</span>
        <span>{size.toFixed(size % 1 ? 1 : 0)} pt</span>
      </span>
      <input
        data-dossier-font-size-control={kind}
        type="range"
        min={6}
        max={30}
        step={0.5}
        value={size}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label={`${label}-Schriftgrösse`}
      />
      {value !== null ? (
        <button
          type="button"
          className={`${smallButtonClass} justify-self-start`}
          onClick={() => onChange(null)}
        >
          Wie Vorlage
        </button>
      ) : (
        <span className="text-[11px] text-muted-foreground">Automatisch passend zur Vorlage</span>
      )}
    </label>
  );
}

function openCvPageSpacing() {
  if (typeof document === "undefined") return;

  const reveal = () => {
    const margins = document.querySelector<HTMLDetailsElement>(
      '[data-dossier-page-margins-control="cv"]',
    );
    if (!margins) return false;
    margins.open = true;
    margins.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => {
      margins
        .querySelector<HTMLInputElement>("[data-dossier-header-gap-control]")
        ?.focus({ preventScroll: true });
    });
    return true;
  };

  if (reveal()) return;

  const layoutSection = document.querySelector<HTMLElement>(
    '[data-editor-section][data-editor-section-title="Layout"]',
  );
  const layoutBody = layoutSection?.querySelector<HTMLElement>("[data-editor-section-body]");
  if (!layoutBody) {
    layoutSection?.querySelector<HTMLButtonElement>("[data-editor-section-toggle]")?.click();
  }

  requestAnimationFrame(() => requestAnimationFrame(reveal));
}

export function DossierChromeControls({
  scope,
  onOptionsChange,
}: {
  scope: DossierChromeScope;
  /**
   * Compatibility bridge for editors that still persist these fields inside
   * their document model. The shared chrome store remains canonical, while the
   * callback keeps legacy autosave from writing a stale value back afterwards.
   */
  onOptionsChange?: (patch: Partial<DossierChromeOptions>) => void;
}) {
  const state = useSyncExternalStore(
    subscribeDossierChrome,
    getDossierChromeState,
    () => DEFAULT_DOSSIER_CHROME_STATE,
  );
  const options = state.sync ? state.shared : state[scope];
  const other = scope === "cv" ? "Motivationsschreiben" : "Lebenslauf";
  const thisDocument = scope === "cv" ? "Lebenslauf" : "Motivationsschreiben";
  const contactOptions = [
    ["headerShowName", "Name", options.headerShowName],
    ["headerShowAddress", "Adresse", options.headerShowAddress],
    ["headerShowPhone", "Telefon", options.headerShowPhone],
    ["headerShowEmail", "E-Mail", options.headerShowEmail],
  ] as const;

  const headerControlValue =
    options.headerMode === "contact"
      ? options.headerTextLayout === "inline"
        ? "contact-inline"
        : "contact-stacked"
      : options.headerMode;
  const headerInlineSeparator =
    options.headerInlineSeparator === "icons" ? "dot" : (options.headerInlineSeparator ?? "dot");
  const continuationHeaderControlValue = options.headerContinuationMode ?? "legacy";
  const contactHeaderVisible =
    options.headerMode === "contact" ||
    (options.headerDifferentFirstPage !== false && options.headerContinuationMode === "contact");
  const hasChromeSurface = options.headerMode !== "none" || options.footerMode !== "none";
  const footerControlValue =
    scope === "letter" && options.footerMode === "details" ? "attachments" : options.footerMode;

  const patchOptions = (patch: Partial<DossierChromeOptions>) => {
    patchDossierChrome(scope, patch);
    onOptionsChange?.(patch);
  };

  useEffect(() => {
    if (options.headerInlineSeparator !== "icons") return;
    const patch = { headerInlineSeparator: "dot" as DossierChromeInlineSeparator };
    patchDossierChrome(scope, patch);
    onOptionsChange?.(patch);
  }, [onOptionsChange, options.headerInlineSeparator, scope]);

  const headerDefaultHeight =
    options.headerMode === "contact" ? (options.headerTextLayout === "inline" ? 26 : 32) : 4;
  const headerMin =
    options.headerMode === "contact" ? (options.headerTextLayout === "stacked" ? 18 : 10) : 1;
  const headerMax = 80;
  const headerHeight = Math.min(
    headerMax,
    Math.max(headerMin, options.headerHeightMm ?? headerDefaultHeight),
  );
  const headerGap = options.headerGapMm ?? 12;
  const headerContentOffsetY = options.headerContentOffsetYMm ?? 0;
  const footerDefaultHeight = options.footerMode === "details" ? 10 : 4;
  const footerHeight = options.footerHeightMm ?? footerDefaultHeight;
  const footerContentOffsetY = options.footerContentOffsetYMm ?? 0;
  const headerFontSizeFallback = 14;
  const footerFontSizeFallback = options.footerMode === "details" ? 8.5 : 6.5;
  const footerMin = options.footerMode === "details" ? 4 : 1;
  const footerMax = options.footerMode === "details" ? 40 : 18;
  const syncControl = (
    <div className="flex items-start gap-2">
      <input
        id={`dossier-chrome-sync-${scope}`}
        data-dossier-chrome-sync
        type="checkbox"
        className="mt-0.5"
        checked={state.sync}
        onChange={(event) => {
          const sync = event.target.checked;
          const nextOptions = sync ? state[scope] : state.shared;
          setDossierChromeSync(scope, sync);
          onOptionsChange?.(nextOptions);
        }}
      />
      <label htmlFor={`dossier-chrome-sync-${scope}`} className="min-w-0 text-xs">
        <span className="block font-semibold">Header &amp; Footer synchron halten</span>
        <span className="mt-0.5 block leading-relaxed text-muted-foreground">
          {state.sync
            ? `Änderungen gelten gleichzeitig für ${thisDocument} und ${other}.`
            : `Nur ${thisDocument} wird geändert.`}
        </span>
      </label>
    </div>
  );

  return (
    <section
      data-dossier-chrome-controls={scope}
      className="rounded-lg border bg-background p-3 shadow-sm"
    >
      <div className="mt-3 grid gap-3 pt-3">
        <div className="grid gap-2 rounded-md border p-2.5">
          <label className="block text-xs font-medium">
            Header
            <select
              data-dossier-header-mode-control
              {...(scope === "letter" ? { "data-letter-header-mode-control": "" } : {})}
              {...(scope === "cv" ? { "data-cv-header-mode-control": "" } : {})}
              value={headerControlValue}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "contact-inline" || value === "contact-stacked") {
                  patchOptions({
                    headerMode: "contact",
                    headerTextLayout: value === "contact-inline" ? "inline" : "stacked",
                    headerHeightMm: null,
                    ...(options.headerInlineSeparator == null ||
                    options.headerInlineSeparator === "icons"
                      ? { headerInlineSeparator: "dot" as DossierChromeInlineSeparator }
                      : {}),
                  });
                  return;
                }
                patchOptions({
                  headerMode: value as DossierHeaderMode,
                  headerHeightMm: null,
                });
              }}
              className={selectClass}
            >
              <option value="compact">Header kompakt</option>
              <option value="contact-stacked">Kontaktdaten in Zeilen</option>
              <option value="contact-inline">Kontaktdaten waagrecht · getrennt</option>
              <option value="none">Kein Header</option>
            </select>
          </label>

          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Kompakt zeigt nur das Designband. „In Zeilen“ zeigt den Namen separat und bündelt
            Strasse · Ort sowie Telefon · E-Mail. Waagrecht setzt alle Angaben in eine Zeile bzw.
            lässt sie bei Bedarf umbrechen. Das Trennzeichen kannst du unten wählen.
          </span>

          {options.headerMode !== "none" ? (
            <div
              data-dossier-continuation-settings
              className="grid gap-2 rounded-md border bg-muted/20 p-2.5"
            >
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  data-dossier-header-different-first-page-control
                  type="checkbox"
                  checked={options.headerDifferentFirstPage !== false}
                  onChange={(event) =>
                    patchOptions({ headerDifferentFirstPage: event.target.checked })
                  }
                />
                Erste Seite anders
              </label>

              {options.headerDifferentFirstPage !== false ? (
                <label className="block text-xs font-medium">
                  Header ab Seite 2
                  <select
                    data-dossier-continuation-header-mode-control
                    value={continuationHeaderControlValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchOptions({
                        headerContinuationMode:
                          value === "legacy" ? undefined : (value as DossierHeaderMode),
                      });
                    }}
                    className={selectClass}
                  >
                    <option value="legacy">Automatisch wie bisher</option>
                    <option value="compact">Header kompakt</option>
                    <option value="contact">Kontaktdaten</option>
                    <option value="none">Kein Header</option>
                  </select>
                  <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">
                    Alte Dossiers bleiben bei „Automatisch wie bisher“ unverändert. Eine bewusste
                    Auswahl gilt nur für Seite 2 und folgende.
                  </span>
                </label>
              ) : (
                <span className="text-[11px] leading-relaxed text-muted-foreground">
                  Derselbe Header wird auf allen Seiten verwendet. Die gespeicherte Folgeseitenwahl
                  bleibt erhalten.
                </span>
              )}
            </div>
          ) : null}

          {options.headerMode === "contact" ? (
            <VerticalOffsetControl
              label="Header-Inhalt – vertikale Position"
              value={headerContentOffsetY}
              min={-12}
              max={12}
              onChange={(headerContentOffsetYMm) => patchOptions({ headerContentOffsetYMm })}
            />
          ) : null}

          {options.headerMode !== "none" ? (
            <>
              <label className="grid gap-1 text-xs">
                <span className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>Headerhöhe</span>
                  <span>{headerHeight.toFixed(headerHeight % 1 ? 1 : 0)} mm</span>
                </span>
                <input
                  data-dossier-header-height-control
                  type="range"
                  min={headerMin}
                  max={headerMax}
                  step={1}
                  value={headerHeight}
                  onChange={(event) => patchOptions({ headerHeightMm: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
                {options.headerHeightMm !== null ? (
                  <button
                    type="button"
                    className={`${smallButtonClass} justify-self-start`}
                    onClick={() => patchOptions({ headerHeightMm: null })}
                  >
                    Standardhöhe
                  </button>
                ) : null}
              </label>

              {scope === "cv" ? (
                <div
                  data-cv-header-gap-link
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-2.5 py-2 text-xs"
                >
                  <span className="min-w-0 text-muted-foreground">Abstand zum Seiteninhalt</span>
                  <button
                    type="button"
                    onClick={openCvPageSpacing}
                    className="shrink-0 font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Seitenränder &amp; Abstände →
                  </button>
                </div>
              ) : (
                <label className="grid gap-1 text-xs">
                  <span className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>Freiraum unter dem Header</span>
                    <span>{headerGap.toFixed(headerGap % 1 ? 1 : 0)} mm</span>
                  </span>
                  <input
                    data-dossier-header-gap-control
                    type="range"
                    min={0}
                    max={40}
                    step={1}
                    value={Math.min(40, Math.max(0, headerGap))}
                    onChange={(event) => patchOptions({ headerGapMm: Number(event.target.value) })}
                    className="w-full accent-primary"
                  />
                  <span className="text-[11px] leading-relaxed text-muted-foreground">
                    Abstand zwischen Header-Ende und dem ersten Inhalt.
                  </span>
                  {headerGap !== 12 ? (
                    <button
                      type="button"
                      className={`${smallButtonClass} justify-self-start`}
                      onClick={() => patchOptions({ headerGapMm: 12 })}
                    >
                      Standardabstand (12 mm)
                    </button>
                  ) : null}
                </label>
              )}

              {contactHeaderVisible ? (
                <>
                  <div
                    data-dossier-header-fields
                    className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-2.5"
                  >
                    {contactOptions.map(([key, label, checked]) => (
                      <label key={key} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => patchOptions({ [key]: event.target.checked })}
                        />
                        {label} integrieren
                      </label>
                    ))}
                  </div>

                  <label className="block text-xs font-medium">
                    {options.headerTextLayout === "stacked"
                      ? "Trennung innerhalb der Kontaktzeilen"
                      : "Trennung der Angaben"}
                    <select
                      data-dossier-header-inline-separator-control
                      value={headerInlineSeparator}
                      onChange={(event) =>
                        patchOptions({
                          headerInlineSeparator: event.target.value as DossierChromeInlineSeparator,
                        })
                      }
                      className={selectClass}
                    >
                      <option value="dot">Mittelpunkt ·</option>
                      <option value="slash">Schrägstrich /</option>
                      <option value="pipe">Senkrechter Strich |</option>
                      <option value="space">Leerraum (5 Leerzeichen)</option>
                    </select>
                    <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">
                      {options.headerTextLayout === "stacked"
                        ? "Gilt zwischen Strasse und Ort sowie zwischen Telefon und E-Mail."
                        : "Wähle eine ruhige Trennung für die waagrecht angeordneten Kontaktdaten."}
                    </span>
                  </label>
                </>
              ) : null}

              <BackgroundControl
                label="Header-Hintergrund"
                color={options.headerBackgroundColor}
                gradientColor={options.headerGradientColor}
                fallback="#334155"
                onColor={(headerBackgroundColor) => patchOptions({ headerBackgroundColor })}
                onGradientColor={(headerGradientColor) => patchOptions({ headerGradientColor })}
              />
              <TextColorControl
                kind="header"
                color={options.headerTextColor ?? null}
                fallback="#ffffff"
                onColor={(headerTextColor) => patchOptions({ headerTextColor })}
              />
              <FontSizeControl
                kind="header"
                value={options.headerFontSizePt ?? null}
                fallback={headerFontSizeFallback}
                onChange={(headerFontSizePt) => patchOptions({ headerFontSizePt })}
              />
            </>
          ) : null}
        </div>

        <div className="grid gap-2 rounded-md border p-2.5">
          <label className="block text-xs font-medium">
            Footer
            <select
              data-dossier-footer-mode-control
              {...(scope === "letter" ? { "data-letter-footer-mode-control": "" } : {})}
              {...(scope === "cv" ? { "data-cv-footer-mode-control": "" } : {})}
              value={footerControlValue}
              onChange={(event) => {
                const value = event.target.value;
                patchOptions({
                  footerMode: (value === "attachments" ? "details" : value) as DossierFooterMode,
                  footerHeightMm: null,
                });
              }}
              className={selectClass}
            >
              <option value="compact">Footerband kompakt</option>
              <option value={scope === "letter" ? "attachments" : "details"}>
                Footerband mit Details
              </option>
              <option value="none">Kein Footer</option>
            </select>
          </label>
          <span className="text-[11px] leading-relaxed text-muted-foreground">
            Kompakt zeigt nur das Designband. Mit Details bleibt die Gestaltung synchron; der Inhalt
            ist dokumentgerecht: Beilagen im Motivationsschreiben, Identität im Lebenslauf.
          </span>

          {options.footerMode !== "none" ? (
            <>
              {options.footerMode === "details" ? (
                <VerticalOffsetControl
                  label="Footer-Inhalt – vertikale Position"
                  value={footerContentOffsetY}
                  min={-8}
                  max={8}
                  onChange={(footerContentOffsetYMm) => patchOptions({ footerContentOffsetYMm })}
                />
              ) : null}

              <label className="grid gap-1 text-xs">
                <span className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span>Footerhöhe</span>
                  <span>{footerHeight.toFixed(footerHeight % 1 ? 1 : 0)} mm</span>
                </span>
                <input
                  data-dossier-footer-height-control
                  type="range"
                  min={footerMin}
                  max={footerMax}
                  step={1}
                  value={Math.min(footerMax, Math.max(footerMin, footerHeight))}
                  onChange={(event) => patchOptions({ footerHeightMm: Number(event.target.value) })}
                  className="w-full accent-primary"
                />
                {options.footerHeightMm !== null ? (
                  <button
                    type="button"
                    className={`${smallButtonClass} justify-self-start`}
                    onClick={() => patchOptions({ footerHeightMm: null })}
                  >
                    Standardhöhe
                  </button>
                ) : null}
              </label>

              {options.footerMode === "details" ? (
                <label className="block text-xs font-medium">
                  Anordnung der Angaben
                  <select
                    data-dossier-footer-text-layout-control
                    value={options.footerTextLayout}
                    onChange={(event) =>
                      patchOptions({
                        footerTextLayout: event.target.value === "stacked" ? "stacked" : "inline",
                      })
                    }
                    className={selectClass}
                  >
                    <option value="inline">Alle Angaben nebeneinander</option>
                    <option value="stacked">Alle Angaben untereinander</option>
                  </select>
                </label>
              ) : null}

              <BackgroundControl
                label="Footer-Hintergrund"
                color={options.footerBackgroundColor}
                gradientColor={options.footerGradientColor}
                fallback="#64748b"
                onColor={(footerBackgroundColor) => patchOptions({ footerBackgroundColor })}
                onGradientColor={(footerGradientColor) => patchOptions({ footerGradientColor })}
              />
              <TextColorControl
                kind="footer"
                color={options.footerTextColor ?? null}
                fallback="#ffffff"
                onColor={(footerTextColor) => patchOptions({ footerTextColor })}
              />
              <FontSizeControl
                kind="footer"
                value={options.footerFontSizePt ?? null}
                fallback={footerFontSizeFallback}
                onChange={(footerFontSizePt) => patchOptions({ footerFontSizePt })}
              />
            </>
          ) : null}
        </div>

        {syncControl}
        {hasChromeSurface ? (
          <>
            <label className="block text-xs font-medium">
              Schrift in Header &amp; Footer
              <select
                data-dossier-chrome-font-control
                value={options.textFont ?? "template"}
                onChange={(event) =>
                  patchOptions({
                    textFont:
                      event.target.value === "template" ? null : (event.target.value as FontKey),
                  })
                }
                className={selectClass}
              >
                <option value="template">Wie Vorlage</option>
                {(Object.entries(FONT_LABELS) as Array<[FontKey, string]>).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div
              data-dossier-border-controls
              className="grid gap-2 rounded-md border bg-muted/20 p-2.5"
            >
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  data-dossier-border-enabled-control
                  type="checkbox"
                  checked={options.borderEnabled}
                  onChange={(event) => patchOptions({ borderEnabled: event.target.checked })}
                />
                Rahmen aktiv
              </label>
              <span className="text-[11px] leading-relaxed text-muted-foreground">
                Eine gemeinsame Linie für beide: Header unten, Footer oben. Farbe und Dicke sind
                identisch.
              </span>

              {options.borderEnabled ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-xs text-muted-foreground">Rahmenfarbe</span>
                    <input
                      data-dossier-border-color-control
                      type="color"
                      value={options.borderColor ?? "#64748b"}
                      onChange={(event) => patchOptions({ borderColor: event.target.value })}
                      className="h-7 w-10 cursor-pointer rounded border border-input bg-background"
                      aria-label="Rahmenfarbe"
                    />
                    {options.borderColor ? (
                      <button
                        type="button"
                        className={smallButtonClass}
                        onClick={() => patchOptions({ borderColor: null })}
                      >
                        Automatisch passend
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Automatisch passend</span>
                    )}
                  </div>

                  <label className="grid gap-1 text-xs">
                    <span className="flex items-center justify-between gap-2 text-muted-foreground">
                      <span>Rahmendicke</span>
                      <span>{options.borderWidthMm.toFixed(1)} mm</span>
                    </span>
                    <input
                      data-dossier-border-width-control
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.1}
                      value={options.borderWidthMm}
                      onChange={(event) =>
                        patchOptions({ borderWidthMm: Number(event.target.value) })
                      }
                      className="w-full accent-primary"
                    />
                    {options.borderWidthMm !== 0.6 ? (
                      <button
                        type="button"
                        className={`${smallButtonClass} justify-self-start`}
                        onClick={() => patchOptions({ borderWidthMm: 0.6 })}
                      >
                        Standarddicke
                      </button>
                    ) : null}
                  </label>
                </>
              ) : null}
            </div>
          </>
        ) : (
          <p
            data-dossier-chrome-empty-note
            className="rounded-md border border-dashed p-2.5 text-[11px] leading-relaxed text-muted-foreground"
          >
            Header und Footer sind deaktiviert. Zusätzliche Schrift- und Rahmenoptionen werden erst
            eingeblendet, sobald eine Fläche aktiv ist.
          </p>
        )}
      </div>
    </section>
  );
}
