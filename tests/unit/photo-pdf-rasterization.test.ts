import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  jpegDataUrlHasIccProfile,
  normalizeDataUrlJpegsForHtml2Canvas,
} from "../../src/lib/html2canvas-export";

const imageReader = readFileSync("src/lib/image.ts", "utf8");

function jpegDataUrl(bytes: string) {
  return `data:image/jpeg;base64,${Buffer.from(bytes, "latin1").toString("base64")}`;
}

test("uploaded CV photos are always browser-normalized before they enter saved state", () => {
  expect(imageReader).not.toContain("src.length < 600_000");
  expect(imageReader).toContain('ctx.fillStyle = "#ffffff"');
  expect(imageReader).toContain('canvas.toDataURL("image/jpeg", PHOTO.QUALITY)');
  expect(imageReader).toContain("img.naturalWidth || img.width");
});

test("legacy JPEG ICC profiles are detected without flagging browser-normalized JPEGs", () => {
  const legacy = jpegDataUrl("\xff\xd8\xff\xe2\x00\x20ICC_PROFILE\x00\x01\x01legacy");
  const normalized = jpegDataUrl("\xff\xd8\xff\xe0\x00\x10JFIF\x00browser-normalized");

  expect(jpegDataUrlHasIccProfile(legacy)).toBe(true);
  expect(jpegDataUrlHasIccProfile(normalized)).toBe(false);
  expect(jpegDataUrlHasIccProfile("data:image/png;base64,AAAA")).toBe(false);
});

test("PDF clone re-encodes only ICC-bearing legacy JPEGs and caches the result", () => {
  const legacy = jpegDataUrl("\xff\xd8\xff\xe2\x00\x20ICC_PROFILE\x00\x01\x01legacy-photo");
  const safe = jpegDataUrl("\xff\xd8\xff\xe0\x00\x10JFIF\x00safe-photo");
  const output = jpegDataUrl("\xff\xd8\xff\xe0\x00\x10JFIF\x00normalized-output");
  let canvasCreates = 0;
  let drawCalls = 0;

  const makeImage = (src: string) => {
    const ownerDocument = {
      createElement: () => {
        canvasCreates += 1;
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            fillStyle: "",
            fillRect: () => undefined,
            drawImage: () => {
              drawCalls += 1;
            },
          }),
          toDataURL: () => output,
        };
      },
    };

    return {
      tagName: "IMG",
      src,
      complete: true,
      naturalWidth: 1200,
      naturalHeight: 994,
      ownerDocument,
      getAttribute: (name: string) => (name === "src" ? src : null),
    } as unknown as HTMLImageElement;
  };

  const safeImage = makeImage(safe);
  const legacyImage = makeImage(legacy);
  const root = {
    tagName: "DIV",
    querySelectorAll: () => [safeImage, legacyImage],
  } as unknown as HTMLElement;

  normalizeDataUrlJpegsForHtml2Canvas(root);

  expect(safeImage.src).toBe(safe);
  expect(legacyImage.src).toBe(output);
  expect(canvasCreates).toBe(1);
  expect(drawCalls).toBe(1);

  // A second clone with the same legacy source uses the cached normalized JPEG
  // instead of paying another lossy encode and canvas allocation.
  const repeatedLegacy = makeImage(legacy);
  normalizeDataUrlJpegsForHtml2Canvas({
    tagName: "DIV",
    querySelectorAll: () => [repeatedLegacy],
  } as unknown as HTMLElement);

  expect(repeatedLegacy.src).toBe(output);
  expect(canvasCreates).toBe(1);
  expect(drawCalls).toBe(1);
});
