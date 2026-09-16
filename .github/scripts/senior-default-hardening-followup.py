from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch target in {path}: {old[:180]!r}")
    p.write_text(text.replace(old, new, count))


# Once Brief is a real TemplateId, the exhaustive CV frame map must own its
# neutral frame explicitly instead of hiding it behind a string cast.
replace(
    "src/components/cv/archetype.ts",
    '''const FRAMES: Record<TemplateId, CvFrame> = {
  studio:''',
    '''const FRAMES: Record<TemplateId, CvFrame> = {
  brief: quiet(0),
  studio:''',
)
replace(
    "src/components/cv/archetype.ts",
    '''export function cvFrameFor(template: TemplateId): CvFrame {
  if ((template as string) === "brief") return quiet(0);
  if ((template as string) === "edelDark") return FRAMES.edel;''',
    '''export function cvFrameFor(template: TemplateId): CvFrame {
  if ((template as string) === "edelDark") return FRAMES.edel;''',
)

# The canonical template is now genuinely part of TemplateId, so the letter
# palette fallback no longer needs to assert it into the union.
replace(
    "src/components/letter/types.ts",
    '''    TEMPLATES.find(
      (candidate) => candidate.id === (CANONICAL_DOSSIER_PRESENTATION.template as TemplateId),
    );''',
    '''    TEMPLATES.find((candidate) => candidate.id === CANONICAL_DOSSIER_PRESENTATION.template);''',
)

Path(".github/scripts/senior-default-hardening-followup.py").unlink(missing_ok=True)
