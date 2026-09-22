import { describe, expect, test } from "bun:test";
import {
  SIDEBAR_PCT_MAX,
  cvFrameFor,
  sidebarWidthMm,
} from "../../src/components/cv/archetype";

describe("CV sidebar width", () => {
  test("allows an even 50/50 page split and clamps larger saved values", () => {
    const frame = cvFrameFor("modern");

    expect(SIDEBAR_PCT_MAX).toBe(0.5);
    expect(sidebarWidthMm(frame, "modern", 0.5)).toBe(105);
    expect(sidebarWidthMm(frame, "modern", 0.8)).toBe(105);
  });
});
