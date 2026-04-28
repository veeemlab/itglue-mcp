export type FormatMode = "compact" | "standard";

export interface FormatOptions {
  format?: FormatMode;
  fields?: string[];
  omitEmpty?: boolean;
}

const COMPACT_ATTRIBUTE_KEYS = new Set<string>([
  "name",
  "title",
  "slug",
  "first-name",
  "last-name",
  "full-name",
  "organization-id",
  "organization-name",
  "archived",
]);

export function applyFormat<T>(value: T, options?: FormatOptions): T {
  if (!options) return value;
  if (!options.format && !options.fields && options.omitEmpty === undefined) return value;
  if (!isJsonApiDoc(value)) return value;

  const doc = value as Record<string, unknown>;
  const data = doc.data;
  if (Array.isArray(data)) {
    return { ...doc, data: data.map((r) => transformResource(r, options)) } as T;
  }
  if (data && typeof data === "object") {
    return { ...doc, data: transformResource(data, options) } as T;
  }
  return value;
}

function transformResource(resource: unknown, options: FormatOptions): unknown {
  if (!resource || typeof resource !== "object") return resource;
  const obj = resource as Record<string, unknown>;
  const attrs = obj.attributes;
  if (!attrs || typeof attrs !== "object") return resource;

  let next = attrs as Record<string, unknown>;
  if (options.format === "compact") {
    next = pickKeys(next, COMPACT_ATTRIBUTE_KEYS);
  }
  if (options.fields && options.fields.length > 0) {
    next = pickKeys(next, new Set(options.fields));
  }
  if (options.omitEmpty) {
    next = stripEmpty(next);
  }
  return { ...obj, attributes: next };
}

function pickKeys(
  source: Record<string, unknown>,
  keep: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (keep.has(k)) out[k] = v;
  }
  return out;
}

function stripEmpty(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.length === 0) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v as Record<string, unknown>).length === 0
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

function isJsonApiDoc(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return "data" in (value as Record<string, unknown>);
}

export function formatOptionsSchema() {
  return {
    formatOptions: {
      type: "object",
      additionalProperties: false,
      description:
        "Reduce response size for token-sensitive callers. compact mode keeps id+type plus a small set of identifying attributes; fields[] picks specific attribute keys; omitEmpty strips null/empty values.",
      properties: {
        format: {
          type: "string",
          enum: ["compact", "standard"],
          description:
            "compact = id/type + key identifying fields only (~30-50% reduction); standard = full attributes (default).",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description:
            "Whitelist of attribute keys to keep. Combine with format=compact to override the default key set. Top-level id and type are always preserved.",
        },
        omitEmpty: {
          type: "boolean",
          description: "Strip null, empty strings, [], and {} from attributes.",
        },
      },
    },
  } as const;
}

export function pickFormatOptions(args: Record<string, unknown>): FormatOptions | undefined {
  const fo = args.formatOptions;
  if (!fo || typeof fo !== "object") return undefined;
  const obj = fo as Record<string, unknown>;
  const out: FormatOptions = {};
  if (obj.format === "compact" || obj.format === "standard") out.format = obj.format;
  if (Array.isArray(obj.fields)) {
    out.fields = obj.fields.filter((s): s is string => typeof s === "string");
  }
  if (typeof obj.omitEmpty === "boolean") out.omitEmpty = obj.omitEmpty;
  return out;
}
