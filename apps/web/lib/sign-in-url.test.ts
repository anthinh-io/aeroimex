import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";
import { signInPath } from "./sign-in-url";

describe("signInPath", () => {
  it("carries the requested path and query string in next", () => {
    expect(signInPath("/any-page/123", "?tab=details")).toBe(
      "/sign-in?next=%2Fany-page%2F123%3Ftab%3Ddetails",
    );
  });

  it("round-trips the requested page through safeNext", () => {
    const next = new URL(signInPath("/any-page/123", "?tab=details"), "http://localhost").searchParams.get("next");
    expect(safeNext(next)).toBe("/any-page/123?tab=details");
  });

  it("carries the main page as next", () => {
    expect(signInPath("/", "")).toBe("/sign-in?next=%2F");
  });
});
