import { describe, expect, it } from "vitest";

import {
  fuzzyFallbackScan,
  hasAnyHits,
  nameVariants,
  searchWithNameFallback,
} from "./searchFallback.js";

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

describe("hasAnyHits", () => {
  it("true when data array has items", () => {
    expect(hasAnyHits({ data: [{ id: "1" }] })).toBe(true);
  });
  it("false on empty array, missing data, or non-array data", () => {
    expect(hasAnyHits({ data: [] })).toBe(false);
    expect(hasAnyHits({})).toBe(false);
    expect(hasAnyHits({ data: { id: "1" } })).toBe(false);
  });
});

describe("fuzzyFallbackScan", () => {
  const dataset = [
    { id: "1", attributes: { name: "Zahnarztpraxis Dr. Peter Kaiser" } },
    { id: "2", attributes: { name: "Schäfer Anlagentechnik GmbH" } },
    { id: "3", attributes: { name: "Globex Industries" } },
    { id: "4", attributes: { name: "Acme Corporation" } },
  ];

  it("returns only matches above threshold, sorted by score desc", async () => {
    const result = await fuzzyFallbackScan({
      input: "Kaiser",
      fetchUnfiltered: async () => ({ data: dataset, meta: { "total-count": 4 } }),
      getName: (r) => (r.attributes?.name as string) ?? "",
    });
    const data = (result as unknown as { data: Array<{ id: string }> }).data;
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].id).toBe("1");
    expect(data.find((d) => d.id === "3")).toBeUndefined();
  });

  it("marks meta with client-side-fuzzy strategy and stats", async () => {
    const result = await fuzzyFallbackScan({
      input: "Kaiser",
      fetchUnfiltered: async () => ({ data: dataset }),
      getName: (r) => (r.attributes?.name as string) ?? "",
    });
    const meta = (
      result as unknown as {
        meta: {
          search_strategy: string;
          fuzzy_threshold: number;
          fuzzy_candidates: number;
          fuzzy_matches: number;
        };
      }
    ).meta;
    expect(meta.search_strategy).toBe("client-side-fuzzy");
    expect(meta.fuzzy_candidates).toBe(4);
    expect(meta.fuzzy_matches).toBeGreaterThanOrEqual(1);
    expect(meta.fuzzy_threshold).toBe(0.75);
  });

  it("returns empty when no candidate scores above threshold", async () => {
    const result = await fuzzyFallbackScan({
      input: "Xyzzy",
      fetchUnfiltered: async () => ({ data: dataset }),
      getName: (r) => (r.attributes?.name as string) ?? "",
    });
    expect((result as unknown as { data: unknown[] }).data).toHaveLength(0);
  });

  it("marks client-side-fuzzy-empty when upstream returns no records", async () => {
    const result = await fuzzyFallbackScan({
      input: "Kaiser",
      fetchUnfiltered: async () => ({ data: [] }),
      getName: () => "",
    });
    expect(
      (result as unknown as { meta: { search_strategy: string } }).meta.search_strategy,
    ).toBe("client-side-fuzzy-empty");
  });

  it("honors custom threshold", async () => {
    const result = await fuzzyFallbackScan({
      input: "Kais",
      fetchUnfiltered: async () => ({ data: dataset }),
      getName: (r) => (r.attributes?.name as string) ?? "",
      threshold: 0.99,
    });
    expect((result as unknown as { data: unknown[] }).data).toHaveLength(0);
  });
});
