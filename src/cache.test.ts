import { describe, expect, it } from "vitest";

import { LruCache, resourceFromPath, ttlForResource } from "./cache.js";

describe("LruCache", () => {
  it("returns undefined on miss", () => {
    const c = new LruCache(10);
    expect(c.get("missing")).toBeUndefined();
  });

  it("stores and returns within TTL", () => {
    const c = new LruCache(10);
    c.set("k", { v: 1 }, 1000);
    expect(c.get("k")).toEqual({ v: 1 });
  });

  it("skips storage when TTL <= 0", () => {
    const c = new LruCache(10);
    c.set("k", { v: 1 }, 0);
    expect(c.get("k")).toBeUndefined();
  });

  it("evicts oldest when capacity exceeded", () => {
    const c = new LruCache(2);
    c.set("a", 1, 60000);
    c.set("b", 2, 60000);
    c.set("c", 3, 60000);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });

  it("get() refreshes recency so re-read item is not evicted next", () => {
    const c = new LruCache(2);
    c.set("a", 1, 60000);
    c.set("b", 2, 60000);
    c.get("a");
    c.set("c", 3, 60000);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("invalidateMatching removes selected entries", () => {
    const c = new LruCache(10);
    c.set("GET /a/1", "x", 60000);
    c.set("GET /a/2", "y", 60000);
    c.set("GET /b/1", "z", 60000);
    const removed = c.invalidateMatching((k) => k.includes("/a/"));
    expect(removed).toBe(2);
    expect(c.get("GET /a/1")).toBeUndefined();
    expect(c.get("GET /b/1")).toBe("z");
  });
});

describe("ttlForResource", () => {
  it("returns 0 for passwords (never cache)", () => {
    expect(ttlForResource("passwords")).toBe(0);
  });

  it("returns one hour for static reference data", () => {
    expect(ttlForResource("flexible_asset_types")).toBe(60 * 60 * 1000);
    expect(ttlForResource("configuration_statuses")).toBe(60 * 60 * 1000);
  });

  it("returns five minutes for organizations and locations", () => {
    expect(ttlForResource("organizations")).toBe(5 * 60 * 1000);
    expect(ttlForResource("locations")).toBe(5 * 60 * 1000);
  });

  it("returns one minute for change-prone resources", () => {
    expect(ttlForResource("configurations")).toBe(60 * 1000);
    expect(ttlForResource("contacts")).toBe(60 * 1000);
  });

  it("falls back to default for unknown resources", () => {
    expect(ttlForResource("widgets")).toBe(60 * 1000);
  });
});

describe("resourceFromPath", () => {
  it("extracts first path segment", () => {
    expect(resourceFromPath("/organizations")).toBe("organizations");
    expect(resourceFromPath("/organizations/123")).toBe("organizations");
    expect(resourceFromPath("organizations/123/relationships/configurations")).toBe(
      "organizations",
    );
  });

  it("strips leading slashes", () => {
    expect(resourceFromPath("//passwords")).toBe("passwords");
  });
});
