import type { ITGlueClient } from "../client.js";

export { formatOptionsSchema } from "../format.js";

export interface ToolContext {
  client: ITGlueClient;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export function textResult(payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const body =
    err && typeof err === "object" && "body" in (err as Record<string, unknown>)
      ? (err as { body?: unknown }).body
      : undefined;
  const payload = body
    ? { error: message, details: body }
    : { error: message };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function paginationSchema() {
  return {
    pageSize: {
      type: "integer",
      description: "page[size] — items per page (default IT Glue: 50, max 1000 for most endpoints).",
      minimum: 1,
    },
    pageNumber: {
      type: "integer",
      description: "page[number] — 1-based page index.",
      minimum: 1,
    },
  } as const;
}

export function pickPagination(args: Record<string, unknown>) {
  return {
    pageSize: toIntOrUndef(args.pageSize),
    pageNumber: toIntOrUndef(args.pageNumber),
  };
}

export function toIntOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export function toStrOrUndef(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s.length > 0 ? s : undefined;
}

export function requireString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Missing required argument: ${key}`);
  }
  return String(v);
}

export function requireId(args: Record<string, unknown>, key = "id"): string {
  return requireString(args, key);
}
