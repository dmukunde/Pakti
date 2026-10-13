import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/week")).toBe("/week");
    expect(safeNextPath("/goals/123?tab=logs")).toBe("/goals/123?tab=logs");
  });

  it("rejects other origins and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.example")).toBe("/week");
    expect(safeNextPath("//evil.example")).toBe("/week");
    expect(safeNextPath("/\\evil.example")).toBe("/week");
    expect(safeNextPath("javascript:alert(1)")).toBe("/week");
  });

  it("falls back when empty", () => {
    expect(safeNextPath(null)).toBe("/week");
    expect(safeNextPath("", "/")).toBe("/");
  });
});
