import { isBodyTextAlignment, type BodyTextAlignment } from "@/lib/text-alignment";

const ALLOWED_INLINE = new Set(["strong", "b", "em", "i", "u"]);
const ALLOWED_BLOCK = new Set(["div", "p"]);
const ALLOWED_LISTS = new Set(["bullet", "dash", "plus", "dot"]);

export type LetterTextAlign = BodyTextAlignment;

export function normalizeLetterInlineColor(value: string | null | undefined): string | undefined {
  const color = value?.trim().toLowerCase();
  if (!color) return undefined;

  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return hex.length === 3
      ? `#${hex
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")}`
      : `#${hex}`;
  }

  const rgb = color.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) !== 1)) return undefined;
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some((channel) => channel < 0 || channel > 255)) return undefined;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function letterTextAlign(value: string | undefined): LetterTextAlign {
  return isBodyTextAlignment(value) ? value : "justify";
}

/**
 * Chromium stretches justified text aggressively at CSS column fragment
 * boundaries. Keep multi-column letter blocks readable by normalizing that
 * unsupported combination to left alignment everywhere it is rendered or
 * exported.
 */
export function compatibleLetterTextAlign(
  value: string | undefined,
  columns: string | number | undefined,
): LetterTextAlign {
  return columns === "2" || columns === "3" || columns === 2 || columns === 3
    ? "left"
    : letterTextAlign(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function plainTextToRichHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => `<div data-align="justify">${line ? escapeHtml(line) : "<br>"}</div>`)
    .join("");
}

function blockAttributes(element: HTMLElement): string {
  const columns =
    element.dataset.columns === "2" || element.dataset.columns === "3"
      ? element.dataset.columns
      : undefined;
  const attributes: string[] = [
    `data-align="${compatibleLetterTextAlign(element.dataset.align, columns)}"`,
  ];
  if (columns) {
    attributes.push(`data-columns="${columns}"`);
  }
  if (element.dataset.list && ALLOWED_LISTS.has(element.dataset.list)) {
    attributes.push(`data-list="${element.dataset.list}"`);
  }
  return ` ${attributes.join(" ")}`;
}

function inlineColorForElement(element: HTMLElement): string | undefined {
  return normalizeLetterInlineColor(
    element.dataset.letterTextColor ?? element.style.color ?? element.getAttribute("color"),
  );
}

function wrapInlineColor(children: string, color: string | undefined): string {
  return color
    ? `<span data-letter-text-color="${color}" style="color: ${color}">${children}</span>`
    : children;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return "<br>";
  if (tag === "hr") return "<hr>";

  const children = Array.from(element.childNodes).map(serializeNode).join("");
  if (tag === "span" || tag === "font") {
    return wrapInlineColor(children, inlineColorForElement(element));
  }
  if (ALLOWED_INLINE.has(tag)) {
    const canonical = tag === "b" ? "strong" : tag === "i" ? "em" : tag;
    const formatted = `<${canonical}>${children}</${canonical}>`;

    // Chromium may apply execCommand('foreColor') directly to the existing
    // <strong>/<em>/<u> node instead of creating a span/font wrapper. Keep
    // that user-visible color while still stripping every unrelated style.
    return wrapInlineColor(formatted, inlineColorForElement(element));
  }
  if (ALLOWED_BLOCK.has(tag)) {
    return `<div${blockAttributes(element)}>${children || "<br>"}</div>`;
  }
  if (tag === "table") return `<table data-letter-table>${children}</table>`;
  if (tag === "tbody") return `<tbody>${children}</tbody>`;
  if (tag === "tr") return `<tr>${children}</tr>`;
  if (tag === "td") return `<td>${children || "<br>"}</td>`;
  return children;
}

function serializeTopLevelNodes(nodes: Node[]): string {
  let output = "";
  let inlineBuffer = "";

  const flushInline = () => {
    if (!inlineBuffer) return;
    output += `<div data-align="justify">${inlineBuffer}</div>`;
    inlineBuffer = "";
  };

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? "";
      if (raw.includes("\n")) {
        flushInline();
        for (const line of raw.replace(/\r/g, "").split("\n")) {
          output += `<div data-align="justify">${line ? escapeHtml(line) : "<br>"}</div>`;
        }
        continue;
      }
      if (!raw.trim() && !inlineBuffer) continue;
      inlineBuffer += serializeNode(node);
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if (ALLOWED_BLOCK.has(tag) || tag === "hr" || tag === "table") {
        flushInline();
        output += serializeNode(node);
        continue;
      }
    }

    inlineBuffer += serializeNode(node);
  }

  flushInline();
  return output;
}

/**
 * Nur die Formatierungen behalten, die der Anschreiben-Editor anbietet.
 * Fremde Attribute, Styles, Links, Bilder, Scripts usw. werden entfernt.
 */
export function sanitizeLetterRichHtml(html: string): string {
  if (!html.trim()) return "";
  if (typeof document === "undefined") {
    const plain = html
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<hr\s*\/?\s*>/gi, "\n")
      .replace(/<\/td\s*>/gi, "\t")
      .replace(/<\/tr\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "");
    return plainTextToRichHtml(plain);
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  return serializeTopLevelNodes(Array.from(template.content.childNodes));
}

function textFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n";
  const children = Array.from(element.childNodes).map(textFromNode).join("");
  if (ALLOWED_BLOCK.has(tag)) return `${children}\n`;
  if (tag === "td") return `${children}\t`;
  if (tag === "tr") return `${children.replace(/\t+$/g, "")}\n`;
  if (tag === "table") return `${children}\n`;
  return children;
}

export function richHtmlToPlainText(html: string): string {
  if (!html.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<hr\s*\/?\s*>/gi, "\n")
      .replace(/<\/td\s*>/gi, "\t")
      .replace(/<\/tr\s*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const template = document.createElement("template");
  template.innerHTML = sanitizeLetterRichHtml(html);
  return Array.from(template.content.childNodes)
    .map(textFromNode)
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function letterRichHtml(html: string | undefined, plainText: string): string {
  return html?.trim() ? sanitizeLetterRichHtml(html) : plainTextToRichHtml(plainText);
}
