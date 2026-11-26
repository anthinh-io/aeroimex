import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a relative path with its query string", () => {
    expect(safeNext("/declarations/42?tab=items")).toBe("/declarations/42?tab=items");
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["declarations"],
  ])("falls back to '/' for an unsafe next value: %s", (input) => {
    expect(safeNext(input)).toBe("/");
  });
});
