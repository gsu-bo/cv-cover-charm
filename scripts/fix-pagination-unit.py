from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count < 1:
        raise RuntimeError(f"{path}: expected at least one match: {old!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


replace_once(
    "src/lib/dossier-pdf.ts",
    '  if (rootOrPage.matches("[data-letter-page]")) return [rootOrPage];\n',
    '  if (rootOrPage.matches?.("[data-letter-page]")) return [rootOrPage];\n',
)
replace_once(
    "src/lib/dossier-pdf.ts",
    '    const documentRoot = rootOrPage.matches("[data-letter-document-root]")\n',
    '    const documentRoot = rootOrPage.matches?.("[data-letter-document-root]")\n',
)
replace_once(
    "src/lib/dossier-pdf.ts",
    '    const pages = Array.from(rootOrPage.querySelectorAll<HTMLElement>("[data-letter-page]"));\n',
    '    const pages =\n'
    '      typeof rootOrPage.querySelectorAll === "function"\n'
    '        ? Array.from(rootOrPage.querySelectorAll<HTMLElement>("[data-letter-page]"))\n'
    '        : [];\n'
    '    if (!pages.length && typeof rootOrPage.querySelector === "function") {\n'
    '      const single = rootOrPage.querySelector<HTMLElement>("[data-letter-page]");\n'
    '      if (single) pages.push(single);\n'
    '    }\n',
)
replace_once(
    "src/lib/dossier-pdf.ts",
    '  const pageNumber = Number(overflowing.dataset.letterPageIndex ?? "0") + 1;\n',
    '  const pageNumber = Number(overflowing.dataset?.letterPageIndex ?? "0") + 1;\n',
)

for path in [
    "tests/unit/letter-preflight.test.ts",
    "tests/unit/letter-preflight-export-geometry.test.ts",
]:
    replace_all(
        path,
        "Motivationsschreiben passt nicht auf eine Seite",
        "Motivationsschreiben Seite 1 enthält Inhalt",
    )

print("pagination PDF overflow unit expectations updated")
