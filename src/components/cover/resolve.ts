import type { Block } from "./types";
import { FONT_STACKS, lineText } from "./types";
import { fitFontSize, measureLines } from "@/lib/text-fit";
import { dossierNameScale } from "@/lib/dossier-theme";

const MM = 96 / 25.4; // px pro mm bei 96dpi
const PT_TO_MM = 25.4 / 72;

type Resolved = { size: number; y: number; height: number };

/**
 * Bestimmt für jeden Block die effektive Schriftgrösse (globale Skalierung +
 * Auto-Verkleinerung) und daraus die tatsächliche y-Position.
 */
export function resolveLayout(
  blocks: Block[],
  fontScale: number,
  spacingDensity = 1,
): Record<string, Resolved> {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const metricsOf = new Map<string, { size: number; height: number }>();

  for (const b of blocks) {
    const st = b.style;
    const text = b.lines.map(lineText).join("\n");
    const metrics = {
      text,
      widthPx: st.w * MM,
      fontFamily: FONT_STACKS[st.font],
      weight: st.weight,
      italic: st.italic,
      tracking: st.tracking,
      uppercase: st.uppercase,
    };

    // M5.4: Titelblatt und CV reagieren zuerst mit derselben sanften
    // Längen-Skalierung. Das exakte fitFontSize bleibt danach die zweite
    // Sicherheitsstufe für die tatsächliche Breite der Titelblatt-Vorlage.
    const nameScale = b.id === "name" ? dossierNameScale(text) : 1;
    const wanted = st.size * fontScale * nameScale;
    const size =
      b.kind !== "text" || !st.maxLines || b.lines.length === 0
        ? wanted
        : fitFontSize({ ...metrics, sizePt: wanted, maxLines: st.maxLines });

    const height =
      b.kind === "photo" || b.kind === "shape"
        ? st.w * (st.ratio ?? 1)
        : b.lines.length === 0
          ? 0
          : measureLines({ ...metrics, sizePt: size }) * size * st.lineHeight * PT_TO_MM +
            (st.bg ? st.padY * 2 : 0);

    metricsOf.set(b.id, { size, height });
  }

  const out: Record<string, Resolved> = {};
  const visiting = new Set<string>();

  const resolve = (id: string): Resolved => {
    const cached = out[id];
    if (cached) return cached;

    const b = byId.get(id)!;
    const st = b.style;
    const { size, height } = metricsOf.get(id)!;

    let y = st.anchorBottom ? st.y - height : st.y;

    const link = st.follows || st.above || null;
    if (link && byId.has(link) && !visiting.has(link)) {
      visiting.add(id);
      const target = resolve(link);
      visiting.delete(id);
      const gap = (st.gap ?? (st.follows ? 4 : 2)) * spacingDensity;
      y = st.follows ? target.y + target.height + gap : target.y - height - gap;
    }

    out[id] = { size, y, height };
    return out[id];
  };

  for (const b of blocks) resolve(b.id);

  /*
   * Kontakt + Beilagen are one semantic footer pair. Historically both bodies
   * were bottom-anchored independently, so their headings started at different
   * heights whenever the columns contained a different number of lines.
   *
   * The generated default attachment layout is identifiable by the title being
   * `above: "beilagen"` and the body still owning its bottom anchor. Only that
   * untouched automatic state is synchronized here: explicit editor moves clear
   * those links/anchors and therefore continue to win.
   */
  const contactTitleBlock = byId.get("kontaktTitel");
  const attachmentsTitleBlock = byId.get("beilagenTitel");
  const attachmentsBodyBlock = byId.get("beilagen");
  const contactTitle = out.kontaktTitel;
  const attachmentsTitle = out.beilagenTitel;
  const attachmentsBody = out.beilagen;

  if (
    contactTitleBlock &&
    attachmentsTitleBlock &&
    attachmentsBodyBlock &&
    contactTitle &&
    attachmentsTitle &&
    attachmentsBody &&
    contactTitleBlock.lines.length > 0 &&
    attachmentsTitleBlock.style.above === "beilagen" &&
    !attachmentsTitleBlock.style.follows &&
    attachmentsBodyBlock.style.anchorBottom === true
  ) {
    const gap = (attachmentsTitleBlock.style.gap ?? 2) * spacingDensity;
    out.beilagenTitel = { ...attachmentsTitle, y: contactTitle.y };
    out.beilagen = {
      ...attachmentsBody,
      y: contactTitle.y + attachmentsTitle.height + gap,
    };
  }

  return out;
}
