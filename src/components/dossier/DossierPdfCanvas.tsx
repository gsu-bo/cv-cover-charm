import { forwardRef } from "react";
import "@/components/cover/fresh-templates";
import { CoverCanvas } from "@/components/cover/CoverCanvas";
import { CvCanvas } from "@/components/cv/CvCanvas";
import type { CvLayoutWarning } from "@/components/cv/CvCanvas";
import { LetterDocument } from "@/components/letter/LetterDocument";
import {
  letterPdfDocumentFromSaved,
  type CoverPdfDocument,
  type CvPdfDocument,
  type LetterPdfDocument,
} from "@/lib/dossier-pdf-document";
import { LETTER_STORAGE_KEY, readStoredDossierPart } from "@/lib/dossier-project";
import { DEFAULT_DOSSIER_CHROME_STATE, type DossierChromeState } from "@/lib/dossier-chrome";
import { resolveDossierChromeSnapshot } from "@/lib/dossier-resolved-chrome";

const ignoreSelection = () => {};
const ignoreMove = () => {};

/** Unsichtbarer 1:1-Drucksatz: Titelblatt, alle Anschreiben-Seiten, danach sämtliche CV-Seiten. */
export const DossierPdfCanvas = forwardRef<
  HTMLDivElement,
  {
    cover: CoverPdfDocument | null;
    /** Optional explizit übergeben; bestehende Editoren lesen sonst den gespeicherten Brief. */
    letter?: LetterPdfDocument | null;
    cv: CvPdfDocument | null;
    chromeState?: DossierChromeState;
    onCvLayoutWarnings?: (warnings: CvLayoutWarning[]) => void;
    onCvPageCount?: (count: number) => void;
  }
>(function DossierPdfCanvas(
  {
    cover,
    letter,
    cv,
    chromeState = DEFAULT_DOSSIER_CHROME_STATE,
    onCvLayoutWarnings,
    onCvPageCount,
  },
  ref,
) {
  const storedLetter =
    letter === undefined
      ? letterPdfDocumentFromSaved(readStoredDossierPart(LETTER_STORAGE_KEY))
      : letter;
  const resolvedChrome = resolveDossierChromeSnapshot(
    { cover, letter: storedLetter, cv },
    chromeState,
  );

  return (
    <div ref={ref}>
      {cover ? (
        <CoverCanvas
          template={cover.template}
          data={cover.data}
          colors={cover.colors}
          blocks={cover.blocks}
          selected={null}
          onSelect={ignoreSelection}
          onMove={ignoreMove}
          fontScale={cover.fontScale}
          editable={false}
          manageGlobalTemplateScope={false}
        />
      ) : null}
      {storedLetter ? (
        <div
          data-dossier-document="letter"
          data-dossier-template={storedLetter.design.template}
        >
          <LetterDocument
            data={storedLetter.data}
            design={storedLetter.design}
            chromeOptions={resolvedChrome.letter.options}
            chromeContact={resolvedChrome.letter.contact}
            exportMode
          />
        </div>
      ) : null}
      {cv ? (
        <CvCanvas
          data={cv.data}
          design={cv.design}
          chromeOptions={resolvedChrome.cv.options}
          chromeContact={resolvedChrome.cv.contact}
          elements={cv.elements}
          elementStyles={cv.elementStyles}
          exportMode
          manageGlobalTemplateScope={false}
          onLayoutWarnings={onCvLayoutWarnings}
          onPageCount={onCvPageCount}
        />
      ) : null}
    </div>
  );
});
