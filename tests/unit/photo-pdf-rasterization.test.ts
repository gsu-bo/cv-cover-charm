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

test("PDF clone uses the loaded live ICC photo when the cloned image is not decoded yet", () => {
  const legacy = jpegDataUrl("\xff\xd8\xff\xe2\x00\x20ICC_PROFILE\x00\x01\x01late-clone-photo");
  const safe = jpegDataUrl("\xff\xd8\xff\xe0\x00\x10JFIF\x00safe-photo");
  const output = jpegDataUrl("\xff\xd8\xff\xe0\x00\x10JFIF\x00normalized-output");
  let canvasCreates = 0;
  let drawCalls = 0;
  let drawnImage: HTMLImageElement | null = null;

  const liveImages: HTMLImageElement[] = [];
  const liveDocument = {
    querySelectorAll: () => liveImages,
  } as unknown as Document;
  const cloneDocument = {
    defaultView: { frameElement: { ownerDocument: liveDocument } },
    createElement: () => {
      canvasCreates += 1;
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          fillRect: () => undefined,
          drawImage: (image: HTMLImageElement) => {
            drawCalls += 1;
            drawnImage = image;
          },
        }),
        toDataURL: () => output,
      };
    },
  } as unknown as Document;

  const makeImage = (
    src: string,
    ownerDocument: Document,
    complete = true,
    naturalWidth = 1200,
    naturalHeight = 994,
  ) =>
    ({
      tagName: "IMG",
      src,
      complete,
      naturalWidth,
      naturalHeight,
      ownerDocument,
      getAttribute: (name: string) => (name === "src" ? src : null),
    }) as unknown as HTMLImageElement;

  const liveLegacyImage = makeImage(legacy, liveDocument);
  liveImages.push(liveLegacyImage);

  const safeImage = makeImage(safe, cloneDocument);
  const legacyClone = makeImage(legacy, cloneDocument, false, 0, 0);
  const root = {
    tagName: "DIV",
    querySelectorAll: () => [safeImage, legacyClone],
  } as unknown as HTMLElement;

  normalizeDataUrlJpegsForHtml2Canvas(root);

  expect(safeImage.src).toBe(safe);
  expect(legacyClone.src).toBe(output);
  expect(canvasCreates).toBe(1);
  expect(drawCalls).toBe(1);
  expect(drawnImage).toBe(liveLegacyImage);

  // A second clone with the same legacy source uses the cached normalized JPEG
  // even when that clone has not decoded the original source either.
  const repeatedLegacy = makeImage(legacy, cloneDocument, false, 0, 0);
  normalizeDataUrlJpegsForHtml2Canvas({
    tagName: "DIV",
    querySelectorAll: () => [repeatedLegacy],
  } as unknown as HTMLElement);

  expect(repeatedLegacy.src).toBe(output);
  expect(canvasCreates).toBe(1);
  expect(drawCalls).toBe(1);
});
