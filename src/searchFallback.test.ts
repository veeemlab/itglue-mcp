import { describe, expect, it } from "vitest";

import { nameVariants, searchWithNameFallback } from "./searchFallback.js";

describe("nameVariants", () => {
  it("returns single entry for plain ASCII single word", () => {
    expect(nameVariants("Acme")).toEqual(["Acme"]);
  });

  it("adds first-word variant for multi-word input", () => {
    expect(nameVariants("Acme Corp")).toEqual(["Acme Corp", "Acme"]);
  });

  it("adds diacritic-stripped variant", () => {
    expect(nameVariants("Schäfer")).toEqual(["Schäfer", "Schafer"]);
  });

  it("combines first-word and diacritic stripping for multi-word umlaut name", () => {
    expect(nameVariants("Schäfer Anlagentechnik GmbH")).toEqual([
      "Schäfer Anlagentechnik GmbH",
      "Schäfer",
      "Schafer Anlagentechnik GmbH",
      "Schafer",
    ]);
  });

  it("deduplicates identical variants", () => {
    expect(nameVariants("Acme")).toEqual(["Acme"]);
    expect(nameVariants("Müller")).toEqual(["Müller", "Muller"]);
  });
});

describe("searchWithNameFallback", () => {
  it("returns first variant when it has hits", async () => {
    const tried: Array<string | undefined> = [];
    const result = await searchWithNameFallback("Acme", async (v) => {
      tried.push(v);
      return { data: [{ id: "1", attributes: { name: "Acme" } }] };
    });
    expect(tried).toEqual(["Acme"]);
    expect((result as unknown as { meta: { search_strategy: string } }).meta.search_strategy).toBe("exact");
  });

  it("falls through to next variant on miss", async () => {
    const tried: Array<string | undefined> = [];
    const result = await searchWithNameFallback("Schäfer", async (v) => {
      tried.push(v);
      if (v === "Schafer") return { data: [{ id: "42", attributes: { name: "Schäfer" } }] };
      return { data: [] };
    });
    expect(tried).toEqual(["Schäfer", "Schafer"]);
    expect(
      (result as unknown as { meta: { search_strategy: string } }).meta.search_strategy,
    ).toContain("fallback:Schafer");
  });

  it("reports no-hits when all variants fail and lists what was tried", async () => {
    const result = await searchWithNameFallback("Xyzzy", async () => ({ data: [] }));
    const meta = (
      result as unknown as { meta: { search_strategy: string; search_variants_tried: string[] } }
    ).meta;
    expect(meta.search_strategy).toBe("no-hits");
    expect(meta.search_variants_tried).toEqual(["Xyzzy"]);
  });

  it("returns single fetch when input is undefined", async () => {
    let calls = 0;
    const result = await searchWithNameFallback(undefined, async () => {
      calls++;
      return { data: [{ id: "1" }] };
    });
    expect(calls).toBe(1);
    expect((result as unknown as { meta: { search_strategy: string } }).meta.search_strategy).toBe(
      "no-name-filter",
    );
  });
});
