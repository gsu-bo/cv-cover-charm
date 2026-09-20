from pathlib import Path

path = Path("src/components/cv/CvPageMarginsControl.tsx")
text = path.read_text(encoding="utf-8")
old_import = '''import {
  cvDefaultContentBox,
  cvFrameFor,
  cvSafePageMarginMinimums,
} from "./archetype";'''
new_import = '''import {
  cvDefaultContentBox,
  cvFrameFor,
  cvSafePageMarginMinimums,
  type CvRenderLayout,
} from "./archetype";'''
if text.count(old_import) != 1:
    raise SystemExit("expected CV archetype import once")
text = text.replace(old_import, new_import, 1)
old_layout = '  const layout = useSyncExternalStore(subscribeCvLayout, getCvLayout, () => "classic");'
new_layout = '''  const layout = useSyncExternalStore<CvRenderLayout>(
    subscribeCvLayout,
    getCvLayout,
    () => "classic",
  );'''
if text.count(old_layout) != 1:
    raise SystemExit("expected CV layout external store once")
text = text.replace(old_layout, new_layout, 1)
path.write_text(text, encoding="utf-8")
