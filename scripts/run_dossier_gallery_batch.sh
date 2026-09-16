#!/usr/bin/env bash
set -euo pipefail

format="${1:-}"
batch="${2:-}"
out_dir="${3:-}"

if [[ ! "$batch" =~ ^[0-9]+$ ]] || (( batch < 0 || batch > 9 )); then
  echo "Usage: $0 <web|pdf|docx> <batch 0-9> <output-dir>" >&2
  exit 2
fi
if [[ -z "$out_dir" ]]; then
  echo "Output directory is required" >&2
  exit 2
fi

expected_templates=4
if (( batch == 9 )); then expected_templates=3; fi
part="$(printf '%02d' "$batch")"

case "$format" in
  web)
    WEB_GALLERY_BATCH_INDEX="$batch" WEB_GALLERY_DIR="$out_dir" \
      npx playwright test tests/e2e/dossier-web-gallery.spec.ts --reporter=line --workers=1
    expected_files=$(( expected_templates * 3 ))
    actual="$(find "$out_dir" -maxdepth 1 -type f -name '*.png' | wc -l | tr -d ' ')"
    test "$actual" -eq "$expected_files"
    ;;
  pdf)
    GALLERY_BATCH_INDEX="$batch" GALLERY_DIR="$out_dir" \
      npx playwright test tests/e2e/dossier-gallery.spec.ts --reporter=line --workers=1
    expected_files="$expected_templates"
    actual="$(find "$out_dir" -maxdepth 1 -type f -name '*.pdf' | wc -l | tr -d ' ')"
    test "$actual" -eq "$expected_files"
    ;;
  docx)
    DOCX_GALLERY_BATCH_INDEX="$batch" DOCX_GALLERY_DIR="$out_dir" \
      npx playwright test tests/e2e/dossier-docx-gallery.spec.ts --reporter=line --workers=1
    expected_files="$expected_templates"
    actual="$(find "$out_dir" -maxdepth 1 -type f -name '*.docx' | wc -l | tr -d ' ')"
    test "$actual" -eq "$expected_files"
    while IFS= read -r -d '' docx; do
      unzip -tq "$docx" >/dev/null
      unzip -Z1 "$docx" | grep -Fxq '[Content_Types].xml'
      unzip -Z1 "$docx" | grep -Fxq 'word/document.xml'
      unzip -Z1 "$docx" | grep -Fxq 'word/styles.xml'
      unzip -Z1 "$docx" | grep -Fxq 'word/_rels/document.xml.rels'
    done < <(find "$out_dir" -maxdepth 1 -type f -name '*.docx' -print0)
    ;;
  *)
    echo "Unknown gallery format: $format" >&2
    exit 2
    ;;
esac

manifest="$out_dir/MANIFEST.part-$part.txt"
test -f "$manifest"
echo "$format batch $batch: $actual/$expected_files files; manifest $(basename "$manifest")"
