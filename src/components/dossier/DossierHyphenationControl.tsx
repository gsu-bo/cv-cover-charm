const HYPHENATION_CSS = `
[data-letter-pdf-richtext="body"],
[data-cv-entry] [data-cv-body] {
  -webkit-hyphens: none;
  hyphens: none;
  word-break: normal;
  overflow-wrap: normal;
}
`;

/** Keep preview and PDF DOM on one deterministic no-hyphenation policy. */
export function DossierHyphenationBridge() {
  return <style data-dossier-hyphenation-style>{HYPHENATION_CSS}</style>;
}

/** Automatic hyphenation was retired because browser/PDF fragment boundaries are not reliable. */
export function DossierHyphenationControl() {
  return null;
}
