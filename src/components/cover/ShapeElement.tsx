import { useId } from "react";
import type { BlockStyle, ShapeKind } from "./types";
import { resolveColor } from "./layouts";

type Props = {
  shape: ShapeKind;
  path?: string;
  style: BlockStyle;
  colors: Record<string, string>;
};

/**
 * Zeichnet eine selbst hinzugefügte Form. Alle Masse in mm, damit Vorschau und
 * PDF-Export dieselbe Geometrie verwenden.
 */
/**
 * Verlauf als CSS-Wert, oder `null` wenn keiner eingestellt ist.
 * `gradFrom` schaltet ihn ein und ersetzt die Füllfarbe.
 */
export function gradientCss(st: BlockStyle, colors: Record<string, string>): string | null {
  if (!st.gradFrom) return null;
  const from = resolveColor(st.gradFrom, colors);
  const to = resolveColor(st.gradTo ?? st.gradFrom, colors);
  const start = st.gradStart ?? 0;
  const end = st.gradEnd ?? 100;
  return `linear-gradient(${st.gradAngle ?? 135}deg, ${from} ${start}%, ${to} ${end}%)`;
}

export function ShapeElement({ shape, path, style: st, colors }: Props) {
  const gradId = useId();
  const stroke = resolveColor(st.color, colors);
  const grad = gradientCss(st, colors);
  const fill = grad ?? (st.fill ? resolveColor(st.fill, colors) : "transparent");
  const widthMm = st.w;
  const heightMm = st.w * (st.ratio ?? 1);
  const strokeMm = st.strokeWidth ?? 0.8;

  if (shape === "line") {
    return (
      <div
        style={{
          width: "100%",
          height: `${Math.max(strokeMm, 0.2)}mm`,
          // beim Strich färbt der Verlauf die Linie selbst
          background: grad ?? stroke,
          opacity: st.opacity,
        }}
      />
    );
  }

  if (shape === "path") {
    // Im SVG zieht ein CSS-Verlauf nicht – dort braucht die Füllung eine
    // Referenz auf einen eigenen Verlauf.
    const angle = ((st.gradAngle ?? 135) * Math.PI) / 180;
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: `${heightMm}mm`, opacity: st.opacity, display: "block" }}
      >
        {grad && (
          <defs>
            <linearGradient
              id={gradId}
              x1={50 - Math.sin(angle) * 50}
              y1={50 + Math.cos(angle) * 50}
              x2={50 + Math.sin(angle) * 50}
              y2={50 - Math.cos(angle) * 50}
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset={`${st.gradStart ?? 0}%`}
                stopColor={resolveColor(st.gradFrom!, colors)}
              />
              <stop
                offset={`${st.gradEnd ?? 100}%`}
                stopColor={resolveColor(st.gradTo ?? st.gradFrom!, colors)}
              />
            </linearGradient>
          </defs>
        )}
        <path
          d={path ?? ""}
          style={{ pointerEvents: "visiblePainted", cursor: "inherit" }}
          fill={grad ? `url(#${gradId})` : st.fill ? fill : "none"}
          stroke={stroke}
          // Strichstärke in mm auf das 0–100-Koordinatensystem umrechnen
          strokeWidth={(strokeMm / Math.max(widthMm, 1)) * 100}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: `${heightMm}mm`,
        background: fill,
        border: strokeMm > 0 ? `${strokeMm}mm solid ${stroke}` : "none",
        borderRadius: shape === "circle" ? "9999px" : `${st.bgRadius >= 999 ? 0 : st.bgRadius}mm`,
        opacity: st.opacity,
        boxSizing: "border-box",
      }}
    />
  );
}
