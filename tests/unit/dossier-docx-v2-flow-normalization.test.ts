import { describe, expect, test } from "bun:test";
import { dossierDocxV2FlowCalibrationInternals } from "../../src/lib/dossier-docx-v2-flow-calibration";
import type { DossierDocxV2FlowBlock } from "../../src/lib/dossier-docx-v2-flow-scene";

const run = (text: string) => ({
  text,
  font: "Arial",
  fontSizePt: 10,
  color: "#111111",
  bold: false,
  italic: false,
  underline: false,
});

const paragraph = (text: string): DossierDocxV2FlowBlock => ({
  kind: "paragraph",
  id: "measured",
  runs: text ? [run(text)] : [],
  align: "left",
  beforeMm: 0,
  afterMm: 0,
  lineHeight: 1.55,
});

describe("DOCX V2 measured flow normalization", () => {
  test("turns measured empty browser paragraphs into compact explicit spacers", () => {
    const normalized = dossierDocxV2FlowCalibrationInternals.normalizeMeasuredLetterBodyBlock(
      paragraph(""),
    );
    expect(normalized).toEqual({ kind: "spacer", id: "measured", mm: 4.5 });
  });

  test("collapses incidental browser line breaks inside measured CV text", () => {
    const normalized = dossierDocxV2FlowCalibrationInternals.normalizeMeasuredCvBlock(
      paragraph("•\nProgrammieren"),
    );
    expect(normalized.kind).toBe("paragraph");
    if (normalized.kind !== "paragraph") throw new Error("paragraph missing");
    expect(normalized.runs[0]?.text).toBe("• Programmieren");
  });

  test("normalizes measured CV text recursively inside browser grid cells", () => {
    const grid: DossierDocxV2FlowBlock = {
      kind: "table",
      id: "grid",
      afterMm: 0,
      rows: [
        {
          cells: [
            {
              widthPct: 50,
              blocks: [paragraph("•\nTeamfähig")],
            },
          ],
        },
      ],
    };
    const normalized = dossierDocxV2FlowCalibrationInternals.normalizeMeasuredCvBlock(grid);
    expect(normalized.kind).toBe("table");
    if (normalized.kind !== "table") throw new Error("table missing");
    const child = normalized.rows[0]?.cells[0]?.blocks[0];
    expect(child?.kind).toBe("paragraph");
    if (!child || child.kind !== "paragraph") throw new Error("child paragraph missing");
    expect(child.runs[0]?.text).toBe("• Teamfähig");
  });
});
