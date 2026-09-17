from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/lib/dossier-pdf.ts",
    '  const pageNumber = Number(overflowing.dataset.letterPageIndex ?? "0") + 1;\n',
    '  const pageNumber = Number(overflowing.dataset?.letterPageIndex ?? "0") + 1;\n',
)

for path in [
    "tests/unit/letter-preflight.test.ts",
    "tests/unit/letter-preflight-export-geometry.test.ts",
]:
    replace_once(
        path,
        'Motivationsschreiben passt nicht auf eine Seite',
        'Motivationsschreiben Seite 1 enthält Inhalt',
    )

print("pagination PDF overflow unit expectations updated")
