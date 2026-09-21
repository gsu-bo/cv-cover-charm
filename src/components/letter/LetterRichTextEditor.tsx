import { useEffect, useRef, useState } from "react";
import { List, Table2 } from "lucide-react";
import { TextAlignmentControl } from "@/components/dossier/TextAlignmentControl";
import { BODY_TEXT_ALIGNMENTS } from "@/lib/text-alignment";
import {
  compatibleLetterTextAlign,
  letterRichHtml,
  letterTextAlign,
  richHtmlToPlainText,
  sanitizeLetterRichHtml,
  type LetterTextAlign,
} from "@/components/letter/rich-text";
import type { LetterBodyColumns } from "@/components/letter/types";

const toolClass =
  "rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const activeToolClass = "bg-primary text-primary-foreground hover:bg-primary/90";

type LetterListStyle = "bullet" | "dash" | "plus" | "dot";

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: LetterTextAlign | null;
  columns: LetterBodyColumns | null;
  list: LetterListStyle | null;
};

type SelectionBubble = {
  left: number;
  top: number;
  placement: "above" | "below";
};

const LIST_OPTIONS: Array<{ value: LetterListStyle | "none"; marker: string; label: string }> = [
  { value: "bullet", marker: "•", label: "Bullet" },
  { value: "dash", marker: "–", label: "Strich" },
  { value: "plus", marker: "+", label: "Plus" },
  { value: "dot", marker: "·", label: "Punkt zentriert" },
  { value: "none", marker: "", label: "Kein Zeichen" },
];

const TABLE_GRID_SIZE = 8;

function topLevelChild(editor: HTMLElement, node: Node | null): HTMLElement | null {
  if (!node) return null;
  let current: Node | null = node;
  while (current?.parentNode && current.parentNode !== editor) current = current.parentNode;
  return current instanceof HTMLElement && current.parentElement === editor ? current : null;
}

function topLevelBlock(editor: HTMLElement, node: Node | null): HTMLElement | null {
  const current = topLevelChild(editor, node);
  if (!current) return null;
  const tag = current.tagName.toLowerCase();
  return tag === "div" || tag === "p" ? current : null;
}

function rangeIntersects(range: Range, node: Node): boolean {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function editableBlocks(editor: HTMLElement): HTMLElement[] {
  return Array.from(editor.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && ["div", "p"].includes(child.tagName.toLowerCase()),
  );
}

function existingSelectedBlocks(editor: HTMLElement, range: Range): HTMLElement[] {
  return editableBlocks(editor).filter((child) => rangeIntersects(range, child));
}

function ensureSelectedBlocks(editor: HTMLElement, range: Range): HTMLElement[] {
  const existing = existingSelectedBlocks(editor, range);
  if (existing.length) return existing;

  const wrappers: HTMLElement[] = [];
  for (const node of Array.from(editor.childNodes)) {
    if (!rangeIntersects(range, node)) continue;
    if (node instanceof HTMLHRElement || (node instanceof HTMLElement && node.tagName === "TABLE"))
      continue;
    if (node instanceof HTMLElement && ["div", "p"].includes(node.tagName.toLowerCase())) {
      wrappers.push(node);
      continue;
    }
    const wrapper = document.createElement("div");
    editor.insertBefore(wrapper, node);
    wrapper.appendChild(node);
    wrappers.push(wrapper);
  }

  if (wrappers.length) return wrappers;
  const fallback = topLevelBlock(editor, range.startContainer);
  return fallback ? [fallback] : [];
}

function columnsForBlock(block: HTMLElement | null): LetterBodyColumns {
  if (block?.dataset.columns === "2") return 2;
  if (block?.dataset.columns === "3") return 3;
  return 1;
}

function applyColumns(block: HTMLElement, columns: LetterBodyColumns) {
  if (columns === 1) delete block.dataset.columns;
  else {
    block.dataset.columns = String(columns);
    block.dataset.align = "left";
  }
}

function applyAlignment(block: HTMLElement, align: LetterTextAlign) {
  block.dataset.align = align;
  if (align === "justify") delete block.dataset.columns;
}

function alignmentForBlock(block: HTMLElement | null): LetterTextAlign {
  return compatibleLetterTextAlign(block?.dataset.align, block?.dataset.columns);
}

function documentAlignment(editor: HTMLElement): LetterTextAlign | null {
  const values = editableBlocks(editor).map(alignmentForBlock);
  if (!values.length) return "justify";
  return values.every((value) => value === values[0]) ? values[0] : null;
}

function normalizeEditableBlockAlignment(editor: HTMLElement) {
  for (const block of editableBlocks(editor)) {
    block.dataset.align = alignmentForBlock(block);
  }
}

function listForBlock(block: HTMLElement | null): LetterListStyle | null {
  const value = block?.dataset.list;
  return value === "bullet" || value === "dash" || value === "plus" || value === "dot"
    ? value
    : null;
}

function makeTable(rows: number, columns: number): HTMLTableElement {
  const table = document.createElement("table");
  table.dataset.letterTable = "true";
  const body = document.createElement("tbody");
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = document.createElement("tr");
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const cell = document.createElement("td");
      cell.innerHTML = "<br>";
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
  table.appendChild(body);
  return table;
}

export function LetterRichTextEditor({
  text,
  richTextHtml,
  onChange,
}: {
  text: string;
  richTextHtml?: string;
  onChange: (value: { text: string; richTextHtml: string }) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef("");
  const savedRangeRef = useRef<Range | null>(null);
  const [empty, setEmpty] = useState(!text.trim() && !richTextHtml?.trim());
  const [listOpen, setListOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableHover, setTableHover] = useState<{ rows: number; columns: number } | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubble | null>(null);
  const [toolbar, setToolbar] = useState<ToolbarState>({
    bold: false,
    italic: false,
    underline: false,
    align: "justify",
    columns: 1,
    list: null,
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = letterRichHtml(richTextHtml, text);
    if (next === lastEmitted.current) return;
    if (editor.innerHTML !== next) editor.innerHTML = next;
    normalizeEditableBlockAlignment(editor);
    setToolbar((current) => ({ ...current, align: documentAlignment(editor) }));
    setEmpty(!richHtmlToPlainText(next));
  }, [richTextHtml, text]);

  const rememberRange = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      !editor ||
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !editor.contains(selection.anchorNode)
    )
      return null;
    const range = selection.getRangeAt(0).cloneRange();
    savedRangeRef.current = range;
    return range;
  };

  const restoreRange = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    const selection = window.getSelection();
    if (!selection) return null;
    const stored = savedRangeRef.current?.cloneRange();
    if (stored) {
      editor.focus();
      selection.removeAllRanges();
      selection.addRange(stored);
      return stored;
    }
    const fallback = document.createRange();
    fallback.selectNodeContents(editor);
    fallback.collapse(false);
    editor.focus();
    selection.removeAllRanges();
    selection.addRange(fallback);
    savedRangeRef.current = fallback.cloneRange();
    return fallback;
  };

  const readToolbarState = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      !editor ||
      !selection?.rangeCount ||
      !selection.anchorNode ||
      !editor.contains(selection.anchorNode)
    ) {
      setSelectionBubble(null);
      return;
    }

    const range = rememberRange();
    if (!range) {
      setSelectionBubble(null);
      return;
    }

    const blocks = existingSelectedBlocks(editor, range);
    const fallback = topLevelBlock(editor, selection.anchorNode);
    const selected = blocks.length ? blocks : fallback ? [fallback] : [];
    const columnValues = selected.length
      ? selected.map(columnsForBlock)
      : ([1] as LetterBodyColumns[]);
    const columns = columnValues.every((value) => value === columnValues[0])
      ? columnValues[0]
      : null;
    const listValues = selected.map(listForBlock);
    const list =
      listValues.length && listValues.every((value) => value === listValues[0])
        ? listValues[0]
        : null;

    setToolbar({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      align: documentAlignment(editor),
      columns,
      list,
    });

    if (range.collapsed || !selection.toString().trim()) {
      setSelectionBubble(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      setSelectionBubble(null);
      return;
    }

    const bubbleGap = 10;
    const bubbleEdge = 12;
    const bubbleHeight = 44;
    const placement: SelectionBubble["placement"] =
      rect.top >= bubbleHeight + bubbleGap + bubbleEdge ? "above" : "below";
    const center = rect.left + rect.width / 2;
    const rawTop = placement === "above" ? rect.top - bubbleGap : rect.bottom + bubbleGap;
    const top =
      placement === "above"
        ? Math.min(
            Math.max(rawTop, bubbleHeight + bubbleEdge),
            Math.max(bubbleHeight + bubbleEdge, window.innerHeight - bubbleEdge),
          )
        : Math.min(
            Math.max(rawTop, bubbleEdge),
            Math.max(bubbleEdge, window.innerHeight - bubbleHeight - bubbleEdge),
          );
    setSelectionBubble({
      left: Math.min(Math.max(center, 92), Math.max(92, window.innerWidth - 92)),
      top,
      placement,
    });
  };

  useEffect(() => {
    const onSelectionChange = () => readToolbarState();
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("resize", onSelectionChange);
    window.addEventListener("scroll", onSelectionChange, true);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("resize", onSelectionChange);
      window.removeEventListener("scroll", onSelectionChange, true);
    };
  });

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    normalizeEditableBlockAlignment(editor);
    const sanitized = sanitizeLetterRichHtml(editor.innerHTML);
    const plain = richHtmlToPlainText(sanitized);
    lastEmitted.current = sanitized;
    setEmpty(!plain);
    onChange({ text: plain, richTextHtml: sanitized });
  };

  const command = (name: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreRange();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(name, false);
    emit();
    readToolbarState();
  };

  const setAlignment = (align: LetterTextAlign) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Text alignment is deliberately document-wide. Depending on a stale
    // contentEditable selection made the same click affect either one block
    // or the whole letter, while the toolbar still looked active.
    for (const block of editableBlocks(editor)) applyAlignment(block, align);
    emit();
    setToolbar((current) => ({
      ...current,
      align,
      columns: align === "justify" ? 1 : current.columns,
    }));
  };

  const setColumns = (columns: LetterBodyColumns) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (!savedRangeRef.current) {
      for (const block of editableBlocks(editor)) applyColumns(block, columns);
      emit();
      setToolbar((current) => ({
        ...current,
        columns,
        align: columns > 1 ? "left" : current.align,
      }));
      return;
    }

    const range = restoreRange();
    if (!range) return;
    const blocks = ensureSelectedBlocks(editor, range);
    for (const block of blocks) applyColumns(block, columns);
    emit();
    setToolbar((current) => ({
      ...current,
      columns,
      align: columns > 1 ? "left" : current.align,
    }));
  };

  const setListStyle = (style: LetterListStyle | "none") => {
    const editor = editorRef.current;
    const range = restoreRange();
    if (!editor || !range) return;
    const blocks = ensureSelectedBlocks(editor, range);
    for (const block of blocks) {
      if (style === "none") delete block.dataset.list;
      else block.dataset.list = style;
    }
    emit();
    setToolbar((current) => ({ ...current, list: style === "none" ? null : style }));
    setListOpen(false);
  };

  const insertRule = () => {
    const editor = editorRef.current;
    if (!editor) return;
    restoreRange();
    document.execCommand("insertHorizontalRule", false);
    emit();
    readToolbarState();
  };

  const insertTable = (rows: number, columns: number) => {
    const editor = editorRef.current;
    const range = restoreRange();
    if (!editor || !range) return;

    const table = makeTable(rows, columns);
    const topLevel = topLevelChild(editor, range.startContainer);
    if (topLevel) topLevel.insertAdjacentElement("afterend", table);
    else range.insertNode(table);

    const next = table.nextElementSibling;
    if (!(next instanceof HTMLElement) || !["DIV", "P"].includes(next.tagName)) {
      const paragraph = document.createElement("div");
      paragraph.dataset.align = "justify";
      paragraph.innerHTML = "<br>";
      table.insertAdjacentElement("afterend", paragraph);
    }

    const firstCell = table.querySelector("td");
    if (firstCell) {
      const selection = window.getSelection();
      const caret = document.createRange();
      caret.selectNodeContents(firstCell);
      caret.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(caret);
      savedRangeRef.current = caret.cloneRange();
    }

    emit();
    setTableOpen(false);
    setTableHover(null);
    readToolbarState();
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-foreground">Brieftext</span>
      {selectionBubble ? (
        <div
          data-letter-selection-toolbar
          role="toolbar"
          aria-label="Textauswahl formatieren"
          className="fixed z-[80] flex items-center gap-1 rounded-xl border bg-popover p-1 shadow-xl"
          style={{
            left: selectionBubble.left,
            top: selectionBubble.top,
            transform:
              selectionBubble.placement === "above"
                ? "translate(-50%, -100%)"
                : "translate(-50%, 0)",
          }}
        >
          <button
            type="button"
            className={`${toolClass} border-0 px-2 py-1`}
            aria-label="Formatierung entfernen"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("removeFormat")}
          >
            Text
          </button>
          <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-border" />
          <button
            type="button"
            className={`${toolClass} border-0 px-2 py-1 font-bold ${toolbar.bold ? activeToolClass : ""}`}
            aria-label="Fett"
            aria-pressed={toolbar.bold}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("bold")}
          >
            B
          </button>
          <button
            type="button"
            className={`${toolClass} border-0 px-2 py-1 italic ${toolbar.italic ? activeToolClass : ""}`}
            aria-label="Kursiv"
            aria-pressed={toolbar.italic}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("italic")}
          >
            I
          </button>
          <button
            type="button"
            className={`${toolClass} border-0 px-2 py-1 underline ${toolbar.underline ? activeToolClass : ""}`}
            aria-label="Unterstrichen"
            aria-pressed={toolbar.underline}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => command("underline")}
          >
            U
          </button>
        </div>
      ) : null}
      <div
        data-letter-rich-toolbar
        className="relative flex flex-wrap gap-1.5 rounded-t-md border border-b-0 bg-muted/30 p-2"
      >
        <TextAlignmentControl
          value={toolbar.align}
          onChange={setAlignment}
          ariaLabel="Textausrichtung"
          alignments={BODY_TEXT_ALIGNMENTS}
        />

        <span aria-hidden="true" className="h-0 basis-full" />
        <fieldset
          data-letter-column-control
          className="m-0 flex min-w-0 items-center gap-1 rounded-md border border-input bg-background px-1.5 pb-1 pt-0.5"
        >
          <legend className="px-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Spalten
          </legend>
          {([1, 2, 3] as const).map((count) => (
            <button
              key={count}
              type="button"
              className={`${toolClass} min-w-8 px-2 py-1 ${toolbar.columns === count ? activeToolClass : ""}`}
              aria-label={`${count} ${count === 1 ? "Spalte" : "Spalten"}`}
              aria-pressed={toolbar.columns === count}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setColumns(count)}
            >
              {count}
            </button>
          ))}
        </fieldset>

        <div className="relative">
          <button
            type="button"
            className={`${toolClass} flex items-center justify-center px-2 ${toolbar.list ? activeToolClass : ""}`}
            aria-label="Liste"
            aria-expanded={listOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setListOpen((current) => !current);
              setTableOpen(false);
            }}
          >
            <List className="h-4 w-4" />
          </button>
          {listOpen ? (
            <div className="absolute left-0 top-full z-30 mt-1 min-w-44 rounded-md border bg-popover p-1 shadow-lg">
              {LIST_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
                  aria-label={option.label}
                  aria-pressed={
                    option.value === "none" ? toolbar.list === null : toolbar.list === option.value
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setListStyle(option.value)}
                >
                  <span className="w-4 text-center text-sm">{option.marker}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button
            type="button"
            className={`${toolClass} flex items-center justify-center px-2`}
            aria-label="Tabelle"
            aria-expanded={tableOpen}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setTableOpen((current) => !current);
              setListOpen(false);
            }}
          >
            <Table2 className="h-4 w-4" />
          </button>
          {tableOpen ? (
            <div className="absolute left-0 top-full z-30 mt-1 rounded-md border bg-popover p-2 shadow-lg">
              <div className="mb-2 whitespace-nowrap text-center text-[11px] font-medium text-foreground">
                {tableHover
                  ? `${tableHover.rows} × ${tableHover.columns} Tabelle`
                  : "Tabellengrösse"}
              </div>
              <div
                role="grid"
                aria-label="Tabellengrösse auswählen"
                className="grid grid-cols-8 gap-1"
                onMouseLeave={() => setTableHover(null)}
              >
                {Array.from({ length: TABLE_GRID_SIZE * TABLE_GRID_SIZE }, (_, index) => {
                  const row = Math.floor(index / TABLE_GRID_SIZE) + 1;
                  const column = (index % TABLE_GRID_SIZE) + 1;
                  const highlighted =
                    !!tableHover && row <= tableHover.rows && column <= tableHover.columns;
                  return (
                    <button
                      key={`${row}-${column}`}
                      type="button"
                      role="gridcell"
                      aria-label={`Tabelle ${row} × ${column} einfügen`}
                      className={`h-4 w-4 rounded-[2px] border ${
                        highlighted
                          ? "border-primary bg-primary/25"
                          : "bg-background hover:bg-muted"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setTableHover({ rows: row, columns: column })}
                      onFocus={() => setTableHover({ rows: row, columns: column })}
                      onClick={() => insertTable(row, column)}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={toolClass}
          aria-label="Trennlinie einfügen"
          onMouseDown={(event) => event.preventDefault()}
          onClick={insertRule}
        >
          ─
        </button>
      </div>
      <div className="relative">
        {empty ? (
          <div className="pointer-events-none absolute left-3 top-2.5 max-w-[90%] text-sm leading-relaxed text-muted-foreground/70">
            Warum möchtest du diesen Beruf lernen? Warum passt dieser Betrieb zu dir? Was bringst du
            mit?
          </div>
        ) : null}
        <div
          ref={editorRef}
          data-letter-rich-editor
          role="textbox"
          aria-label="Brieftext"
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onFocus={readToolbarState}
          onKeyUp={readToolbarState}
          onMouseUp={readToolbarState}
          onBlur={() => {
            const editor = editorRef.current;
            if (!editor) return;
            const sanitized = sanitizeLetterRichHtml(editor.innerHTML);
            if (editor.innerHTML !== sanitized) editor.innerHTML = sanitized;
          }}
          className="min-h-56 rounded-b-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border"
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Text markieren: Fett, Kursiv, Unterstrichen und Formatierung entfernen erscheinen direkt an
        der Auswahl. Die Ausrichtung gilt immer für den gesamten Brieftext; Blocksatz ist
        standardmässig aktiv. Spalten und Listen gelten für den aktuellen Absatz. Tabellen werden
        beim aktuellen Absatz eingefügt.
      </p>
    </div>
  );
}
