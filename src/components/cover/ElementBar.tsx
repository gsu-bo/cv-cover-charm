import { useLayoutEffect, useState } from "react";
import type { Block, BlockStyle, ColorSlot, CustomField, FontKey, ListStyle } from "./types";
import { FONT_LABELS, FONT_STACKS, LIST_STYLES } from "./types";
import { resolveLayout } from "./resolve";
import { FONT, FRAME } from "@/default-config";
import { PhotoControls } from "./PhotoControls";
import { TextAlignmentControl } from "@/components/dossier/TextAlignmentControl";
import type { TextAlignment } from "@/lib/text-alignment";

type Props = {
  block: Block;
  slots: ColorSlot[];
  colors: Record<string, string>;
  onChange: (patch: Partial<BlockStyle>) => void;
  onReset: () => void;
  onClose: () => void;
  custom?: CustomField;
  onCustomChange?: (patch: Partial<CustomField>) => void;
  /** Im Lebenslauf dürfen freie Elemente unabhängig Seite 1 oder 2 zugewiesen werden. */
  allowPagePlacement?: boolean;
  onDelete?: () => void;
  /** Ist ein Foto hochgeladen? Steuert die Zuschnitt-Regler. */
  hasPhoto?: boolean;
  /** Bild des Elements setzen bzw. mit null entfernen. */
  onPickImage?: (file: File | null) => void;
  /** Ein weiteres, freies Bild-Element aufs Blatt legen. */
  onAddImage?: () => void;
  /**
   * Überschreibbarer Wortlaut eines Vorlagen-Titels (Kontakt/Empfänger).
   * Leer heisst "Wortlaut der Vorlage", `titlePlaceholder` zeigt ihn an.
   */
  title?: string;
  titlePlaceholder?: string;
  onTitleChange?: (value: string) => void;
};

type Tab = "text" | "absatz" | "farbe" | "rahmen" | "bild" | "position" | "form";
type LayeredStyle = Omit<BlockStyle, "align"> & {
  align: TextAlignment;
  layer?: "back" | "front";
};

const TAB_LABELS: Record<Tab, string> = {
  text: "Text",
  form: "Form",
  absatz: "Absatz",
  farbe: "Farbe",
  rahmen: "Rahmen",
  bild: "Bild",
  position: "Platzierung",
};

const inputCls =
  "rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

/** Die Form-Regler dürfen die komplette A4-Seite ausfüllen. */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/** Häufige Verlaufsrichtungen als Knopf – schneller als der Gradregler. */
const GRAD_ANGLES = [
  { deg: 0, icon: "↑" },
  { deg: 90, icon: "→" },
  { deg: 135, icon: "↘" },
  { deg: 180, icon: "↓" },
  { deg: 225, icon: "↙" },
] as const;

const toggle = (on: boolean) =>
  `inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors ${
    on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"
  }`;

/** Beschriftetes Steuerelement mit fixer Label-Zeile darüber. */
function Ctl({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${grow ? "min-w-40 flex-1" : ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-w-24 accent-primary"
      />
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {Math.round(value * 100) / 100}
        {suffix}
      </span>
    </>
  );
}

/**
 * Welches Höhenverhältnis gilt, wenn keines gespeichert ist?
 *
 * Der Renderer setzt je nach Element einen anderen Rückfall ein. `null` heisst:
 * die Höhe kommt aus dem Inhalt und hat mit der Breite nichts zu tun.
 */
function impliedRatio(block: Block): number | null {
  if (block.kind === "photo" || block.kind === "image" || block.kind === "shape") return 1;
  return block.src ? 0.6 : null;
}

/**
 * Höhe eines Elements in mm.
 *
 * Gespeichert ist sie als Verhältnis zur Breite (`ratio`), damit ältere Stände
 * und alle Vorlagen weiter passen. Für die Bedienung ist das aber die falsche
 * Grösse: wer die Breite zieht, will nicht, dass das Element mitwächst.
 */
function heightMm(block: Block): number {
  return Math.round(block.style.w * (block.style.ratio ?? impliedRatio(block) ?? 1));
}

/** Beim Ändern der Breite das Verhältnis so nachziehen, dass die Höhe bleibt. */
function keepHeight(block: Block, nextW: number): Partial<BlockStyle> {
  const ratio = block.style.ratio ?? impliedRatio(block);
  if (ratio === null || nextW <= 0) return {};
  return { ratio: (block.style.w * ratio) / nextW };
}

/**
 * Beim Ändern der Höhe entscheidet der Proportions-Lock, welche Grösse frei ist.
 * Gelockt bleibt `ratio` unangetastet und die Breite folgt der gewünschten Höhe;
 * ungelockt bleibt die Breite stehen und das Verhältnis ändert sich wie bisher.
 */
function resizeHeight(block: Block, nextH: number, lockRatio: boolean): Partial<BlockStyle> {
  const ratio = block.style.ratio ?? impliedRatio(block);
  if (ratio === null || nextH <= 0) return {};
  if (!lockRatio) return { ratio: nextH / Math.max(1, block.style.w) };
  return { w: Math.max(5, Math.min(A4_WIDTH_MM, nextH / Math.max(ratio, 0.001))) };
}

/**
 * Register, mit dem ein Element aufgeht. Ein frisch eingefügtes Bild hat noch
 * keine Datei – dort ist "Bild" der nächste Schritt, nicht "Form".
 */
function startTab(block: Block): Tab {
  if (block.kind === "text") return "text";
  if (block.kind === "image" && !block.src) return "bild";
  return "form";
}

/**
 * Werkzeugleiste für das gewählte Element. Sie sitzt fest unter der Vorschau –
 * eine schwebende Leiste verdeckt genau das Element, das man gerade einstellt.
 * Die Optionen sind auf Register verteilt, damit eine Zeile reicht.
 */
export function ElementBar({
  block,
  slots,
  colors,
  onChange,
  onReset,
  onClose,
  custom,
  onCustomChange,
  allowPagePlacement = false,
  onDelete,
  hasPhoto = false,
  onPickImage,
  onAddImage,
  title,
  titlePlaceholder,
  onTitleChange,
}: Props) {
  const st = block.style as LayeredStyle;
  const isText = block.kind === "text";
  const isShape = block.kind === "shape";
  const isPhoto = block.kind === "photo";
  const isImage = block.kind === "image";
  /** Fotos und Bilder bleiben standardmässig proportional; Formen sind frei skalierbar. */
  const lockRatio = st.lockRatio ?? (isPhoto || isImage);
  const isSlot = slots.some((s) => s.key === st.color);
  // Ohne eigene Rahmenfarbe folgt der Rahmen der Elementfarbe.
  const frameKey = st.borderColor ?? st.color;
  const frameIsSlot = slots.some((s) => s.key === frameKey);
  // Zuschnitt braucht ein Bild – beim Foto steckt es in den Daten, beim
  // Bild-Element am Block selbst.
  const cropReady = isImage ? !!block.src : hasPhoto;

  // Der globale Schriftregler skaliert die gerenderte Schrift, ohne die rohe
  // Elementgrösse zu verändern. Die Elementleiste soll trotzdem die für den
  // Nutzer wirksame Grösse zeigen. Dafür lesen wir die tatsächlich gerenderte
  // Grösse und vergleichen sie mit genau diesem Block beim UI-Standard 100 %.
  const [renderedTextSize, setRenderedTextSize] = useState<number | null>(null);
  const standardTextSize = isText
    ? (resolveLayout([block], FONT.DEFAULT_SCALE)[block.id]?.size ?? st.size)
    : st.size;

  useLayoutEffect(() => {
    if (!isText || typeof document === "undefined") {
      setRenderedTextSize(null);
      return;
    }
    const node = Array.from(document.querySelectorAll<HTMLElement>("[data-block-id]")).find(
      (element) => element.dataset.blockId === block.id,
    );
    const textNode = node?.firstElementChild as HTMLElement | null;
    if (!textNode) return;
    const px = Number.parseFloat(window.getComputedStyle(textNode).fontSize);
    if (!Number.isFinite(px)) return;
    const pt = px * 0.75;
    setRenderedTextSize((current) =>
      current !== null && Math.abs(current - pt) < 0.01 ? current : pt,
    );
  });

  const textUiScale =
    isText && renderedTextSize !== null && standardTextSize > 0
      ? renderedTextSize / standardTextSize
      : 1;
  const effectiveTextSize = st.size * textUiScale;
  const setEffectiveTextSize = (size: number) =>
    onChange({
      size: Math.max(FONT.SLIDER_MIN, Math.min(FONT.SLIDER_MAX, size / textUiScale)),
    });

  // Bilder kann nur tragen, wer auch eines annehmen darf – also eigene
  // Elemente. Formen bringen ihre Linienstärke schon im Register "Form" mit.
  const canImage = !!onPickImage;
  const canFrame = isText || isPhoto || isImage;
  const tabs: Tab[] = [
    ...((isText ? ["text", "absatz"] : ["form"]) as Tab[]),
    "farbe",
    ...((canFrame ? ["rahmen"] : []) as Tab[]),
    ...((canImage ? ["bild"] : []) as Tab[]),
    "position",
  ];
  const [tab, setTab] = useState<Tab>(() => startTab(block));

  /**
   * Beim Wechsel auf ein anderes Element auf ein gültiges Register springen.
   *
   * Umstellung während des Renderns statt im Effekt: so gibt es kein
   * Zwischenbild mit dem alten Register, und der Upload selbst schaltet das
   * Register nicht wieder weg (er ändert `src`, nicht die Kennung). Der
   * Startwert oben muss dieselbe Regel benutzen – die Leiste wird beim
   * Auswählen neu aufgebaut, dann läuft dieser Zweig gar nicht.
   */
  const [tabFor, setTabFor] = useState(block.id);
  if (tabFor !== block.id) {
    setTabFor(block.id);
    setTab(startTab(block));
  }

  const colorInput = (value: string, onPick: (v: string) => void) => (
    <input
      type="color"
      value={value}
      onChange={(e) => onPick(e.target.value)}
      className="h-8 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
    />
  );

  return (
    <div className="rounded-xl border bg-background shadow-lg">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          {block.label}
        </span>

        <div className="ml-2 flex flex-wrap gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent"
          >
            Zurücksetzen
          </button>
          {/*
            Eine einzige Aktion statt "Ausblenden" und "Löschen" nebeneinander.
            Was danach passiert, entscheidet der Aufrufer: eigene Elemente
            verschwinden ganz, Elemente der Vorlage werden ausgeblendet. Beides
            lässt sich über die Meldung sofort zurücknehmen.
          */}
          <button
            type="button"
            onClick={() => (onDelete ? onDelete() : onChange({ hidden: true }))}
            className="rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            Entfernen
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Auswahl aufheben"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-3 py-3">
        {tab === "text" && (
          <>
            <Ctl label="Schriftgrösse" grow>
              <button
                type="button"
                aria-label="Kleiner"
                className={toggle(false)}
                onClick={() =>
                  setEffectiveTextSize(
                    Math.max(
                      FONT.SLIDER_MIN * textUiScale,
                      Math.round((effectiveTextSize - 1) * 2) / 2,
                    ),
                  )
                }
              >
                A−
              </button>
              <Slider
                value={effectiveTextSize}
                min={FONT.SLIDER_MIN * textUiScale}
                max={FONT.SLIDER_MAX * textUiScale}
                step={0.5}
                onChange={setEffectiveTextSize}
                suffix="pt"
              />
              <button
                type="button"
                aria-label="Grösser"
                className={toggle(false)}
                onClick={() =>
                  setEffectiveTextSize(
                    Math.min(
                      FONT.SLIDER_MAX * textUiScale,
                      Math.round((effectiveTextSize + 1) * 2) / 2,
                    ),
                  )
                }
              >
                A+
              </button>
            </Ctl>

            <Ctl label="Stil">
              <button
                type="button"
                aria-label="Fett"
                className={`${toggle(st.weight >= 600)} font-bold`}
                onClick={() => onChange({ weight: st.weight >= 600 ? 400 : 700 })}
              >
                B
              </button>
              <button
                type="button"
                aria-label="Kursiv"
                className={`${toggle(st.italic)} italic`}
                onClick={() => onChange({ italic: !st.italic })}
              >
                I
              </button>
              <button
                type="button"
                aria-label="Unterstrichen"
                className={`${toggle(st.underline)} underline`}
                onClick={() => onChange({ underline: !st.underline })}
              >
                U
              </button>
              <button
                type="button"
                aria-label="Grossbuchstaben"
                className={toggle(st.uppercase)}
                onClick={() => onChange({ uppercase: !st.uppercase })}
              >
                AA
              </button>
            </Ctl>

            <Ctl label="Schriftart">
              <select
                value={st.font}
                onChange={(e) => onChange({ font: e.target.value as FontKey })}
                className={inputCls}
                style={{ fontFamily: FONT_STACKS[st.font] }}
              >
                {(Object.keys(FONT_LABELS) as FontKey[]).map((f) => (
                  <option key={f} value={f} style={{ fontFamily: FONT_STACKS[f] }}>
                    {FONT_LABELS[f]}
                  </option>
                ))}
              </select>
            </Ctl>

            {/*
              Inhalt: bei eigenen Feldern der Text selbst, bei Titeln der
              Vorlage ("Kontakt", "Adressiert an") der überschreibbare Wortlaut.
            */}
            {custom && onCustomChange ? (
              <Ctl label="Inhalt" grow>
                <textarea
                  className={`${inputCls} h-9 w-full max-w-md resize-y`}
                  rows={1}
                  value={custom.text}
                  onChange={(e) => onCustomChange({ text: e.target.value })}
                  placeholder="Text (Zeilenumbruch möglich)"
                />
              </Ctl>
            ) : (
              onTitleChange && (
                <Ctl label="Beschriftung" grow>
                  <input
                    className={`${inputCls} w-full max-w-xs`}
                    value={title ?? ""}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder={titlePlaceholder}
                  />
                  {title ? (
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => onTitleChange("")}
                      title="Wortlaut der Vorlage verwenden"
                    >
                      Standard
                    </button>
                  ) : null}
                </Ctl>
              )
            )}
          </>
        )}

        {tab === "absatz" && (
          <>
            <Ctl label="Ausrichtung">
              <TextAlignmentControl
                value={st.align}
                onChange={(align) =>
                  onChange({ align } as unknown as Partial<BlockStyle>)
                }
                ariaLabel="Textausrichtung"
              />
            </Ctl>

            <Ctl label="Aufzählung">
              {LIST_STYLES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  className={toggle(st.list === l.value)}
                  onClick={() => onChange({ list: l.value as ListStyle })}
                  title={l.value === "none" ? "Ohne Zeichen" : `Liste mit ${l.label}`}
                >
                  {l.label}
                </button>
              ))}
            </Ctl>

            <Ctl label="Zeilenhöhe" grow>
              <Slider
                value={st.lineHeight}
                min={0.9}
                max={2}
                step={0.05}
                onChange={(lineHeight) => onChange({ lineHeight })}
                suffix=""
              />
            </Ctl>

            <Ctl label="Laufweite" grow>
              <Slider
                value={st.tracking}
                min={-0.05}
                max={0.6}
                step={0.01}
                onChange={(tracking) => onChange({ tracking })}
                suffix="em"
              />
            </Ctl>
          </>
        )}

        {tab === "form" && (
          <>
            <Ctl label="Breite" grow>
              <Slider
                value={st.w}
                min={5}
                max={A4_WIDTH_MM}
                step={1}
                onChange={(w) => onChange({ w, ...(lockRatio ? {} : keepHeight(block, w)) })}
                suffix="mm"
              />
            </Ctl>

            {block.shape !== "line" && (
              <>
                <Ctl label="Höhe" grow>
                  <Slider
                    value={heightMm(block)}
                    min={5}
                    max={A4_HEIGHT_MM}
                    step={1}
                    onChange={(mm) => onChange(resizeHeight(block, mm, lockRatio))}
                    suffix="mm"
                  />
                </Ctl>

                <Ctl label="Proportion">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={lockRatio}
                      onChange={(e) =>
                        onChange({ lockRatio: e.target.checked } as Partial<LayeredStyle>)
                      }
                    />
                    behalten
                  </label>
                </Ctl>
              </>
            )}

            {(isPhoto || isImage) && (
              <PhotoControls style={st} onChange={onChange} hasPhoto={cropReady} />
            )}

            {isPhoto && hasPhoto && onAddImage && (
              <Ctl label="Weitere Bilder">
                <button
                  type="button"
                  className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                  onClick={onAddImage}
                >
                  + Bild hinzufügen
                </button>
              </Ctl>
            )}

            {isShape && (
              <>
                <Ctl label="Linienstärke" grow>
                  <Slider
                    value={st.strokeWidth ?? 0.8}
                    min={0}
                    max={6}
                    step={0.1}
                    onChange={(strokeWidth) => onChange({ strokeWidth })}
                    suffix="mm"
                  />
                </Ctl>
                {block.shape === "rect" && (
                  <Ctl label="Eckenradius" grow>
                    <Slider
                      value={st.bgRadius >= 999 ? 0 : st.bgRadius}
                      min={0}
                      max={30}
                      step={0.5}
                      onChange={(bgRadius) => onChange({ bgRadius })}
                      suffix="mm"
                    />
                  </Ctl>
                )}
              </>
            )}
          </>
        )}

        {tab === "farbe" && (
          <>
            <Ctl label={isShape ? "Linie" : isPhoto || isImage ? "Rahmen" : "Textfarbe"}>
              <select
                value={isSlot ? st.color : "custom"}
                onChange={(e) =>
                  onChange({
                    color: e.target.value === "custom" ? colors[slots[0].key] : e.target.value,
                  })
                }
                className={inputCls}
              >
                {slots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
                <option value="custom">Eigene</option>
              </select>
              {colorInput(isSlot ? colors[st.color] : st.color, (color) => onChange({ color }))}
            </Ctl>

            {isShape && (
              <>
                <Ctl label="Füllung">
                  <button
                    type="button"
                    className={toggle(!!st.fill)}
                    onClick={() => onChange({ fill: st.fill ? null : (slots[0]?.key ?? "accent") })}
                  >
                    {st.fill ? "Gefüllt" : "Ohne"}
                  </button>
                  {st.fill && colorInput(colors[st.fill] ?? st.fill, (fill) => onChange({ fill }))}
                </Ctl>

                <Ctl label="Verlauf">
                  <button
                    type="button"
                    className={toggle(!!st.gradFrom)}
                    onClick={() =>
                      onChange(
                        st.gradFrom
                          ? { gradFrom: null }
                          : {
                              // sichtbar starten: zwei verschiedene Slots, sonst
                              // sieht der frisch eingeschaltete Verlauf einfarbig aus
                              gradFrom: slots[0]?.key ?? "primary",
                              gradTo: slots[1]?.key ?? slots[0]?.key ?? "accent",
                              gradStart: 0,
                              gradEnd: 100,
                              gradAngle: 135,
                            },
                      )
                    }
                  >
                    {st.gradFrom ? "An" : "Aus"}
                  </button>
                </Ctl>

                {st.gradFrom && (
                  <>
                    <Ctl label="Von / Bis">
                      {colorInput(colors[st.gradFrom] ?? st.gradFrom, (gradFrom) =>
                        onChange({ gradFrom }),
                      )}
                      {colorInput(
                        colors[st.gradTo ?? st.gradFrom] ?? st.gradTo ?? st.gradFrom,
                        (gradTo) => onChange({ gradTo }),
                      )}
                    </Ctl>

                    <Ctl label="Startpunkt" grow>
                      <Slider
                        value={st.gradStart ?? 0}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(gradStart) => onChange({ gradStart })}
                        suffix="%"
                      />
                    </Ctl>

                    <Ctl label="Endpunkt" grow>
                      <Slider
                        value={st.gradEnd ?? 100}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(gradEnd) => onChange({ gradEnd })}
                        suffix="%"
                      />
                    </Ctl>

                    <Ctl label="Richtung" grow>
                      <Slider
                        value={st.gradAngle ?? 135}
                        min={0}
                        max={360}
                        step={5}
                        onChange={(gradAngle) => onChange({ gradAngle })}
                        suffix="°"
                      />
                    </Ctl>

                    <Ctl label="Voreingestellt">
                      <div className="flex flex-wrap gap-1">
                        {GRAD_ANGLES.map((g) => (
                          <button
                            key={g.deg}
                            type="button"
                            title={`${g.deg}°`}
                            className={toggle((st.gradAngle ?? 135) === g.deg)}
                            onClick={() => onChange({ gradAngle: g.deg })}
                          >
                            {g.icon}
                          </button>
                        ))}
                      </div>
                    </Ctl>
                  </>
                )}
              </>
            )}

            {isText && (
              <Ctl label="Hervorhebung">
                <button
                  type="button"
                  className={toggle(!!st.bg)}
                  onClick={() =>
                    onChange({ bg: st.bg ? null : (slots[slots.length - 1]?.key ?? "accent") })
                  }
                >
                  {st.bg ? "Badge an" : "Badge aus"}
                </button>
                {st.bg && colorInput(colors[st.bg] ?? st.bg, (bg) => onChange({ bg }))}
              </Ctl>
            )}

            <Ctl label="Deckkraft" grow>
              <Slider
                value={st.opacity}
                min={0.1}
                max={1}
                step={0.05}
                onChange={(opacity) => onChange({ opacity })}
                suffix=""
              />
            </Ctl>
          </>
        )}

        {tab === "rahmen" && (
          <>
            <Ctl label="Rahmenstärke" grow>
              <Slider
                value={st.borderWidth ?? (isPhoto ? FRAME.PHOTO_WIDTH : 0)}
                min={0}
                max={FRAME.MAX_WIDTH}
                step={0.1}
                onChange={(borderWidth) => onChange({ borderWidth })}
                suffix="mm"
              />
            </Ctl>

            <Ctl label="Rahmenfarbe">
              <select
                value={frameIsSlot ? frameKey : "custom"}
                onChange={(e) =>
                  onChange({
                    borderColor:
                      e.target.value === "custom" ? colors[slots[0].key] : e.target.value,
                  })
                }
                className={inputCls}
              >
                {slots.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
                <option value="custom">Eigene</option>
              </select>
              {colorInput(frameIsSlot ? colors[frameKey] : frameKey, (borderColor) =>
                onChange({ borderColor }),
              )}
            </Ctl>

            {/*
              Nur beim Text: Foto und Bild bekommen ihre Ecken über die
              Rahmenform im Register "Form". Ein zweiter Regler zeigte beim
              Kreis (radius 999) einen falschen Wert an.
            */}
            {isText && (
              <Ctl label="Eckenradius" grow>
                <Slider
                  value={st.boxRadius ?? 0}
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(boxRadius) => onChange({ boxRadius })}
                  suffix="mm"
                />
              </Ctl>
            )}
          </>
        )}

        {tab === "bild" && onPickImage && (
          <>
            <Ctl label="Bilddatei">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs hover:bg-accent">
                {block.src ? "Ersetzen" : "Bild wählen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    onPickImage(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              {block.src && (
                <button
                  type="button"
                  className="rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                  onClick={() => onPickImage(null)}
                >
                  Leeren
                </button>
              )}
            </Ctl>

            {isText && (
              <Ctl label="Bildhöhe" grow>
                <Slider
                  value={st.ratio ?? 0.6}
                  min={0.1}
                  max={2}
                  step={0.05}
                  onChange={(ratio) => onChange({ ratio })}
                  suffix="×"
                />
              </Ctl>
            )}

            <PhotoControls style={st} onChange={onChange} hasPhoto={cropReady} cropOnly={isText} />

            {isText && (
              <p className="text-xs text-muted-foreground">
                Der Text liegt über dem Bild. Ohne Text ist es einfach ein Bild.
              </p>
            )}
          </>
        )}

        {tab === "position" && (
          <>
            {custom && allowPagePlacement && onCustomChange ? (
              <Ctl label="Seite">
                <select
                  value={custom.page === 2 ? 2 : 1}
                  onChange={(event) =>
                    onCustomChange({ page: Number(event.target.value) === 2 ? 2 : 1 })
                  }
                  className={inputCls}
                  aria-label={`${block.label}: Seite`}
                >
                  <option value={1}>Seite 1</option>
                  <option value={2}>Seite 2</option>
                </select>
              </Ctl>
            ) : null}

            <Ctl label="Position X / Y">
              <input
                type="number"
                aria-label="X in mm"
                value={st.x}
                step={1}
                onChange={(e) => onChange({ x: Number(e.target.value) })}
                className={`${inputCls} w-20`}
              />
              <input
                type="number"
                aria-label="Y in mm"
                value={st.y}
                step={1}
                onChange={(e) =>
                  onChange({
                    y: Number(e.target.value),
                    follows: null,
                    above: null,
                    anchorBottom: false,
                  })
                }
                className={`${inputCls} w-20`}
              />
            </Ctl>

            <Ctl label="Breite" grow>
              <Slider
                value={st.w}
                min={5}
                max={A4_WIDTH_MM}
                step={1}
                onChange={(w) => onChange({ w, ...(lockRatio ? {} : keepHeight(block, w)) })}
                suffix="mm"
              />
            </Ctl>

            {custom && (
              <Ctl label="Ebene">
                <button
                  type="button"
                  className={toggle((st.layer ?? "front") === "back")}
                  onClick={() => onChange({ layer: "back" } as Partial<LayeredStyle>)}
                >
                  Hinter Text
                </button>
                <button
                  type="button"
                  className={toggle((st.layer ?? "front") === "front")}
                  onClick={() => onChange({ layer: "front" } as Partial<LayeredStyle>)}
                >
                  Vor Text
                </button>
              </Ctl>
            )}

            {(st.follows || st.above || st.anchorBottom) && (
              <Ctl label="Verkettung">
                <button
                  type="button"
                  className={toggle(true)}
                  onClick={() => onChange({ follows: null, above: null, anchorBottom: false })}
                  title="Position ist an ein anderes Element bzw. den Blattrand gebunden"
                >
                  Bindung lösen
                </button>
              </Ctl>
            )}
          </>
        )}
      </div>
    </div>
  );
}
