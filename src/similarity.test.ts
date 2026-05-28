import { describe, expect, it } from "vitest";

import {
  classifyConfidence,
  normalize,
  similarity,
  similarityTokenSet,
} from "./similarity.js";

describe("normalize", () => {
  it("strips diacritics, lowercases, collapses whitespace", () => {
    expect(normalize("Schäfer  Anlagentechnik")).toBe("schafer anlagentechnik");
    expect(normalize("Acme, Inc.")).toBe("acme inc");
  });
});

describe("similarity (Jaro-Winkler over normalized strings)", () => {
  it("returns 1 for identical-after-normalize", () => {
    expect(similarity("Acme Corp.", "acme corp")).toBe(1);
  });

  it("returns above 0.8 for common abbreviation pattern", () => {
    expect(similarity("Acme Corp", "Acme Corporation")).toBeGreaterThan(0.85);
  });

  it("returns above 0.95 for single typo", () => {
    expect(similarity("John Smith", "Jon Smith")).toBeGreaterThan(0.95);
  });

  it("returns under 0.6 for unrelated strings", () => {
    expect(similarity("Acme Corp", "Globex Industries")).toBeLessThan(0.6);
  });

  it("handles empty strings safely", () => {
    expect(similarity("", "")).toBe(1);
    expect(similarity("", "x")).toBe(0);
  });
});

describe("similarityTokenSet", () => {
  it("matches single token inside multi-word candidate at 1.0", () => {
    expect(similarityTokenSet("Kaiser", "Zahnarztpraxis Dr. Peter Kaiser")).toBe(1);
  });

  it("matches across token order", () => {
    expect(
      similarityTokenSet("Peter Kaiser", "Zahnarztpraxis Dr. Peter Kaiser"),
    ).toBeGreaterThanOrEqual(0.95);
  });

  it("handles diacritic equivalence inside tokens", () => {
    expect(similarityTokenSet("Schafer", "Müller Schäfer GmbH")).toBe(1);
  });

  it("returns under 0.7 when no token aligns", () => {
    expect(similarityTokenSet("Kaiser", "Globex Industries")).toBeLessThan(0.7);
  });

  it("never lower than whole-string jaro-winkler", () => {
    const whole = similarity("Acme Corp", "Acme Corporation");
    const set = similarityTokenSet("Acme Corp", "Acme Corporation");
    expect(set).toBeGreaterThanOrEqual(whole);
  });

  it("handles empty inputs", () => {
    expect(similarityTokenSet("", "")).toBe(1);
    expect(similarityTokenSet("", "x")).toBe(0);
  });
});

describe("classifyConfidence", () => {
  it("Update for >= 0.95", () => {
    expect(classifyConfidence(0.95)).toBe("Update");
    expect(classifyConfidence(1)).toBe("Update");
  });

  it("ManualReview for 0.80-0.949", () => {
    expect(classifyConfidence(0.8)).toBe("ManualReview");
    expect(classifyConfidence(0.94)).toBe("ManualReview");
  });

  it("CreateNew for < 0.80", () => {
    expect(classifyConfidence(0.79)).toBe("CreateNew");
    expect(classifyConfidence(0)).toBe("CreateNew");
  });
});
