import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../src/components/cover/templatefix-frame.css", import.meta.url),
  "utf8",
);
const defaults = readFileSync(
  new URL("../../src/components/cover/forest-flow-cover-defaults.ts", import.meta.url),
  "utf8",
);

test("Frame cover is fully replaced by two equal corner triangles", () => {
  expect(css).toContain("FULL REPLACEMENT: equal corner triangles");
  expect(css).toContain("width: 92mm;");
  expect(css).toContain("height: 76mm;");
  expect(css).toContain("width: 92mm !important;");
  expect(css).toContain("height: 76mm !important;");
  expect(css).toContain("clip-path: polygon(0 0, 100% 0, 0 100%);");
  expect(css).toContain("clip-path: polygon(100% 0, 100% 100%, 0 100%) !important;");
  expect(css).toContain('[data-fresh-cover-field="accent"]');
  expect(css).toContain("display: none !important;");

  // The historical architectural frame must not survive the replacement.
  expect(css).not.toContain("0.35mm solid");
  expect(css).not.toContain("0.3mm solid");
  expect(css).not.toContain("inset: 10mm");
});

test("Frame CV and letter use the same reduced equal triangle pair", () => {
  expect(css).toContain('data-dossier-sheet-background="frame"');
  expect(css).toContain('data-letter-template="frame"');
  expect(css).toContain("width: 30mm !important;");
  expect(css).toContain("height: 22mm !important;");
  expect(css).toContain("content: none !important;");
  expect(css).toContain("display: block !important;");
});

test("Frame compact header keeps identity while the page motif stays suppressed", () => {
  expect(css).toContain('data-dossier-effective-header-mode="compact"');
  expect(css).toContain('data-dossier-header-custom-surface="false"');
  expect(css).toContain("width: 20mm;");
  expect(css).toContain("height: 100%;");
  expect(css).toContain("background: var(--chrome-primary);");
  expect(css).toContain("background: var(--chrome-secondary);");
});

test("Frame content geometry is editor-owned and explicit user overrides stay authoritative", () => {
  expect(defaults).toContain("FRAME_COVER_DEFAULTS");
  expect(defaults).toContain('templateId === "frame"');
  expect(defaults).toContain("foto: {");
  expect(defaults).toContain("kicker: {");
  expect(defaults).toContain("kontaktTitel: {");
  expect(defaults).toContain("if (custom[key] === undefined)");

  // Legacy presentation transforms are explicitly neutralised; x/y/w defaults
  // now live in the editor-owned default adapter instead of late CSS pins.
  expect(css).toContain("transform: none !important;");
  expect(css).not.toContain('[data-block-id="name"] {\n  left:');
  expect(css).not.toContain('[data-block-id="foto"] {\n  left:');
});
