import { describe, expect, it } from "vitest";

import { isMutatingTool, selectTools } from "./server.js";

describe("isMutatingTool", () => {
  it("flags create_/update_/delete_/bulk_/publish_ prefixed names", () => {
    for (const name of [
      "itglue_create_configuration",
      "itglue_update_password",
      "itglue_delete_contact",
      "itglue_bulk_update",
      "itglue_bulk_delete",
      "itglue_publish_document",
    ]) {
      expect(isMutatingTool(name)).toBe(true);
    }
  });

  it("does not flag read-side tools", () => {
    for (const name of [
      "itglue_search_organizations",
      "itglue_get_password",
      "itglue_list_users",
      "itglue_find_org_match",
      "itglue_scan_duplicates",
      "itglue_health_check",
    ]) {
      expect(isMutatingTool(name)).toBe(false);
    }
  });
});

describe("selectTools", () => {
  it("returns full set when readOnly=false", () => {
    const full = selectTools(false);
    expect(full.length).toBeGreaterThan(40);
    expect(full.some((t) => t.name === "itglue_delete_password")).toBe(true);
  });

  it("filters out every mutating tool when readOnly=true", () => {
    const readOnly = selectTools(true);
    for (const t of readOnly) {
      expect(isMutatingTool(t.name)).toBe(false);
    }
    expect(readOnly.some((t) => t.name === "itglue_delete_password")).toBe(false);
    expect(readOnly.some((t) => t.name === "itglue_create_password")).toBe(false);
    expect(readOnly.some((t) => t.name === "itglue_bulk_delete")).toBe(false);
  });

  it("drops exactly 25 tools in read-only mode", () => {
    expect(selectTools(false).length - selectTools(true).length).toBe(25);
  });
});
