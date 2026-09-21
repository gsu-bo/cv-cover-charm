import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const canvas = readFileSync("src/components/cv/CvCanvas.tsx", "utf8");

test("design-only edits invalidate cached CV pagination rows", () => {
  expect(canvas).toContain(
    "const paginationData = useMemo(() => ({ ...data }), [data, design]);",
  );
  expect(canvas).toContain("data={paginationData}");
});
