import { describe, expect, it } from "vitest";

import { requireConfirm, toBoolOrUndef } from "./shared.js";

describe("toBoolOrUndef", () => {
  it("passes through native booleans", () => {
    expect(toBoolOrUndef(true)).toBe(true);
    expect(toBoolOrUndef(false)).toBe(false);
  });

  it("coerces 'true' and 'false' strings correctly (not Boolean('false') === true)", () => {
    expect(toBoolOrUndef("true")).toBe(true);
    expect(toBoolOrUndef("false")).toBe(false);
  });

  it("is case-insensitive on string forms", () => {
    expect(toBoolOrUndef("TRUE")).toBe(true);
    expect(toBoolOrUndef("False")).toBe(false);
    expect(toBoolOrUndef(" yes ")).toBe(true);
    expect(toBoolOrUndef("NO")).toBe(false);
  });

  it("accepts 1/0 forms", () => {
    expect(toBoolOrUndef(1)).toBe(true);
    expect(toBoolOrUndef(0)).toBe(false);
    expect(toBoolOrUndef("1")).toBe(true);
    expect(toBoolOrUndef("0")).toBe(false);
  });

  it("returns undefined for null/undefined/unknown shapes", () => {
    expect(toBoolOrUndef(null)).toBeUndefined();
    expect(toBoolOrUndef(undefined)).toBeUndefined();
    expect(toBoolOrUndef("maybe")).toBeUndefined();
    expect(toBoolOrUndef(42)).toBeUndefined();
    expect(toBoolOrUndef({})).toBeUndefined();
    expect(toBoolOrUndef([])).toBeUndefined();
  });
});

describe("requireConfirm", () => {
  it("returns silently when token matches", () => {
    expect(() => requireConfirm({ confirm: "DELETE_X" }, "DELETE_X")).not.toThrow();
  });

  it("throws when confirm is missing", () => {
    expect(() => requireConfirm({}, "DELETE_X")).toThrowError(/confirm: "DELETE_X"/);
  });

  it("throws when confirm is the wrong token", () => {
    expect(() => requireConfirm({ confirm: "DELETE_Y" }, "DELETE_X")).toThrow();
  });

  it("throws when confirm has correct text but wrong type", () => {
    expect(() => requireConfirm({ confirm: true }, "DELETE_X")).toThrow();
    expect(() => requireConfirm({ confirm: 1 }, "DELETE_X")).toThrow();
  });
});
