from pathlib import Path

path = Path("tests/e2e/dossier-typography-regression.spec.ts")
text = path.read_text()
old = '''  // The route intentionally paints its empty Modern/Cabin default once before
  // the first-use title-page takeover runs in an effect. The shared contact can
  // already show Lea Müller before that design takeover has settled, so wait for
  // the CV renderer itself to expose the persisted template before reading font.
  await expect(cvRoot).toHaveAttribute("data-cv-template", template);
  await expect(
    page
      .locator(
        '[data-dossier-document="cv"][data-export-mode="false"] [data-cv-page="0"] [data-dossier-integrated-contact]',
      )
      .first(),
  ).toContainText("Lea Müller");
'''
new = '''  // The route intentionally paints its empty default once before the first-use
  // title-page takeover settles. Readiness must not depend on one chrome mode:
  // the applicant name may live in normal CV content or in an integrated contact
  // header. Wait for the resolved template and transferred person data instead.
  await expect(cvRoot).toHaveAttribute("data-cv-template", template);
  await expect(cvRoot).toContainText("Lea Müller");
'''
if old not in text:
    raise SystemExit("typography readiness target not found")
path.write_text(text.replace(old, new, 1))

Path(".github/scripts/fix-typography-readiness.py").unlink(missing_ok=True)
Path(".github/workflows/fix-typography-readiness.yml").unlink(missing_ok=True)
