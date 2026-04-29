import { describe, expect, it } from "vitest";
import { normalizeTags } from "@/lib/utils";
import { sanitizeQuery } from "@/lib/search";

describe("normalizeTags", () => {
  it("normalizes, deduplicates, and trims tags", () => {
    expect(normalizeTags("  Cat, reaction,cat,  wow  ")).toEqual(["cat", "reaction", "wow"]);
  });
});

describe("sanitizeQuery", () => {
  it("trims and limits query length", () => {
    expect(sanitizeQuery("   meme   ")).toBe("meme");
    expect(sanitizeQuery("x".repeat(120))).toHaveLength(80);
  });
});
