#!/usr/bin/env python3
"""Build a visual parity report for the 39 dossier templates.

Inputs must come from the same repository SHA:
- visible Web gallery: 117 PNGs + MANIFEST.txt
- PDF gallery: 39 three-page PDFs
- DOCX gallery: 39 three-page DOCX files

The script converts PDF/DOCX to normalized A4 PNGs, computes SSIM for
Web<->PDF, Web<->DOCX and PDF<->DOCX, and emits CSV/Markdown plus visual
contact sheets. Low similarity is reported, not treated as a failure; malformed
or incomplete source packages do fail the run.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from statistics import mean
from typing import Iterable

import fitz
import numpy as np
import PIL
import skimage
from PIL import Image, ImageDraw, ImageOps
from skimage.metrics import structural_similarity

PAGE_KINDS = ("cover", "letter", "cv")
PAIR_KEYS = ("web_pdf", "web_docx", "pdf_docx")
LAYOUT_KEYS = tuple(f"{key}_layout" for key in PAIR_KEYS)
PAIR_LABELS = {
    "web_pdf": "Web ↔ PDF",
    "web_docx": "Web ↔ DOCX",
    "pdf_docx": "PDF ↔ DOCX",
}
TARGET_SIZE = (794, 1123)
ANALYSIS_SIZE = (265, 375)


@dataclass(frozen=True)
class TemplateCase:
    base: str
    label: str
    web_files: dict[str, str]


def run(cmd: list[str], *, timeout: int = 180) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        cmd,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed ({result.returncode}): {' '.join(cmd)}\n{result.stdout}")
    return result


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Required command not found: {name}")


def parse_web_manifest(path: Path) -> list[TemplateCase]:
    if not path.is_file():
        raise RuntimeError(f"Missing Web manifest: {path}")
    cases: list[TemplateCase] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("Bewerbungsdossier") or line.startswith("Format:"):
            continue
        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 5:
            raise RuntimeError(f"Unexpected Web manifest row: {raw}")
        base, label, cover, letter, cv = parts
        cases.append(
            TemplateCase(base=base, label=label, web_files={"cover": cover, "letter": letter, "cv": cv})
        )
    if len(cases) != 39:
        raise RuntimeError(f"Expected 39 Web manifest rows, found {len(cases)}")
    if len({case.base for case in cases}) != 39:
        raise RuntimeError("Web manifest contains duplicate template keys")
    return cases


def save_normalized_rgb(rgb: Image.Image, target: Path) -> None:
    # All three renderers are A4. Fit defensively without cropping so a bad
    # page geometry remains visible instead of being hidden by normalization.
    fitted = ImageOps.contain(rgb, TARGET_SIZE, method=Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", TARGET_SIZE, "white")
    x = (TARGET_SIZE[0] - fitted.width) // 2
    y = (TARGET_SIZE[1] - fitted.height) // 2
    canvas.paste(fitted, (x, y))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "PNG", compress_level=1)


def normalize_image(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        save_normalized_rgb(image.convert("RGB"), target)


def rasterize_pdf(pdf: Path, out_dir: Path, base: str) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    document = fitz.open(pdf)
    try:
        if document.page_count != 3:
            raise RuntimeError(f"{pdf.name}: expected 3 PDF pages, found {document.page_count}")

        result: dict[str, Path] = {}
        scale = 96.0 / 72.0
        matrix = fitz.Matrix(scale, scale)
        for page_number, kind in enumerate(PAGE_KINDS):
            page = document.load_page(page_number)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            target = out_dir / f"{base}--{kind}.png"
            rgb = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            save_normalized_rgb(rgb, target)
            result[kind] = target
        return result
    finally:
        document.close()

def convert_all_docx_to_pdf(docx_dir: Path, cases: list[TemplateCase], out_dir: Path) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    profile = out_dir / "lo-profile"
    profile_uri = profile.resolve().as_uri()
    docx_files = [docx_dir / f"{case.base}.docx" for case in cases]
    missing = [path for path in docx_files if not path.is_file()]
    if missing:
        raise RuntimeError(f"Missing DOCX files: {', '.join(path.name for path in missing)}")

    try:
        run(
            [
                "libreoffice",
                "--headless",
                "--nologo",
                "--nodefault",
                "--nolockcheck",
                "--nofirststartwizard",
                f"-env:UserInstallation={profile_uri}",
                "--convert-to",
                "pdf",
                "--outdir",
                str(out_dir),
                *[str(path) for path in docx_files],
            ],
            timeout=600,
        )
    finally:
        shutil.rmtree(profile, ignore_errors=True)

    result: dict[str, Path] = {}
    for case in cases:
        pdf = out_dir / f"{case.base}.pdf"
        if not pdf.is_file() or pdf.stat().st_size < 1000:
            raise RuntimeError(f"LibreOffice did not create a usable PDF for {case.base}.docx")
        result[case.base] = pdf
    return result

def analysis_arrays(path: Path) -> tuple[np.ndarray, np.ndarray]:
    with Image.open(path) as image:
        if image.size != TARGET_SIZE:
            raise RuntimeError(f"Unexpected normalized size for {path}: {image.size}")
        rgb_image = image.convert("RGB").resize(ANALYSIS_SIZE, Image.Resampling.LANCZOS)
        rgb = np.asarray(rgb_image, dtype=np.uint8)
        gray = np.asarray(rgb_image.convert("L"), dtype=np.uint8)
        return rgb, gray


def pair_scores(web: Path, pdf: Path, docx: Path) -> dict[str, float]:
    web_rgb, web_gray = analysis_arrays(web)
    pdf_rgb, pdf_gray = analysis_arrays(pdf)
    docx_rgb, docx_gray = analysis_arrays(docx)

    def rgb_ssim(a: np.ndarray, b: np.ndarray) -> float:
        return float(structural_similarity(a, b, data_range=255, channel_axis=2))

    def layout_ssim(a: np.ndarray, b: np.ndarray) -> float:
        return float(structural_similarity(a, b, data_range=255))

    return {
        "web_pdf": rgb_ssim(web_rgb, pdf_rgb),
        "web_docx": rgb_ssim(web_rgb, docx_rgb),
        "pdf_docx": rgb_ssim(pdf_rgb, docx_rgb),
        "web_pdf_layout": layout_ssim(web_gray, pdf_gray),
        "web_docx_layout": layout_ssim(web_gray, docx_gray),
        "pdf_docx_layout": layout_ssim(pdf_gray, docx_gray),
    }


def assert_no_exact_duplicate_images(
    source: str,
    rows: list[dict[str, object]],
    image_lookup: dict[tuple[str, str, str], Path],
) -> None:
    by_digest: dict[tuple[str, str], list[str]] = {}
    for row in rows:
        base = str(row["base"])
        page = str(row["page"])
        path = image_lookup[(base, page, source)]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        by_digest.setdefault((page, digest), []).append(base)
    duplicates = [
        [f"{base}:{page}" for base in bases]
        for (page, _digest), bases in by_digest.items()
        if len(bases) > 1
    ]
    if duplicates:
        detail = "; ".join(", ".join(items) for items in duplicates[:8])
        raise RuntimeError(
            f"{source} contains exact duplicate normalized pages across distinct gallery cases: {detail}"
        )


def renderer_versions() -> list[str]:
    libreoffice = run(["libreoffice", "--version"], timeout=30).stdout.strip()
    return [
        f"Python {sys.version.split()[0]}",
        libreoffice,
        f"PyMuPDF {fitz.VersionBind}",
        f"Pillow {PIL.__version__}",
        f"NumPy {np.__version__}",
        f"scikit-image {skimage.__version__}",
    ]

def resize_for_sheet(path: Path, width: int) -> Image.Image:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        height = round(rgb.height * width / rgb.width)
        return rgb.resize((width, height), Image.Resampling.LANCZOS)


def create_template_sheet(case: TemplateCase, rows: list[dict[str, object]], image_map: dict[str, dict[str, Path]], target: Path) -> None:
    thumb_w = 340
    thumb_h = round(TARGET_SIZE[1] * thumb_w / TARGET_SIZE[0])
    margin = 18
    title_h = 42
    row_caption_h = 38
    col_gap = 14
    row_gap = 18
    width = margin * 2 + thumb_w * 3 + col_gap * 2
    height = title_h + margin + 3 * (row_caption_h + thumb_h) + 2 * row_gap + margin
    sheet = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 12), f"{case.base} — {case.label}   |   Web / PDF / DOCX", fill="black")
    for col, label in enumerate(("WEB (visible site)", "PDF", "DOCX / LibreOffice")):
        x = margin + col * (thumb_w + col_gap)
        draw.text((x, title_h), label, fill="black")
    row_lookup = {str(row["page"]): row for row in rows}
    y = title_h + margin + 20
    for kind in PAGE_KINDS:
        row = row_lookup[kind]
        draw.text(
            (margin, y),
            (
                f"{kind.upper()}  Web↔PDF {row['web_pdf']:.3f}   "
                f"Web↔DOCX {row['web_docx']:.3f}   PDF↔DOCX {row['pdf_docx']:.3f}"
            ),
            fill="black",
        )
        y += row_caption_h
        for col, source in enumerate(("web", "pdf", "docx")):
            thumb = resize_for_sheet(image_map[source][kind], thumb_w)
            x = margin + col * (thumb_w + col_gap)
            sheet.paste(thumb, (x, y))
        y += thumb_h + row_gap
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, "JPEG", quality=84, optimize=True)


def create_worst_sheet(rows: list[dict[str, object]], pair: str, image_lookup: dict[tuple[str, str, str], Path], target: Path, count: int = 12) -> None:
    worst = sorted(rows, key=lambda row: float(row[pair]))[:count]
    left, right = pair.split("_")
    thumb_w = 210
    thumb_h = round(TARGET_SIZE[1] * thumb_w / TARGET_SIZE[0])
    cell_w = thumb_w * 2 + 28
    cell_h = thumb_h + 54
    cols = 3
    rows_count = (len(worst) + cols - 1) // cols
    canvas = Image.new("RGB", (cell_w * cols, cell_h * rows_count), "white")
    draw = ImageDraw.Draw(canvas)
    for index, row in enumerate(worst):
        x0 = (index % cols) * cell_w
        y0 = (index // cols) * cell_h
        base = str(row["base"])
        page = str(row["page"])
        draw.text((x0 + 6, y0 + 4), f"{base} {page}  {PAIR_LABELS[pair]} {row[pair]:.3f}", fill="black")
        a = resize_for_sheet(image_lookup[(base, page, left)], thumb_w)
        b = resize_for_sheet(image_lookup[(base, page, right)], thumb_w)
        canvas.paste(a, (x0 + 6, y0 + 30))
        canvas.paste(b, (x0 + 16 + thumb_w, y0 + 30))
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, "JPEG", quality=84, optimize=True)


def average(rows: Iterable[dict[str, object]], key: str) -> float:
    values = [float(row[key]) for row in rows]
    return mean(values) if values else float("nan")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--web-dir", type=Path, required=True)
    parser.add_argument("--pdf-dir", type=Path, required=True)
    parser.add_argument("--docx-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    require_command("libreoffice")

    cases = parse_web_manifest(args.web_dir / "MANIFEST.txt")
    args.out_dir.mkdir(parents=True, exist_ok=True)
    normalized = args.out_dir / "normalized"
    pdf_png_dir = normalized / "pdf"
    docx_png_dir = normalized / "docx"
    web_png_dir = normalized / "web"
    docx_pdf_dir = args.out_dir / "docx-pdf"

    rows: list[dict[str, object]] = []
    image_lookup: dict[tuple[str, str, str], Path] = {}

    print("Converting 39 DOCX files through LibreOffice...", flush=True)
    docx_pdfs = convert_all_docx_to_pdf(args.docx_dir, cases, docx_pdf_dir)

    for index, case in enumerate(cases, start=1):
        print(f"[{index:02d}/39] {case.base} {case.label}", flush=True)
        pdf = args.pdf_dir / f"{case.base}.pdf"
        docx = args.docx_dir / f"{case.base}.docx"
        if not pdf.is_file():
            raise RuntimeError(f"Missing PDF: {pdf}")
        if not docx.is_file():
            raise RuntimeError(f"Missing DOCX: {docx}")

        pdf_pages = rasterize_pdf(pdf, pdf_png_dir, case.base)
        docx_pdf = docx_pdfs[case.base]
        docx_pages = rasterize_pdf(docx_pdf, docx_png_dir, case.base)

        template_images: dict[str, dict[str, Path]] = {"web": {}, "pdf": pdf_pages, "docx": docx_pages}
        template_rows: list[dict[str, object]] = []
        for kind in PAGE_KINDS:
            source_web = args.web_dir / case.web_files[kind]
            if not source_web.is_file():
                raise RuntimeError(f"Missing Web screenshot: {source_web}")
            normalized_web = web_png_dir / f"{case.base}--{kind}.png"
            normalize_image(source_web, normalized_web)
            template_images["web"][kind] = normalized_web

            scores = pair_scores(normalized_web, pdf_pages[kind], docx_pages[kind])
            row = {
                "base": case.base,
                "label": case.label,
                "page": kind,
                **scores,
            }
            rows.append(row)
            template_rows.append(row)
            for source in ("web", "pdf", "docx"):
                image_lookup[(case.base, kind, source)] = template_images[source][kind]

        create_template_sheet(
            case,
            template_rows,
            template_images,
            args.out_dir / "templates" / f"{case.base}.jpg",
        )

    if len(rows) != 117:
        raise RuntimeError(f"Expected 117 parity rows, found {len(rows)}")

    # Exact duplicate page images are a source-integrity failure, not merely a
    # low-similarity observation. This specifically guards against gallery state
    # races that can silently capture a previous template under a new filename.
    for source in ("web", "pdf", "docx"):
        assert_no_exact_duplicate_images(source, rows, image_lookup)

    metrics_path = args.out_dir / "metrics.csv"
    with metrics_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["base", "label", "page", *PAIR_KEYS, *LAYOUT_KEYS])
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    **row,
                    **{key: f"{float(row[key]):.6f}" for key in (*PAIR_KEYS, *LAYOUT_KEYS)},
                }
            )

    for pair in PAIR_KEYS:
        create_worst_sheet(rows, pair, image_lookup, args.out_dir / f"worst-{pair.replace('_', '-vs-')}.jpg")

    versions = renderer_versions()
    summary_lines = [
        "# Dossier Visual Parity x39",
        "",
        "All 39 templates, each with cover / letter / CV (117 page comparisons).",
        "Web means the visible editor preview, not the hidden PDF export canvas.",
        "Primary scores are **RGB SSIM** after A4 normalization; 1.000 means pixel-identical.",
        "A separate grayscale **layout SSIM** helps distinguish geometry/text drift from color/theme drift.",
        "Low scores are reported for QA and do not fail the workflow; malformed, missing, or exact-duplicate source pages do fail.",
        "",
        "## Renderer versions",
        "",
        *[f"- {version}" for version in versions],
        "",
        "## Overall — RGB visual SSIM",
        "",
        "| Pair | Mean SSIM |",
        "|---|---:|",
    ]
    for pair in PAIR_KEYS:
        summary_lines.append(f"| {PAIR_LABELS[pair]} | {average(rows, pair):.3f} |")

    summary_lines += ["", "## Overall — grayscale layout SSIM", "", "| Pair | Mean SSIM |", "|---|---:|"]
    for pair in PAIR_KEYS:
        summary_lines.append(f"| {PAIR_LABELS[pair]} | {average(rows, pair + '_layout'):.3f} |")

    summary_lines += ["", "## By page type — RGB visual SSIM", "", "| Page | Web ↔ PDF | Web ↔ DOCX | PDF ↔ DOCX |", "|---|---:|---:|---:|"]
    for kind in PAGE_KINDS:
        kind_rows = [row for row in rows if row["page"] == kind]
        summary_lines.append(
            f"| {kind} | {average(kind_rows, 'web_pdf'):.3f} | {average(kind_rows, 'web_docx'):.3f} | {average(kind_rows, 'pdf_docx'):.3f} |"
        )

    summary_lines += ["", "## By page type — grayscale layout SSIM", "", "| Page | Web ↔ PDF | Web ↔ DOCX | PDF ↔ DOCX |", "|---|---:|---:|---:|"]
    for kind in PAGE_KINDS:
        kind_rows = [row for row in rows if row["page"] == kind]
        summary_lines.append(
            f"| {kind} | {average(kind_rows, 'web_pdf_layout'):.3f} | {average(kind_rows, 'web_docx_layout'):.3f} | {average(kind_rows, 'pdf_docx_layout'):.3f} |"
        )

    summary_lines += ["", "## Per-template mean — RGB visual SSIM", "", "| Template | Web ↔ PDF | Web ↔ DOCX | PDF ↔ DOCX |", "|---|---:|---:|---:|"]
    for case in cases:
        case_rows = [row for row in rows if row["base"] == case.base]
        summary_lines.append(
            f"| {case.base} — {case.label} | {average(case_rows, 'web_pdf'):.3f} | {average(case_rows, 'web_docx'):.3f} | {average(case_rows, 'pdf_docx'):.3f} |"
        )

    for pair in PAIR_KEYS:
        summary_lines += ["", f"## Lowest 12 — {PAIR_LABELS[pair]}", "", "| Template | Page | SSIM |", "|---|---|---:|"]
        for row in sorted(rows, key=lambda item: float(item[pair]))[:12]:
            summary_lines.append(f"| {row['base']} — {row['label']} | {row['page']} | {float(row[pair]):.3f} |")

    (args.out_dir / "SUMMARY.md").write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    print("\n".join(summary_lines[:36]))
    print(f"\nReport written to {args.out_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
