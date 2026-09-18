import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ScaledPreview } from "@/components/cover/ScaledPreview";
import type { DossierChromeContact, DossierChromeOptions } from "@/lib/dossier-chrome";
import { LetterCanvas } from "./LetterCanvas";
import { withLetterPaginationPageContext } from "./letter-page-context";
import {
  paginateMeasuredLetter,
  type LetterPageFragment,
  type LetterPaginationIssue,
} from "./letter-pagination";
import { letterRichHtml, plainTextToRichHtml, richHtmlToPlainText } from "./rich-text";
import type { LetterData, LetterDesign, LetterFlowImage } from "./types";
import "./letter-pagination.css";

const PLACEHOLDER =
  "Hier entsteht dein persönliches Motivationsschreiben. Erkläre, weshalb du dich für diesen Beruf und diesen Lehrbetrieb interessierst und was du mitbringst.";
const PROBE_BODY_HTML = '<div data-align="justify">Messzeile für den Seitenumbruch</div>';
const EMPTY_BODY_HTML = '<div data-align="justify"><br></div>';

export type LetterPaginationState = {
  ready: boolean;
  pageCount: number;
  issue: LetterPaginationIssue | null;
};

type Props = {
  data: LetterData;
  design: LetterDesign;
  exportMode?: boolean;
  chromeOptions?: DossierChromeOptions;
  chromeContact?: DossierChromeContact;
  onPaginationChange?: (state: LetterPaginationState) => void;
  onImageChange?: (id: string, patch: Partial<LetterFlowImage>) => void;
  onImageRemove?: (id: string) => void;
  /** Visible editor mode: each physical A4 page gets the established responsive scaler. */
  scaledPreview?: boolean;
  ariaLabel?: string;
};

function resolvedBodyHtml(data: LetterData, exportMode: boolean): string {
  if (data.richTextHtml?.trim()) return letterRichHtml(data.richTextHtml, data.text);
  if (data.text) return plainTextToRichHtml(data.text);
  return exportMode ? "" : plainTextToRichHtml(PLACEHOLDER);
}

function pageChromeOptions(
  options: DossierChromeOptions | undefined,
  finalPage: boolean,
): DossierChromeOptions | undefined {
  if (!options || finalPage || options.footerMode !== "details") return options;
  return { ...options, footerMode: "compact" };
}

function pageDesign(design: LetterDesign, pageIndex: number, finalPage: boolean): LetterDesign {
  const resolved =
    !finalPage && design.footerMode === "attachments"
      ? { ...design, footerMode: "compact" as const }
      : design;
  return withLetterPaginationPageContext(resolved, { pageIndex, finalPage });
}

function pageData(
  data: LetterData,
  bodyHtml: string,
  images: LetterFlowImage[],
  finalPage: boolean,
): LetterData {
  return {
    ...data,
    text: richHtmlToPlainText(bodyHtml),
    richTextHtml: bodyHtml || EMPTY_BODY_HTML,
    images,
    showBeilagen: finalPage ? data.showBeilagen : false,
  };
}

function LetterPageShell({
  fragment,
  data,
  design,
  chromeOptions,
  chromeContact,
  exportMode,
  onImageChange,
  onImageRemove,
  ariaLabel,
}: {
  fragment: LetterPageFragment;
  data: LetterData;
  design: LetterDesign;
  chromeOptions?: DossierChromeOptions;
  chromeContact?: DossierChromeContact;
  exportMode: boolean;
  onImageChange?: (id: string, patch: Partial<LetterFlowImage>) => void;
  onImageRemove?: (id: string) => void;
  ariaLabel: string;
}) {
  const contextualDesign = pageDesign(design, fragment.pageIndex, fragment.finalPage);
  const contextualChrome = pageChromeOptions(chromeOptions, fragment.finalPage);
  const contextualData = pageData(data, fragment.bodyHtml, fragment.images, fragment.finalPage);

  return (
    <div
      data-letter-document-page
      data-letter-document-page-index={fragment.pageIndex}
      data-letter-document-final-page={fragment.finalPage ? "true" : "false"}
      data-letter-continuation-page={fragment.pageIndex > 0 ? "true" : undefined}
      data-letter-nonfinal-page={!fragment.finalPage ? "true" : undefined}
    >
      <LetterCanvas
        data={contextualData}
        design={contextualDesign}
        chromeOptions={contextualChrome}
        chromeContact={chromeContact}
        exportMode={exportMode}
        onImageChange={onImageChange}
        onImageRemove={onImageRemove}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}

function MeasurementProbe({
  name,
  pageIndex,
  finalPage,
  bodyHtml,
  images,
  data,
  design,
  chromeOptions,
  chromeContact,
}: {
  name: string;
  pageIndex: number;
  finalPage: boolean;
  bodyHtml: string;
  images: LetterFlowImage[];
  data: LetterData;
  design: LetterDesign;
  chromeOptions?: DossierChromeOptions;
  chromeContact?: DossierChromeContact;
}) {
  const fragment: LetterPageFragment = { pageIndex, finalPage, bodyHtml, images };
  return (
    <div data-letter-pagination-probe={name} aria-hidden="true">
      <LetterPageShell
        fragment={fragment}
        data={data}
        design={design}
        chromeOptions={chromeOptions}
        chromeContact={chromeContact}
        exportMode
        ariaLabel="Messseite Motivationsschreiben"
      />
    </div>
  );
}

async function settleMeasurementImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete) {
        try {
          await image.decode();
        } catch {
          // A decoded data URL is preferable, but the browser still exposes
          // measurable dimensions for already-complete images when decode fails.
        }
        return;
      }
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }),
  );
}

export function LetterDocument({
  data,
  design,
  exportMode = false,
  chromeOptions,
  chromeContact,
  onPaginationChange,
  onImageChange,
  onImageRemove,
  scaledPreview = false,
  ariaLabel = "Vorschau Motivationsschreiben",
}: Props) {
  const bodyHtml = useMemo(() => resolvedBodyHtml(data, exportMode), [data, exportMode]);
  const allImages = useMemo(() => data.images ?? [], [data.images]);
  const freeImages = useMemo(
    () => allImages.filter((image) => typeof image.xMm === "number" && Number.isFinite(image.xMm)),
    [allImages],
  );
  const flowImages = useMemo(
    () => allImages.filter((image) => typeof image.xMm !== "number" || !Number.isFinite(image.xMm)),
    [allImages],
  );
  const measurementRef = useRef<HTMLDivElement>(null);
  const fallback = useMemo<LetterPageFragment[]>(
    () => [
      {
        pageIndex: 0,
        finalPage: true,
        bodyHtml: bodyHtml || EMPTY_BODY_HTML,
        images: allImages,
      },
    ],
    [allImages, bodyHtml],
  );
  const [pages, setPages] = useState<LetterPageFragment[]>(fallback);
  const [pagination, setPagination] = useState<LetterPaginationState>({
    ready: false,
    pageCount: fallback.length,
    issue: null,
  });

  useEffect(() => {
    onPaginationChange?.(pagination);
  }, [onPaginationChange, pagination]);

  useLayoutEffect(() => {
    let cancelled = false;
    setPagination((current) =>
      current.ready || current.issue
        ? { ready: false, pageCount: current.pageCount, issue: null }
        : current,
    );

    const measure = async () => {
      const root = measurementRef.current;
      if (!root) return;
      await document.fonts?.ready;
      await settleMeasurementImages(root);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (cancelled || !measurementRef.current) return;

      // Probe canvases are real LetterCanvas instances so typography and chrome
      // are exact, but they are not document pages and must never enter PDF page
      // collection or page-count assertions.
      for (const page of root.querySelectorAll<HTMLElement>("[data-letter-page]")) {
        page.removeAttribute("data-letter-page");
        page.setAttribute("data-letter-measurement-page", "true");
      }

      // Free images are page overlays, not flow content. Only left/right images
      // reduce text capacity; free images stay on the first page at their x/y.
      const result = paginateMeasuredLetter(root, flowImages);
      if (cancelled) return;
      if (result.issue) {
        setPages(fallback);
        setPagination({ ready: true, pageCount: fallback.length, issue: result.issue });
        return;
      }

      const resolvedPages = result.pages.map((fragment) =>
        fragment.pageIndex === 0
          ? { ...fragment, images: [...fragment.images, ...freeImages] }
          : fragment,
      );
      setPages(resolvedPages);
      setPagination({ ready: true, pageCount: resolvedPages.length, issue: null });
    };

    void measure();
    return () => {
      cancelled = true;
    };
  }, [bodyHtml, chromeContact, chromeOptions, data, design, fallback, flowImages, freeImages]);

  // Keep the last valid page set mounted while a new measurement is running.
  // Replacing a two-page preview with the one-page fallback on every keystroke
  // shrinks the scroll container, clamps its scroll position and makes page 2
  // visibly jump. `pages` already starts with the fallback and is replaced by
  // the fallback on an actual pagination error, so readiness alone must not
  // decide which page set is rendered.
  const renderedPages = useMemo(() => {
    if (pagination.issue) return fallback;

    // Pagination owns the page assignment, while interactive image geometry
    // must follow pointer updates immediately. Keep each image on its last
    // valid page during measurement, but render its newest saved geometry.
    const latestImages = new Map(allImages.map((image) => [image.id, image]));
    return pages.map((fragment) => ({
      ...fragment,
      images: fragment.images.flatMap((image) => {
        const latest = latestImages.get(image.id);
        return latest ? [latest] : [];
      }),
    }));
  }, [allImages, fallback, pages, pagination.issue]);

  return (
    <div
      data-letter-document-root
      data-letter-pagination-ready={pagination.ready ? "true" : "false"}
      data-letter-page-count={renderedPages.length}
      data-letter-pagination-error={pagination.issue?.code}
      data-letter-pagination-error-message={pagination.issue?.message}
    >
      <div data-letter-document-pages className={scaledPreview ? "grid w-full gap-6" : undefined}>
        {renderedPages.map((fragment) => {
          const page = (
            <LetterPageShell
              key={`letter-page-${fragment.pageIndex}`}
              fragment={fragment}
              data={data}
              design={design}
              chromeOptions={chromeOptions}
              chromeContact={chromeContact}
              exportMode={exportMode}
              onImageChange={onImageChange}
              onImageRemove={onImageRemove}
              ariaLabel={`${ariaLabel} – Seite ${fragment.pageIndex + 1}`}
            />
          );
          return scaledPreview ? (
            <ScaledPreview key={`scaled-letter-page-${fragment.pageIndex}`} max={1}>
              {page}
            </ScaledPreview>
          ) : (
            page
          );
        })}
      </div>

      <div ref={measurementRef} data-letter-pagination-measurements aria-hidden="true">
        <MeasurementProbe
          name="source"
          pageIndex={1}
          finalPage={false}
          bodyHtml={bodyHtml || EMPTY_BODY_HTML}
          images={[]}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
        <MeasurementProbe
          name="first-flow"
          pageIndex={0}
          finalPage={false}
          bodyHtml={bodyHtml || EMPTY_BODY_HTML}
          images={[]}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
        <MeasurementProbe
          name="first-final"
          pageIndex={0}
          finalPage
          bodyHtml={PROBE_BODY_HTML}
          images={[]}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
        <MeasurementProbe
          name="continuation-flow"
          pageIndex={1}
          finalPage={false}
          bodyHtml={bodyHtml || EMPTY_BODY_HTML}
          images={[]}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
        <MeasurementProbe
          name="continuation-final"
          pageIndex={1}
          finalPage
          bodyHtml={PROBE_BODY_HTML}
          images={[]}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
        <MeasurementProbe
          name="image-source"
          pageIndex={1}
          finalPage={false}
          bodyHtml={PROBE_BODY_HTML}
          images={flowImages}
          data={data}
          design={design}
          chromeOptions={chromeOptions}
          chromeContact={chromeContact}
        />
      </div>
    </div>
  );
}
