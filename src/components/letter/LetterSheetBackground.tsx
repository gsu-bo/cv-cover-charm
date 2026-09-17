import type { CSSProperties } from "react";
import { DossierSheetBackground } from "@/components/dossier/DossierSheetBackground";
import { cvPalette } from "@/components/cv/palette";
import "@/components/dossier/edel-stationery.css";
import "@/components/dossier/legacy-template-refinements.css";
import "@/components/cover/templatefix-24-25.css";
import { freshLetterSpec, type FreshLetterColorRole } from "./fresh-letter-system";
import type { LetterHeaderMode, LetterTemplateId } from "./types";
import { defaultHeaderModeForTemplate } from "@/lib/template-chrome";
import { WARM_FIRST_PAGE_HEADER_HEIGHT_MM } from "./warm-letter-layout";

function pick(colors: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    if (colors[key]) return colors[key];
  }
  return "#111111";
}

function freshRoleColor(role: FreshLetterColorRole, colors: Record<string, string>): string {
  if (role === "primary") return pick(colors, "primary", "accent", "secondary", "ink");
  if (role === "secondary") return pick(colors, "secondary", "accent", "primary", "ink");
  return pick(colors, "accent", "secondary", "primary", "ink");
}

/**
 * Warm's motivation-letter header is deliberately its own composition instead
 * of inheriting the CV background verbatim. The broad teal field keeps the
 * family resemblance while the oversized amber disc and fine orbit line are
 * anchored to the page edge, so the crop reads as intentional rather than as
 * a clipped floating circle.
 */
function WarmLetterBackground({
  colors,
  pageIndex,
  headerMode,
}: {
  colors: Record<string, string>;
  pageIndex: number;
  headerMode: LetterHeaderMode;
}) {
  const palette = cvPalette(colors);
  const primary = pick(colors, "primary", "accent", "secondary", "ink");
  const secondary = pick(colors, "secondary", "accent", "primary", "ink");
  const firstPage = pageIndex === 0;

  return (
    <div
      data-dossier-sheet-background="freundlich"
      data-letter-background-variant="warm"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: palette.paper }}
      aria-hidden="true"
    >
      {headerMode === "compact" ? (
        <div
          data-letter-warm-band
          className="absolute inset-x-0 top-0"
          style={{
            height: firstPage ? `${WARM_FIRST_PAGE_HEADER_HEIGHT_MM}mm` : "14mm",
            backgroundColor: primary,
          }}
        />
      ) : null}

      {firstPage && headerMode === "compact" ? (
        <>
          <div
            data-letter-warm-ring
            className="absolute rounded-full"
            style={{
              right: "-24mm",
              top: "-41mm",
              width: "92mm",
              height: "92mm",
              border: `0.8mm solid ${secondary}`,
              boxSizing: "border-box",
              opacity: 0.78,
            }}
          />
          <div
            data-letter-warm-orb
            className="absolute rounded-full"
            style={{
              right: "-13mm",
              top: "-31mm",
              width: "72mm",
              height: "72mm",
              backgroundColor: secondary,
              opacity: 0.72,
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function FreshLetterBackground({
  template,
  colors,
}: {
  template: LetterTemplateId;
  colors: Record<string, string>;
}) {
  const spec = freshLetterSpec(template);
  if (!spec) return null;

  const palette = cvPalette(colors);

  return (
    <div
      data-dossier-sheet-background={template}
      data-letter-background-variant="fresh"
      data-letter-fresh-template={template}
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: palette.paper }}
      aria-hidden="true"
    >
      {spec.motifs.map((motif) => {
        const baseColor = freshRoleColor(motif.color, colors);
        const gradientColor = motif.gradientTo ? freshRoleColor(motif.gradientTo, colors) : null;
        const style: CSSProperties = {
          position: "absolute",
          left: `${motif.x}mm`,
          top: `${motif.y}mm`,
          width: `${motif.w}mm`,
          height: `${motif.h}mm`,
          opacity: motif.opacity ?? 1,
          borderRadius: motif.radiusMm ? `${motif.radiusMm}mm` : undefined,
          clipPath: motif.clipPath,
          background:
            !motif.borderMm && gradientColor
              ? `linear-gradient(90deg, ${baseColor}, ${gradientColor})`
              : undefined,
          backgroundColor: !motif.borderMm && !gradientColor ? baseColor : undefined,
          border: motif.borderMm ? `${motif.borderMm}mm solid ${baseColor}` : undefined,
          boxSizing: "border-box",
        };

        return (
          <div
            key={motif.id}
            data-letter-motif={motif.id}
            data-letter-motif-role={motif.color}
            style={style}
          />
        );
      })}
    </div>
  );
}

function QuietColumnBackground({
  template,
  colors,
}: {
  template: "blockig" | "terracotta" | "studio";
  colors: Record<string, string>;
}) {
  const palette = cvPalette(colors);
  const primary = pick(colors, "primary", "accent", "secondary", "ink");
  const secondary = pick(colors, "secondary", "accent", "primary", "ink");
  const accent = pick(colors, "accent", "secondary", "primary", "ink");

  return (
    <div
      data-dossier-sheet-background={template}
      data-letter-background-variant="quiet-column"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: palette.paper }}
      aria-hidden="true"
    >
      {template === "blockig" ? (
        <>
          <div
            data-letter-safe-rail
            data-letter-motif="rail"
            className="absolute inset-y-0 left-0 w-[19mm]"
            style={{ backgroundColor: primary }}
          />
        </>
      ) : null}

      {template === "terracotta" ? (
        <>
          <div
            data-letter-safe-rail
            data-letter-motif="rail"
            className="absolute inset-y-0 left-0 w-[17mm]"
            style={{ backgroundColor: primary }}
          />
          <div
            data-letter-motif="rail-rule"
            className="absolute left-[6mm] top-[20mm] h-[38mm] w-px"
            style={{ backgroundColor: secondary, opacity: 0.82 }}
          />
        </>
      ) : null}

      {template === "studio" ? (
        <>
          <div
            data-letter-safe-rail
            data-letter-motif="rail"
            className="absolute inset-y-0 left-0 w-[20mm]"
            style={{ backgroundColor: primary }}
          />
          <div
            data-letter-motif="accent-block"
            className="absolute left-0 top-[20mm] h-[14mm] w-[20mm]"
            style={{ backgroundColor: accent }}
          />
          <div
            data-letter-motif="rail-rule"
            className="absolute left-[6mm] top-[43mm] h-[2mm] w-[8mm]"
            style={{ backgroundColor: secondary }}
          />
        </>
      ) : null}
    </div>
  );
}

/**
 * Horizont's cover owns the oversized lower field. On a motivation letter the
 * shared dossier chrome already renders the configurable footer, so inheriting
 * the CV background would create a second 24 mm band and the old orange wedge.
 * Keep the sheet itself quiet and let the shared footer be the only footer.
 */
function QuietHorizonLetterBackground({ colors }: { colors: Record<string, string> }) {
  const palette = cvPalette(colors);
  return (
    <div
      data-dossier-sheet-background="welle"
      data-letter-background-variant="quiet-horizon"
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: palette.paper }}
      aria-hidden="true"
    />
  );
}

/**
 * Motivation letters keep template identity without borrowing CV geometry.
 * Fresh templates render directly from their dedicated letter specification;
 * the three legacy column templates keep their intentionally quiet rails.
 */
export function LetterSheetBackground({
  template,
  colors,
  pageIndex = 0,
  headerMode = defaultHeaderModeForTemplate(template),
}: {
  template: LetterTemplateId;
  colors: Record<string, string>;
  pageIndex?: number;
  headerMode?: LetterHeaderMode;
}) {
  if (freshLetterSpec(template)) {
    return <FreshLetterBackground template={template} colors={colors} />;
  }

  if (template === "freundlich") {
    return <WarmLetterBackground colors={colors} pageIndex={pageIndex} headerMode={headerMode} />;
  }

  if (template === "welle") {
    return <QuietHorizonLetterBackground colors={colors} />;
  }

  if (template === "blockig" || template === "terracotta" || template === "studio") {
    return <QuietColumnBackground template={template} colors={colors} />;
  }

  return <DossierSheetBackground template={template} colors={colors} pageIndex={pageIndex} />;
}
